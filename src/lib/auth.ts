"use client";

import { useSyncExternalStore } from "react";
import { createClient, isSupabaseConfigured } from "./supabase/client";

export interface AuthUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  provider: "google" | "email";
  avatarText: string;
}

const AUTH_KEY = "scriptflow.auth.v1";

const DEFAULT_USER: AuthUser = {
  name: "Line Producer",
  email: "producer@scriptflow.ai",
  role: "Line Producer",
  provider: "google",
  avatarText: "LP",
};

let cachedUser: AuthUser | null = null;
const authListeners = new Set<() => void>();
let isInitialized = false;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "SF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readAuth(): AuthUser | null {
  if (cachedUser) return cachedUser;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      cachedUser = JSON.parse(raw);
    } else {
      cachedUser = null;
    }
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

export function getActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  const user = readAuth();
  return user?.id || null;
}

function writeAuth(user: AuthUser | null) {
  cachedUser = user;
  try {
    if (user) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  } catch {
    /* mem fallback */
  }
  authListeners.forEach((l) => l());
}

function subscribeAuth(listener: () => void) {
  authListeners.add(listener);

  // Inisialisasi listener realtime Supabase jika kredensial tersedia
  if (!isInitialized && typeof window !== "undefined" && isSupabaseConfigured()) {
    isInitialized = true;
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const userMeta = session.user.user_metadata || {};
          const name = userMeta.name || userMeta.full_name || session.user.email?.split("@")[0] || "User";
          const provider = (session.user.app_metadata?.provider === "google" ? "google" : "email") as "google" | "email";
          writeAuth({
            id: session.user.id,
            name,
            email: session.user.email || "",
            role: "Line Producer",
            provider,
            avatarText: getInitials(name),
          });
        }
      });

      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const userMeta = session.user.user_metadata || {};
          const name = userMeta.name || userMeta.full_name || session.user.email?.split("@")[0] || "User";
          const provider = (session.user.app_metadata?.provider === "google" ? "google" : "email") as "google" | "email";
          writeAuth({
            id: session.user.id,
            name,
            email: session.user.email || "",
            role: "Line Producer",
            provider,
            avatarText: getInitials(name),
          });
        } else {
          writeAuth(null);
        }
      });
    } catch {
      /* gracefully ignore offline */
    }
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === AUTH_KEY) {
      cachedUser = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    authListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAuth(): AuthUser | null {
  return useSyncExternalStore(subscribeAuth, readAuth, () => null);
}

// ======================== SUPABASE ACTIONS ========================

/** Masuk dengan Google via Supabase OAuth (Bukan statis) */
export async function signInWithGoogleSupabase(): Promise<{ error: Error | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      return { error };
    }

    if (data?.url) {
      window.location.href = data.url;
    }

    return { error: null };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/** Masuk dengan Email & Password via Supabase Auth */
export async function signInWithEmailSupabase(email: string, password: string): Promise<{ user: AuthUser | null; error: Error | null }> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { user: null, error };
    if (data.user) {
      const name = data.user.user_metadata?.name || email.split("@")[0] || "User";
      const user: AuthUser = {
        id: data.user.id,
        name,
        email: data.user.email || email,
        role: "Line Producer",
        provider: "email",
        avatarText: getInitials(name),
      };
      writeAuth(user);
      return { user, error: null };
    }
  }
  // Local fallback jika Supabase belum dihubungkan
  const user = loginWithEmail(email);
  return { user, error: null };
}

/** Daftar akun baru dengan Email & Password via Supabase Auth */
export async function signUpWithEmailSupabase(name: string, email: string, password: string): Promise<{ user: AuthUser | null; error: Error | null }> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim(),
          role: "Line Producer",
        },
      },
    });
    if (error) return { user: null, error };
    if (data.user) {
      const user: AuthUser = {
        id: data.user.id,
        name: name.trim(),
        email: data.user.email || email,
        role: "Line Producer",
        provider: "email",
        avatarText: getInitials(name),
      };
      writeAuth(user);
      return { user, error: null };
    }
  }
  // Local fallback jika Supabase belum dihubungkan
  const user = registerWithEmail(name, email);
  return { user, error: null };
}

// ======================== LOCAL / DEMO FALLBACKS ========================

export function loginWithGoogle(email = "arya.producer@gmail.com", name = "Arya Producer"): AuthUser {
  const user: AuthUser = {
    id: "local-user-" + email.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    name,
    email,
    role: "Line Producer",
    provider: "google",
    avatarText: getInitials(name),
  };
  writeAuth(user);
  return user;
}

export function loginWithEmail(email: string): AuthUser {
  const namePart = email.split("@")[0] || "Produser";
  const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
  const user: AuthUser = {
    id: "local-user-" + email.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    name: formattedName,
    email: email.trim(),
    role: "Line Producer",
    provider: "email",
    avatarText: getInitials(formattedName),
  };
  writeAuth(user);
  return user;
}

export function registerWithGoogle(email = "arya.producer@gmail.com", name = "Arya Producer"): AuthUser {
  return loginWithGoogle(email, name);
}

export function registerWithEmail(name: string, email: string): AuthUser {
  const user: AuthUser = {
    id: "local-user-" + email.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    name: name.trim() || "Kreator Film",
    email: email.trim(),
    role: "Produser / Penulis",
    provider: "email",
    avatarText: getInitials(name || "KF"),
  };
  writeAuth(user);
  return user;
}

export async function logout() {
  if (typeof window !== "undefined" && isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }
  writeAuth(null);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("scriptflow.projects.v1");
    } catch {}
    window.location.href = "/login";
  }
}
