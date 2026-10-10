// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";
import { authCopy } from "@/lib/auth";
import { startLogin } from "@/const";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, loading: false, logout: vi.fn() },
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  dataQuery: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/supabase", () => ({ requireSupabase: () => ({ auth: { signInWithPassword: mocks.signInWithPassword, signUp: mocks.signUp } }) }));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ isPending: false, error: null, mutate: mocks.mutate }) };
  return { trpc: {
    useUtils: () => ({}),
    app: {
      data: { useQuery: mocks.dataQuery },
      settings: mutation,
      vehicle: { create: mutation, update: mutation },
      maintenance: { create: mutation },
      expense: { create: mutation },
      fuel: { create: mutation },
      document: { create: mutation },
    },
  } };
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.isAuthenticated = false;
  mocks.auth.loading = false;
  mocks.dataQuery.mockReturnValue({ data: undefined, refetch: vi.fn() });
  mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials" } });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  localStorage.clear();
  localStorage.setItem("sayarti.language", "en");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function enterDemo() {
  await userEvent.click(screen.getByRole("button", { name: "Continue to demo" }));
  expect(screen.getByText("Renault Clio 4")).toBeDefined();
  // Demo data has an Arabic profile; choose English through the same UI as a user.
  await userEvent.selectOptions(screen.getByLabelText("Language"), "en");
}

function fillLogin() {
  fireEvent.change(screen.getByLabelText(authCopy.en.email), { target: { value: "driver@example.com" } });
  fireEvent.change(screen.getByLabelText(authCopy.en.password), { target: { value: "password123" } });
}

describe("Home authentication integration", () => {
  it("opens from the landing CTA with no browser dialogs or Manus OAuth label", async () => {
    const prompt = vi.spyOn(window, "prompt");
    const confirm = vi.spyOn(window, "confirm");
    const alert = vi.spyOn(window, "alert");
    render(<Home />);
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.login }));
    expect(screen.getByRole("dialog", { name: authCopy.en.login })).toBeDefined();
    expect(document.body.textContent).not.toContain("Manus");
    expect(prompt).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue to demo" })).toBeDefined();
  });

  it("opens from both demo login buttons and keeps the demo after dismissal", async () => {
    render(<Home />);
    await enterDemo();
    for (const index of [0, 1]) {
      await userEvent.click(screen.getAllByRole("button", { name: authCopy.en.login })[index]);
      expect(screen.getByRole("dialog")).toBeDefined();
      await userEvent.click(screen.getByRole("button", { name: authCopy.en.close }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByText("Renault Clio 4")).toBeDefined();
    }
    expect(mocks.dataQuery).toHaveBeenLastCalledWith(undefined, { enabled: false, retry: false });
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("keeps demo mode after a failed login, clears secrets on reopening, and inherits dark mode", async () => {
    render(<Home />);
    await enterDemo();
    await userEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await userEvent.click(screen.getAllByRole("button", { name: authCopy.en.login })[1]);
    expect(screen.getByRole("dialog").classList.contains("theme-dark")).toBe(true);
    fillLogin();
    await userEvent.click(screen.getAllByRole("button", { name: authCopy.en.login }).at(-1)!);
    expect(screen.getByRole("alert").textContent).toBe(authCopy.en.invalidCredentials);
    expect(mocks.signUp).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.close }));
    expect(screen.getByText("Renault Clio 4")).toBeDefined();
    await userEvent.click(screen.getAllByRole("button", { name: authCopy.en.login })[1]);
    expect((screen.getByLabelText(authCopy.en.email) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(authCopy.en.password) as HTMLInputElement).value).toBe("");
  });

  it("shows confirmation for sign-up without a session without leaving demo mode", async () => {
    render(<Home />);
    await enterDemo();
    await userEvent.click(screen.getAllByRole("button", { name: authCopy.en.login })[1]);
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.signup }));
    fillLogin();
    fireEvent.change(screen.getByLabelText(authCopy.en.confirmation), { target: { value: "password123" } });
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.signup }));
    expect(screen.getByRole("status").textContent).toBe(authCopy.en.checkEmail);
    await userEvent.click(screen.getByRole("button", { name: authCopy.en.close }));
    expect(screen.getByText("Renault Clio 4")).toBeDefined();
    expect(mocks.dataQuery).toHaveBeenLastCalledWith(undefined, { enabled: false, retry: false });
  });

  it("closes and switches out of demo mode once a real session is returned", async () => {
    mocks.signInWithPassword.mockImplementationOnce(async () => {
      mocks.auth.isAuthenticated = true;
      return { data: { session: { access_token: "test-session" } }, error: null };
    });
    render(<Home />);
    await enterDemo();
    await userEvent.click(screen.getAllByRole("button", { name: authCopy.en.login })[1]);
    fillLogin();
    await userEvent.click(screen.getAllByRole("button", { name: authCopy.en.login }).at(-1)!);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Renault Clio 4")).toBeNull();
    expect(document.querySelector(".demo-banner")).toBeNull();
    expect(mocks.dataQuery).toHaveBeenLastCalledWith(undefined, { enabled: true, retry: false });
  });

  it("handles event-based startLogin calls without a prompt", () => {
    render(<Home />);
    act(() => startLogin());
    expect(screen.getByRole("dialog", { name: authCopy.en.login })).toBeDefined();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
});
