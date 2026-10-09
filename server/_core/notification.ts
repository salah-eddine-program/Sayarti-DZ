import { TRPCError } from "@trpc/server";

export type NotificationPayload = { title: string; content: string };

/** No outbound notification provider is configured. Never claim delivery. */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  if (!payload.title.trim() || !payload.content.trim() ||
      payload.title.trim().length > 1200 || payload.content.trim().length > 20000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid notification payload." });
  }
  return false;
}
