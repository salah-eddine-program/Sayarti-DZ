import { describe, expect, it } from "vitest";

import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_RESEND_MS,
  EMAIL_CODE_TTL_MS,
  EMAIL_SESSION_TTL_MS,
  generateEmailCode,
  generateSessionToken,
  hashEmailCode,
  hashSessionToken,
  isValidEmail,
  normalizeEmail,
  secondsUntilResend,
  verifyEmailCodeHash,
} from "../server/sayarti-auth-core";

describe("Sayarti email verification security helpers", () => {
  it("normalizes and validates email addresses", () => {
    expect(normalizeEmail("  Driver@Example.DZ ")).toBe("driver@example.dz");
    expect(isValidEmail("driver@example.dz")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("x@a" )).toBe(false);
  });

  it("generates exactly six decimal digits, including leading zeroes", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateEmailCode()).toMatch(/^\d{6}$/);
    }
  });

  it("stores a keyed digest rather than the code and checks it in constant time", () => {
    const hash = hashEmailCode("012345", "challenge-1", "Driver@Example.DZ", "smtp-secret");
    expect(hash).toMatch(/^[a-f\d]{64}$/);
    expect(hash).not.toContain("012345");
    expect(verifyEmailCodeHash("012345", "challenge-1", "driver@example.dz", "smtp-secret", hash)).toBe(true);
    expect(verifyEmailCodeHash("012346", "challenge-1", "driver@example.dz", "smtp-secret", hash)).toBe(false);
    expect(verifyEmailCodeHash("12x345", "challenge-1", "driver@example.dz", "smtp-secret", hash)).toBe(false);
    expect(verifyEmailCodeHash("012345", "other-challenge", "driver@example.dz", "smtp-secret", hash)).toBe(false);
  });

  it("enforces the requested expiration, resend, and attempt limits", () => {
    expect(EMAIL_CODE_TTL_MS).toBe(10 * 60 * 1000);
    expect(EMAIL_CODE_RESEND_MS).toBe(60 * 1000);
    expect(EMAIL_CODE_MAX_ATTEMPTS).toBe(5);
    expect(EMAIL_SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    const createdAt = new Date("2026-11-10T12:00:00Z");
    expect(secondsUntilResend(createdAt, createdAt.getTime())).toBe(60);
    expect(secondsUntilResend(createdAt, createdAt.getTime() + 59_001)).toBe(1);
    expect(secondsUntilResend(createdAt, createdAt.getTime() + 60_000)).toBe(0);
  });

  it("creates opaque session tokens and persists only their one-way hashes", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[\w-]{40,}$/);
    expect(hashSessionToken(first)).toMatch(/^[a-f\d]{64}$/);
    expect(hashSessionToken(first)).not.toBe(first);
  });
});
