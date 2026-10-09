import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, signUp, signOut } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  requireSupabase: () => ({ auth: { signInWithPassword, signUp, signOut } }),
}));
import { startLogin, logout } from "../client/src/const";

let prompt: ReturnType<typeof vi.fn>;
let confirm: ReturnType<typeof vi.fn>;
let alert: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  signInWithPassword.mockResolvedValue({ error: null });
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  signOut.mockResolvedValue({ error: null });
  prompt = vi.fn(); confirm = vi.fn(); alert = vi.fn();
  vi.stubGlobal("window", { prompt, confirm, alert });
});
afterEach(() => vi.unstubAllGlobals());

describe("email/password login", () => {
  it("signs in with a trimmed email without signing up or reloading", async () => {
    prompt.mockReturnValueOnce(" user@example.com ").mockReturnValueOnce("test-password");
    await startLogin();
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "test-password" });
    expect(signUp).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });
  it("does not contact auth when the prompt is cancelled", async () => {
    prompt.mockReturnValueOnce(null);
    await startLogin();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
  it("offers sign-up only with consent and confirmed password after invalid credentials", async () => {
    prompt.mockReturnValueOnce("new@example.com").mockReturnValueOnce("test-password").mockReturnValueOnce("test-password");
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    confirm.mockReturnValue(true);
    await startLogin();
    expect(signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "test-password" });
    expect(alert.mock.calls[0][0]).toContain("تحقق من بريدك");
  });
  it("never signs up automatically or on a rejected consent", async () => {
    prompt.mockReturnValueOnce("user@example.com").mockReturnValueOnce("wrong-password");
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    confirm.mockReturnValue(false);
    await startLogin();
    expect(signUp).not.toHaveBeenCalled();
  });
  it("rejects a different confirmation password", async () => {
    prompt.mockReturnValueOnce("new@example.com").mockReturnValueOnce("test-password").mockReturnValueOnce("different-password");
    signInWithPassword.mockResolvedValue({ error: { code: "user_not_found" } });
    confirm.mockReturnValue(true);
    await startLogin();
    expect(signUp).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
  });
  it("does not propose sign-up for email-confirmation or rate-limit errors", async () => {
    prompt.mockReturnValueOnce("user@example.com").mockReturnValueOnce("test-password");
    signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed", message: "Confirm your email" } });
    await startLogin();
    expect(confirm).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith("Confirm your email");
  });
  it("handles a network failure without an unhandled rejection", async () => {
    prompt.mockReturnValueOnce("user@example.com").mockReturnValueOnce("test-password");
    signInWithPassword.mockRejectedValue(new Error("private transport info"));
    await expect(startLogin()).resolves.toBeUndefined();
    expect(alert).toHaveBeenCalled();
    expect(alert.mock.calls[0][0]).not.toContain("private transport info");
  });
  it("signs out the current local Supabase session", async () => {
    await logout();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
