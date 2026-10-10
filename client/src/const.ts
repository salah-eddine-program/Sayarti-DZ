import { requireSupabase } from "@/lib/supabase";

export const LOGIN_REQUEST_EVENT = "sayarti:open-auth";

/** Invoke from an event handler, never during render. */
export function startLogin(openAuth?: () => void): void {
  if (openAuth) {
    openAuth();
    return;
  }
  // Existing non-Home callers can request the same UI without owning credentials.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOGIN_REQUEST_EVENT));
}

export async function logout(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut({ scope: "local" });
  if (error) throw error;
}
