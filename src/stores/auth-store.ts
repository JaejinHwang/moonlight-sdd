import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type AuthState = "loading" | "authenticated" | "unauthenticated";

interface AuthStore {
  user: User | null;
  session: Session | null;
  authState: AuthState;
  error: string | null;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  authState: "loading",
  error: null,
  isLoading: false,

  initialize: async () => {
    const supabase = createClient();

    // Get initial session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      set({
        user: session.user,
        session,
        authState: "authenticated",
      });
    } else {
      set({
        authState: "unauthenticated",
      });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        set({
          user: session.user,
          session,
          authState: "authenticated",
        });
      } else {
        set({
          user: null,
          session: null,
          authState: "unauthenticated",
        });
      }
    });
  },

  signUp: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }

    if (data.user) {
      set({
        user: data.user,
        session: data.session,
        authState: data.session ? "authenticated" : "unauthenticated",
        isLoading: false,
      });
    }

    return { success: true };
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }

    set({
      user: data.user,
      session: data.session,
      authState: "authenticated",
      isLoading: false,
    });

    return { success: true };
  },

  signOut: async () => {
    set({ isLoading: true });

    const supabase = createClient();
    await supabase.auth.signOut();

    set({
      user: null,
      session: null,
      authState: "unauthenticated",
      isLoading: false,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
