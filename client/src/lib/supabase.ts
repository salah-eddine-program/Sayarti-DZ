import { createClient } from "@supabase/supabase-js";
import type { Database } from "@shared/types";

// These are Supabase publishable values. They are safe in browser code;
// the service-role key remains server-only in SUPABASE_SERVICE_ROLE_KEY.
const url = (import.meta.env.VITE_SUPABASE_URL || "https://qndughzzhsfdlrgikpzl.supabase.co").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_zuBNyGr4H4OJVYf-J06_mw_nbuBSmIG").trim();

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
