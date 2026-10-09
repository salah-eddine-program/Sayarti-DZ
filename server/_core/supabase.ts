import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import type { Database } from "@shared/types";
import { ENV } from "./env";

let authClient: SupabaseClient<Database> | undefined;
let adminClient: SupabaseClient<Database> | undefined;

function createServerClient(key: string, variable: string) {
  if (!ENV.supabaseUrl || !key) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Supabase is not configured: SUPABASE_URL and ${variable} are required.`,
    });
  }
  return createClient<Database>(ENV.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function getSupabaseAuth() {
  return authClient ??= createServerClient(ENV.supabaseAnonKey, "SUPABASE_ANON_KEY");
}

// Server-only. All application queries must additionally filter auth_user_id.
export function getSupabaseAdmin() {
  return adminClient ??= createServerClient(ENV.supabaseServiceRoleKey, "SUPABASE_SERVICE_ROLE_KEY");
}
