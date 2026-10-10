"use client";

import { useSyncExternalStore } from "react";
import { DEMO_SCRIPT } from "./demo-script";
import type { Project, ProjectFormat } from "./types";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import { getActiveUserId } from "./auth";

/**
 * Penyimpanan proyek: Terisolasi 100% per akun pengguna (Per-User Isolation).
 * - Di Supabase: difilter strictly berdasarkan `owner_id = user.id` & dilindungi RLS.
 * - Di LocalStorage: dicache per user ID (`scriptflow.projects.v1.${userId}`).
 * Data akun A TIDAK AKAN PERNAH muncul atau bocor ke akun B.
 */

let cache: Project[] | null = null;
let currentCachedUserId: string | null = null;
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

function getStorageKey(userId?: string | null): string {
  const activeId = userId !== undefined ? userId : getActiveUserId();
  if (activeId) return `scriptflow.projects.v1.${activeId}`;
  return "scriptflow.projects.v1.guest";
}

function read(userId?: string | null): Project[] {
  const activeId = userId !== undefined ? userId : getActiveUserId();
  const key = getStorageKey(activeId);

  // Jika user berganti, invalidasi memori cache seketika
  if (currentCachedUserId !== activeId) {
    cache = null;
    currentCachedUserId = activeId;
  }

  if (cache) return cache;

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      cache = JSON.parse(raw) as Project[];
    } else {
      // Jika pengguna sudah login, mulai dengan list kosong [] agar tidak melihat proyek orang lain
      // Jika tamu belum login sama sekali, tampilkan seed demo
      cache = activeId ? [] : seed();
      localStorage.setItem(key, JSON.stringify(cache));
    }
  } catch {
    cache = activeId ? [] : seed();
  }
  return cache;
}

function write(next: Project[], userId?: string | null) {
  const activeId = userId !== undefined ? userId : getActiveUserId();
  const key = getStorageKey(activeId);
  cache = next;
  currentCachedUserId = activeId;

  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* kuota penuh / mode privat */
  }
  listeners.forEach((l) => l());
}

/**
 * Sinkronisasi data proyek KHUSUS untuk akun yang sedang login.
 */
async function syncFromSupabase() {
  if (typeof window === "undefined") return;

  if (!isSupabaseConfigured()) {
    const activeId = getActiveUserId();
    read(activeId);
    listeners.forEach((l) => l());
    return;
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Jika pengguna belum login, kosongkan cache dan bersihkan tampilan
      cache = [];
      currentCachedUserId = null;
      write([], "guest");
      return;
    }

    const userId = user.id;

    // Ambil HANYA proyek yang dimiliki oleh user ini
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("Kueri tabel projects Supabase belum aktif atau ada kendala:", error.message);
      read(userId);
      listeners.forEach((l) => l());
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

      // Simpan strictly untuk user ini
      write(remoteProjects, userId);
    }
  } catch (err) {
    console.warn("Gagal sinkronisasi dari Supabase:", err);
  }
}

function initSupabaseListener() {
  if (isSupabaseInitialized || typeof window === "undefined" || !isSupabaseConfigured()) return;
  isSupabaseInitialized = true;

  syncFromSupabase();

  try {
    const supabase = createClient();

    // Dengarkan event perubahan user / login / logout
    supabase.auth.onAuthStateChange((event) => {
      // Selalu kosongkan cache memori saat auth berganti
      cache = null;
      currentCachedUserId = null;

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        syncFromSupabase();
      } else if (event === "SIGNED_OUT") {
        cache = [];
        currentCachedUserId = null;
        write([], "guest");
      }
    });

    // Realtime Postgres Changes
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
    // Abaikan error realtime
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  initSupabaseListener();

  const onStorage = (e: StorageEvent) => {
    const currentKey = getStorageKey();
    if (e.key === currentKey) {
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
  return useSyncExternalStore(subscribe, () => read(), serverSnapshot);
}

export function useProject(id: string): Project | null | undefined {
  const list = useProjects();
  if (list === null) return undefined;
  return list.find((p) => p.id === id) ?? null;
}

export function createProject(title: string, format: ProjectFormat, scriptText = ""): Project {
  const activeUserId = getActiveUserId();
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

  const currentList = read(activeUserId);
  write([p, ...currentList], activeUserId);

  // Simpan ke Supabase untuk user aktif
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
  const activeUserId = getActiveUserId();
  const currentList = read(activeUserId);

  const updatedList = currentList.map((p) =>
    p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
  );
  write(updatedList, activeUserId);

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
  const activeUserId = getActiveUserId();
  const currentList = read(activeUserId);
  write(currentList.filter((p) => p.id !== id), activeUserId);

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
