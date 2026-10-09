import { createClient } from "@supabase/supabase-js";
import type { Database } from "@shared/types";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Only the public anonymous key belongs in the browser. Never use a service key here.
export const supabase = url && anonKey
  ? createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "sayarti.auth",
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("أعدّ VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY لتفعيل تسجيل الدخول.");
  }
  return supabase;
}
