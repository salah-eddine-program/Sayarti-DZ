import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getApiBaseUrl } from "@/constants/oauth";

const SESSION_KEY = "sayarti.verified-email-session.v1";

type Account = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type StoredSession = {
  token: string;
  expiresAt: string;
  account: Account;
};

type RequestCodeInput = {
  email: string;
  purpose: "signup" | "login";
  language: "ar" | "fr" | "en";
};

type VerifyCodeInput = RequestCodeInput & {
  code: string;
  firstName?: string;
  lastName?: string;
};

export class EmailAuthError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "EmailAuthError";
    this.code = code;
  }
}

async function readStoredSession(): Promise<StoredSession | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? typeof window !== "undefined"
          ? window.localStorage.getItem(SESSION_KEY)
          : null
        : await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (
      !parsed.token ||
      !parsed.expiresAt ||
      !parsed.account?.email ||
      !Number.isFinite(Date.parse(parsed.expiresAt))
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeStoredSession(session: StoredSession): Promise<void> {
  const raw = JSON.stringify(session);
  if (Platform.OS === "web") {
    if (typeof window === "undefined") throw new EmailAuthError("storage_unavailable");
    window.localStorage.setItem(SESSION_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, raw);
}

export async function clearEmailSession(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch {
    // The caller still returns to the signed-out screen.
  }
}

async function postJson<T>(
  action: string,
  payload: unknown,
  token?: string,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new EmailAuthError("api_unavailable");

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    response = await fetch(`${baseUrl}/api/sayarti/auth/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    throw new EmailAuthError("network_error");
  } finally {
    clearTimeout(timeout);
  }

  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    error?: string;
  } & T;
  if (!response.ok) {
    throw new EmailAuthError(body.code ?? body.error ?? "request_failed");
  }
  return body;
}

export async function requestEmailCode(input: RequestCodeInput): Promise<void> {
  await postJson<{ success: true }>("request-code", input);
}

export async function verifyEmailCode(
  input: VerifyCodeInput,
): Promise<Account> {
  const result = await postJson<{
    success: true;
    sessionToken: string;
    expiresAt: string;
    account: Account;
  }>("verify-code", input);
  await writeStoredSession({
    token: result.sessionToken,
    expiresAt: result.expiresAt,
    account: result.account,
  });
  return result.account;
}

export async function restoreEmailSession(): Promise<Account | null> {
  const stored = await readStoredSession();
  if (!stored) return null;
  if (Date.parse(stored.expiresAt) <= Date.now()) {
    await clearEmailSession();
    return null;
  }
  try {
    const result = await postJson<{ success: true; account: Account }>(
      "session",
      {},
      stored.token,
    );
    const updated = { ...stored, account: result.account };
    await writeStoredSession(updated);
    return result.account;
  } catch (error) {
    if (error instanceof EmailAuthError && error.code === "session_invalid") {
      await clearEmailSession();
      return null;
    }
    // A previously verified, unexpired session can still use locally saved car records offline.
    return stored.account;
  }
}

export async function logoutEmailSession(): Promise<void> {
  const stored = await readStoredSession();
  if (stored) {
    try {
      await postJson<{ success: true }>("logout", {}, stored.token);
    } catch {
      // Always clear the device-side session even when the server is unavailable.
    }
  }
  await clearEmailSession();
}
