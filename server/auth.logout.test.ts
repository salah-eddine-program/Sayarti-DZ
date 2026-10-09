import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { revokeSession } = vi.hoisted(() => ({ revokeSession: vi.fn() }));
vi.mock("./_core/auth", () => ({ revokeSession }));
import { appRouter } from "./routers";

function context(authenticated = true): TrpcContext {
  return {
    user: authenticated ? {
      id: 1, authUserId: "00000000-0000-4000-8000-000000000001",
      email: "sample@example.com", name: "Sample User", loginMethod: "email",
      role: "user", language: "ar", theme: "light", profileLink: null,
      plan: "free", premiumExpiresAt: null,
      createdAt: "2026-10-09T00:00:00Z", updatedAt: "2026-10-09T00:00:00Z",
      lastSignedIn: "2026-10-09T00:00:00Z",
    } : null,
    accessToken: authenticated ? "test-access-token" : null,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => { revokeSession.mockReset(); revokeSession.mockResolvedValue(undefined); });

describe("auth compatibility", () => {
  it("returns the app profile from auth.me", async () => {
    const ctx = context();
    expect(await appRouter.createCaller(ctx).auth.me()).toEqual(ctx.user);
  });
  it("returns null when auth.me is anonymous", async () => {
    expect(await appRouter.createCaller(context(false)).auth.me()).toBeNull();
  });
  it("revokes the authenticated Supabase session and reports success", async () => {
    expect(await appRouter.createCaller(context()).auth.logout()).toEqual({ success: true });
    expect(revokeSession).toHaveBeenCalledWith("test-access-token");
  });
  it("allows an anonymous logout without contacting Supabase", async () => {
    expect(await appRouter.createCaller(context(false)).auth.logout()).toEqual({ success: true });
    expect(revokeSession).not.toHaveBeenCalled();
  });
  it("does not revoke an unverified token", async () => {
    const ctx = { ...context(false), accessToken: "unverified-token" };
    expect(await appRouter.createCaller(ctx).auth.logout()).toEqual({ success: true });
    expect(revokeSession).not.toHaveBeenCalled();
  });
  it("rejects anonymous app reads and writes", async () => {
    const caller = appRouter.createCaller(context(false));
    await expect(caller.app.data()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.app.vehicle.create({ brand: "Test", model: "Car", year: 2020, fuelType: "petrol", mileage: 0 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
