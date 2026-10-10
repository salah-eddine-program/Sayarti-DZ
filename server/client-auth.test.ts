import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, signUp, signOut } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  requireSupabase: () => ({ auth: { signInWithPassword, signUp, signOut } }),
}));
import { LOGIN_REQUEST_EVENT, startLogin, logout } from "../client/src/const";

let dispatchEvent: ReturnType<typeof vi.fn>;
let prompt: ReturnType<typeof vi.fn>;
let confirm: ReturnType<typeof vi.fn>;
let alert: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  signOut.mockResolvedValue({ error: null });
  dispatchEvent = vi.fn(); prompt = vi.fn(); confirm = vi.fn(); alert = vi.fn();
  vi.stubGlobal("window", { dispatchEvent, prompt, confirm, alert });
});
afterEach(() => vi.unstubAllGlobals());

describe("login UI gateway", () => {
  it("opens UI through the supplied callback without starting an auth request", () => {
    const openAuth = vi.fn();
    startLogin(openAuth);
    expect(openAuth).toHaveBeenCalledOnce();
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("dispatches a UI request for legacy callers without prompting, confirming, or alerting", () => {
    startLogin();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0][0].type).toBe(LOGIN_REQUEST_EVENT);
    expect(prompt).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("is safe without a browser and still supports a UI callback", () => {
    vi.stubGlobal("window", undefined);
    expect(() => startLogin()).not.toThrow();
    const openAuth = vi.fn();
    startLogin(openAuth);
    expect(openAuth).toHaveBeenCalledOnce();
  });

  it("can reopen the UI for a retry or after dismissal", () => {
    const openAuth = vi.fn();
    startLogin(openAuth);
    startLogin(openAuth);
    expect(openAuth).toHaveBeenCalledTimes(2);
  });

  it("signs out the current local Supabase session", async () => {
    await logout();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("propagates a sign-out failure to the existing auth hook", async () => {
    const error = new Error("test sign-out failure");
    signOut.mockResolvedValueOnce({ error });
    await expect(logout()).rejects.toBe(error);
  });
});
