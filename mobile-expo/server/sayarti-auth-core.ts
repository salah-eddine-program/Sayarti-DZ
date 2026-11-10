import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_CODE_RESEND_MS = 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
export const EMAIL_CODE_MAX_REQUESTS_PER_HOUR = 5;
export const EMAIL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function generateEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashEmailCode(
  code: string,
  challengeId: string,
  email: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${challengeId}:${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

export function verifyEmailCodeHash(
  suppliedCode: string,
  challengeId: string,
  email: string,
  secret: string,
  expectedHash: string,
): boolean {
  if (!/^\d{6}$/.test(suppliedCode) || !/^[a-f\d]{64}$/i.test(expectedHash)) {
    return false;
  }
  const suppliedHash = Buffer.from(
    hashEmailCode(suppliedCode, challengeId, email, secret),
    "hex",
  );
  const expected = Buffer.from(expectedHash, "hex");
  return suppliedHash.length === expected.length && timingSafeEqual(suppliedHash, expected);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function secondsUntilResend(createdAt: Date, now = Date.now()): number {
  return Math.max(0, Math.ceil((createdAt.getTime() + EMAIL_CODE_RESEND_MS - now) / 1000));
}
