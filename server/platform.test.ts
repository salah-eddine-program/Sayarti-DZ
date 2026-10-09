import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

const { getUser, upsertUser } = vi.hoisted(() => ({ getUser: vi.fn(), upsertUser: vi.fn() }));
vi.mock("./_core/supabase", () => ({ getSupabaseAuth: () => ({ auth: { getUser } }) }));
vi.mock("./db", () => ({ upsertUser }));
import { createContext } from "./_core/context";

function request(headers: Record<string, string> = {}): CreateExpressContextOptions {
  return { req: { headers }, res: {} } as CreateExpressContextOptions;
}

beforeEach(() => { getUser.mockReset(); upsertUser.mockReset(); });

describe("Supabase request authentication", () => {
  it.each([{}, { cookie: "app_session=legacy-token" }, { authorization: "Basic abc" }, { authorization: "Bearer" }, { authorization: "Bearer token extra" }])("ignores absent, cookie, and malformed credentials: %j", async headers => {
    expect((await createContext(request(headers))).user).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
    expect(upsertUser).not.toHaveBeenCalled();
  });
  it("verifies a Bearer token with getUser and upserts only its verified identity", async () => {
    const authUser = { id: "verified-uuid", email: "verified@example.com" };
    const appUser = { id: 7, authUserId: "verified-uuid" };
    getUser.mockResolvedValue({ data: { user: authUser }, error: null });
    upsertUser.mockResolvedValue(appUser);
    const ctx = await createContext(request({ authorization: "bearer test-token" }));
    expect(getUser).toHaveBeenCalledWith("test-token");
    expect(upsertUser).toHaveBeenCalledWith(authUser);
    expect(ctx.user).toEqual(appUser);
    expect(ctx.accessToken).toBe("test-token");
  });
  it("leaves an invalid token anonymous without creating an app user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect((await createContext(request({ authorization: "Bearer bad-token" }))).user).toBeNull();
    expect(upsertUser).not.toHaveBeenCalled();
  });
  it("does not disguise an upstream auth outage as a logged-out user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(createContext(request({ authorization: "Bearer test-token" }))).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("reports a transport failure without exposing its message", async () => {
    getUser.mockRejectedValue(new Error("private transport details"));
    await expect(createContext(request({ authorization: "Bearer test-token" }))).rejects.toMatchObject({ message: "Authentication service unavailable." });
  });
  it("does not swallow app profile database failures", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "verified-uuid" } }, error: null });
    upsertUser.mockRejectedValue(new Error("Database operation failed."));
    await expect(createContext(request({ authorization: "Bearer test-token" }))).rejects.toThrow("Database operation failed.");
  });
});
