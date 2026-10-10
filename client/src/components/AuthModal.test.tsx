// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthModal from "./AuthModal";
import { authCopy } from "@/lib/auth";

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ requireSupabase: () => ({ auth }) }));
const onClose = vi.fn();
const onSuccess = vi.fn();
const successful = { data: { session: { access_token: "test-session" } }, error: null };

beforeEach(() => {
  vi.resetAllMocks();
  auth.signInWithPassword.mockResolvedValue(successful);
  auth.signUp.mockResolvedValue(successful);
});
afterEach(cleanup);

function showModal(lang: "en" | "ar" | "fr" = "en", dark = false) {
  return render(<AuthModal lang={lang} dark={dark} onClose={onClose} onSuccess={onSuccess} />);
}

function fill(email = "driver@example.com", password = "password123") {
  fireEvent.change(screen.getByLabelText(authCopy.en.email), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(authCopy.en.password), { target: { value: password } });
}

async function signupMode() {
  await userEvent.click(screen.getByRole("button", { name: authCopy.en.signup }));
}

describe("AuthModal", () => {
  it("focuses the email, supports RTL and dark theme, and exposes an accessible title", () => {
    showModal("ar", true);
    const dialog = screen.getByRole("dialog", { name: authCopy.ar.login });
    expect(dialog.getAttribute("dir")).toBe("rtl");
    expect(dialog.classList.contains("theme-dark")).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText(authCopy.ar.email));
    expect(screen.getByRole("button", { name: authCopy.ar.close })).toBeDefined();
  });

  it("validates email and minimum password length before contacting Supabase", async () => {
    showModal();
    fill("invalid", "12345");
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.login }));
    expect(screen.getByText(authCopy.en.invalidEmail)).toBeDefined();
    expect(screen.getByText(authCopy.en.shortPassword)).toBeDefined();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("only signs up explicitly and requires matching password confirmation", async () => {
    showModal();
    await signupMode();
    fill();
    fireEvent.change(screen.getByLabelText(authCopy.en.confirmation), { target: { value: "different" } });
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.signup }));
    expect(screen.getByText(authCopy.en.mismatch)).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText(authCopy.en.confirmation));
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("toggles password visibility for both password fields, and clears passwords when switching modes", async () => {
    showModal();
    await signupMode();
    fill();
    fireEvent.change(screen.getByLabelText(authCopy.en.confirmation), { target: { value: "password123" } });
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.showPassword }));
    expect(screen.getByLabelText(authCopy.en.password).getAttribute("type")).toBe("text");
    expect(screen.getByLabelText(authCopy.en.confirmation).getAttribute("type")).toBe("text");
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.hidePassword }));
    expect(screen.getByLabelText(authCopy.en.password).getAttribute("type")).toBe("password");
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.login }));
    expect((screen.getByLabelText(authCopy.en.password) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(authCopy.en.email) as HTMLInputElement).value).toBe("driver@example.com");
    expect(screen.queryByLabelText(authCopy.en.confirmation)).toBeNull();
  });

  it("signs in with a trimmed email without changing password spaces", async () => {
    showModal();
    fill(" driver@example.com ", " pass ");
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.login }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "driver@example.com", password: " pass " });
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("shows a safe sign-in error and allows retry, never registering automatically", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { code: "invalid_credentials", message: "private server details" } });
    showModal();
    fill();
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.login }));
    expect(screen.getByRole("alert").textContent).toBe(authCopy.en.invalidCredentials);
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.retry }));
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("catches failures without exposing internal exception messages", async () => {
    auth.signInWithPassword.mockRejectedValueOnce(new Error("private credential and URL"));
    showModal();
    fill();
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.login }));
    expect(screen.getByRole("alert").textContent).toBe(authCopy.en.genericError);
    expect(document.body.textContent).not.toContain("private credential");
    expect((screen.getByRole("button", { name: authCopy.en.retry }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("requests email confirmation without a session and lets the user switch back to sign-in", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    showModal();
    await signupMode();
    fill();
    fireEvent.change(screen.getByLabelText(authCopy.en.confirmation), { target: { value: "password123" } });
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.signup }));
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "driver@example.com",
      password: "password123",
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    expect(screen.getByRole("status").textContent).toBe(authCopy.en.checkEmail);
    expect(onSuccess).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.retry }));
    expect((screen.getByLabelText(authCopy.en.password) as HTMLInputElement).value).toBe("");
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.login }));
    expect(screen.getByRole("dialog", { name: authCopy.en.login })).toBeDefined();
  });

  it("finishes sign-up immediately when Supabase returns a session", async () => {
    showModal();
    await signupMode();
    fill();
    fireEvent.change(screen.getByLabelText(authCopy.en.confirmation), { target: { value: "password123" } });
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.signup }));
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows loading and disables duplicate requests, fields, visibility, and mode switching", async () => {
    let resolve!: (value: typeof successful) => void;
    auth.signInWithPassword.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    showModal();
    fill();
    const submit = screen.getByRole("button", { name: authCopy.en.login });
    const form = submit.closest("form")!;
    await userEvent.click(submit);
    expect((screen.getByRole("button", { name: authCopy.en.loading }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(authCopy.en.email) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(authCopy.en.password) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: authCopy.en.signup }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: authCopy.en.showPassword }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(form);
    expect(auth.signInWithPassword).toHaveBeenCalledOnce();
    await act(async () => { resolve(successful); });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("can close while a request is pending and ignores stale completion after unmount", async () => {
    let resolve!: (value: typeof successful) => void;
    auth.signInWithPassword.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    function Harness() {
      const [open, setOpen] = useState(true);
      return open ? <AuthModal lang="en" dark={false} onClose={() => setOpen(false)} onSuccess={onSuccess} /> : null;
    }
    render(<Harness />);
    fill();
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.login }));
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => { resolve(successful); });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("closes with Escape and restores focus to the opening button", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open auth</button>{open && <AuthModal lang="en" dark={false} onClose={() => setOpen(false)} onSuccess={onSuccess} />}</>;
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open auth" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
