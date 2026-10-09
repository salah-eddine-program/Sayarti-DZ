import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { TRPCError } from "@trpc/server";
import type { User } from "@shared/types";
import { upsertUser } from "../db";
import { getSupabaseAuth } from "./supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  accessToken: string | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const authorization = opts.req.headers.authorization;
  const accessToken = typeof authorization === "string"
    ? /^Bearer\s+(\S+)$/i.exec(authorization)?.[1] ?? null
    : null;
  let user: User | null = null;
  if (accessToken) {
    const auth = getSupabaseAuth();
    let result;
    try {
      result = await auth.auth.getUser(accessToken);
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Authentication service unavailable." });
    }
    if (!result.error && result.data.user) {
      // Only the verified Supabase identity can determine ownership; ignore cookies.
      user = await upsertUser(result.data.user);
    } else if (result.error && (!result.error.status || result.error.status >= 500)) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Authentication service unavailable." });
    }
  }
  return { req: opts.req, res: opts.res, user, accessToken };
}
