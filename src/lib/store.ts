"use client";

import { useSyncExternalStore } from "react";
import { DEMO_SCRIPT } from "./demo-script";
import type { Project, ProjectFormat } from "./types";
import { createClient, isSupabaseConfigured } from "./supabase/client";

/**
 * Penyimpanan proyek: Hybrid Local-First & Supabase Cloud PostgreSQL.
 * Membaca & menulis langsung ke tabel `public.projects` jika tersambung dengan Supabase,
 * dan menggunakan localStorage sebagai cache instan 0ms offline/fallback.
 */
const KEY = "scriptflow.projects.v1";

let cache: Project[] | null = null;
const listeners = new Set<() => void>();
let isSupabaseInitialized = false;

const newId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

function seed(): Project[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-pulang",
      title: "Pulang — Film Pendek",
      format: "film_pendek",
      scriptText: DEMO_SCRIPT,
      contingencyPct: 10,
      overrides: {},
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function read(): Project[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Project[]) : seed();
    if (!raw) localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    cache = seed();
  }
  return cache;
}

function write(next: Project[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* kuota penuh / mode privat: tetap jalan di memori */
  }
  listeners.forEach((l) => l());
}

/**
 * Sinkronisasi data proyek dari tabel `projects` di Supabase.
 */
async function syncFromSupabase() {
  if (!isSupabaseConfigured() || typeof window === "undefined") return;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      // Jika tabel belum dieksekusi di Supabase, fallback aman ke localStorage
      console.warn("Tabel projects di Supabase belum dibuat atau ada kendala:", error.message);
      return;
    }

    if (Array.isArray(data)) {
      const remoteProjects: Project[] = data.map((row: any) => ({
        id: row.id,
        title: row.title || "Proyek tanpa judul",
        format: row.format || "film_pendek",
        scriptText: row.script_text || "",
        contingencyPct: Number(row.contingency_pct ?? 10),
        overrides: row.overrides || {},
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      }));

      // Migrasikan proyek lokal yang belum ada di Supabase ke cloud
      const localList = read();
      const remoteIds = new Set(remoteProjects.map((p) => p.id));
      const unmergedLocals = localList.filter((p) => p.id !== "demo-pulang" && !remoteIds.has(p.id));

      if (unmergedLocals.length > 0) {
        for (const localP of unmergedLocals) {
          await supabase.from("projects").upsert({
            id: localP.id,
            owner_id: user.id,
            title: localP.title,
            format: localP.format,
            script_text: localP.scriptText,
            contingency_pct: localP.contingencyPct,
            overrides: localP.overrides || {},
            created_at: localP.createdAt,
            updated_at: localP.updatedAt,
          });
        }

        const { data: updatedData } = await supabase
          .from("projects")
          .select("*")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false });

        if (Array.isArray(updatedData)) {
          const merged: Project[] = updatedData.map((row: any) => ({
            id: row.id,
            title: row.title || "Proyek tanpa judul",
            format: row.format || "film_pendek",
            scriptText: row.script_text || "",
            contingencyPct: Number(row.contingency_pct ?? 10),
            overrides: row.overrides || {},
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          }));
          write(merged);
          return;
        }
      }

      write(remoteProjects);
    }
  } catch (err) {
    console.warn("Gagal sinkronisasi dari Supabase:", err);
  }
}

function initSupabaseListener() {
  if (isSupabaseInitialized || typeof window === "undefined" || !isSupabaseConfigured()) return;
  isSupabaseInitialized = true;

  // Sinkronisasi data saat inisialisasi
  syncFromSupabase();

  try {
    const supabase = createClient();

    // Dengarkan event login / logout
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        syncFromSupabase();
      } else if (event === "SIGNED_OUT") {
        cache = seed();
        write(cache);
      }
    });

    // Dengarkan perubahan realtime di tabel `projects`
    supabase
      .channel("public-projects-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => {
          syncFromSupabase();
        }
      )
      .subscribe();
  } catch {
    // Abaikan jika realtime listener tidak dapat terhubung
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  initSupabaseListener();

  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = () => null;

/** `null` selama render server / hidrasi, array setelah di client. */
export function useProjects(): Project[] | null {
  return useSyncExternalStore(subscribe, read, serverSnapshot);
}

export function useProject(id: string): Project | null | undefined {
  const list = useProjects();
  if (list === null) return undefined; // masih memuat
  return list.find((p) => p.id === id) ?? null;
}

export function createProject(title: string, format: ProjectFormat, scriptText = ""): Project {
  const now = new Date().toISOString();
  const p: Project = {
    id: newId(),
    title: title.trim() || "Proyek tanpa judul",
    format,
    scriptText,
    contingencyPct: 10,
    overrides: {},
    createdAt: now,
    updatedAt: now,
  };
  write([p, ...read()]);

  // Simpan ke Supabase jika terhubung
  if (typeof window !== "undefined" && isSupabaseConfigured()) {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          await supabase.from("projects").insert({
            id: p.id,
            owner_id: user.id,
            title: p.title,
            format: p.format,
            script_text: p.scriptText,
            contingency_pct: p.contingencyPct,
            overrides: p.overrides,
            created_at: p.createdAt,
            updated_at: p.updatedAt,
          });
        }
      } catch (err) {
        console.warn("Gagal insert project ke Supabase:", err);
      }
    })();
  }

  return p;
}

export function updateProject(id: string, patch: Partial<Omit<Project, "id">>) {
  write(
    read().map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
    )
  );

  // Perbarui di Supabase jika terhubung
  if (typeof window !== "undefined" && isSupabaseConfigured() && id !== "demo-pulang") {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const payload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (patch.title !== undefined) payload.title = patch.title;
          if (patch.format !== undefined) payload.format = patch.format;
          if (patch.scriptText !== undefined) payload.script_text = patch.scriptText;
          if (patch.contingencyPct !== undefined) payload.contingency_pct = patch.contingencyPct;
          if (patch.overrides !== undefined) payload.overrides = patch.overrides;

          await supabase.from("projects").update(payload).eq("id", id).eq("owner_id", user.id);
        }
      } catch (err) {
        console.warn("Gagal update project di Supabase:", err);
      }
    })();
  }
}

export function deleteProject(id: string) {
  write(read().filter((p) => p.id !== id));

  // Hapus di Supabase jika terhubung
  if (typeof window !== "undefined" && isSupabaseConfigured() && id !== "demo-pulang") {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
        }
      } catch (err) {
        console.warn("Gagal hapus project dari Supabase:", err);
      }
    })();
  }
}
