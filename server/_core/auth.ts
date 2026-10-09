import { TRPCError } from "@trpc/server";
import { getSupabaseAdmin } from "./supabase";

export async function revokeSession(accessToken: string): Promise<void> {
  const { error } = await getSupabaseAdmin().auth.admin.signOut(accessToken, "local");
  // Already expired or revoked sessions are successfully logged out too.
  if (error && ![401, 403, 404].includes(error.status ?? 0)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to revoke session." });
  }
}
