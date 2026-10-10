import { describe, expect, it } from "vitest";
import { authCopy, getAuthErrorMessage, validateAuthFields } from "./auth";

const validFields = { name: "Driver", email: "driver@example.com", password: "secret", confirmation: "secret" };

describe("auth validation", () => {
  it("requires a valid email and at least six password characters", () => {
    expect(validateAuthFields({ name: "", email: "invalid", password: "12345", confirmation: "" }, "login", "en"))
      .toEqual({ email: authCopy.en.invalidEmail, password: authCopy.en.shortPassword });
    for (const email of ["", "name@", "@domain.test", "name@domain", "a b@domain.test", "a@@b.test"]) {
      expect(validateAuthFields({ ...validFields, email }, "login", "ar").email).toBe(authCopy.ar.invalidEmail);
    }
  });

  it("trims only the email for validation and accepts six-character passwords", () => {
    expect(validateAuthFields({ ...validFields, email: " driver@example.com " }, "signup", "en")).toEqual({});
    expect(validateAuthFields({ ...validFields, password: " pass ", confirmation: " pass " }, "signup", "en")).toEqual({});
  });

  it("requires matching confirmation only during explicit sign-up", () => {
    expect(validateAuthFields({ ...validFields, confirmation: "different" }, "signup", "ar"))
      .toEqual({ confirmation: authCopy.ar.mismatch });
    expect(validateAuthFields({ ...validFields, confirmation: "" }, "login", "en")).toEqual({});
  });
});

describe("safe auth error messages", () => {
  it("does not distinguish a missing account from an incorrect password", () => {
    expect(getAuthErrorMessage({ code: "user_not_found" }, "ar"))
      .toBe(getAuthErrorMessage({ code: "invalid_credentials" }, "ar"));
  });

  it.each([
    ["email_not_confirmed", "unconfirmed"],
    ["weak_password", "weakPassword"],
    ["email_address_invalid", "invalidEmail"],
    ["validation_failed", "invalidEmail"],
    ["over_request_rate_limit", "rateLimited"],
    ["over_email_send_rate_limit", "rateLimited"],
    ["user_already_exists", "signupFailed"],
    ["email_exists", "signupFailed"],
    ["signup_disabled", "unavailable"],
    ["email_provider_disabled", "unavailable"],
    ["request_timeout", "connectionError"],
  ] as const)("maps %s to localized actionable copy", (code, message) => {
    for (const lang of ["ar", "en", "fr"] as const) {
      expect(getAuthErrorMessage({ code, message: "internal response should not appear" }, lang)).toBe(authCopy[lang][message]);
    }
  });

  it("handles network exceptions, status codes, and unknown errors without raw details", () => {
    expect(getAuthErrorMessage(new TypeError("private network URL"), "en")).toBe(authCopy.en.connectionError);
    expect(getAuthErrorMessage({ name: "AuthRetryableFetchError" }, "en")).toBe(authCopy.en.connectionError);
    expect(getAuthErrorMessage({ status: 429 }, "en")).toBe(authCopy.en.rateLimited);
    expect(getAuthErrorMessage({ status: 503 }, "ar")).toBe(authCopy.ar.unavailable);
    for (const error of [null, "private response", new Error("private key"), { code: "unknown", message: "private database detail" }]) {
      expect(getAuthErrorMessage(error, "en")).toBe(authCopy.en.genericError);
    }
  });
});
