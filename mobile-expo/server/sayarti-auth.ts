import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import type { Pool, RowDataPacket } from "mysql2/promise";
import mysql from "mysql2/promise";
import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";

import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_MAX_REQUESTS_PER_HOUR,
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
} from "./sayarti-auth-core";

type Purpose = "signup" | "login";
type Language = "ar" | "fr" | "en";
type ChallengeRow = RowDataPacket & {
  id: string;
  email: string;
  purpose: Purpose;
  codeHash: string;
  attempts: number;
  createdAt: Date | string;
  expiresAt: Date | string;
};
type AccountRow = RowDataPacket & {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

const requestCodeSchema = z.object({
  email: z.string().trim().max(320),
  purpose: z.enum(["signup", "login"]),
  language: z.enum(["ar", "fr", "en"]).default("ar"),
});
const verifyCodeSchema = z.object({
  email: z.string().trim().max(320),
  purpose: z.enum(["signup", "login"]),
  language: z.enum(["ar", "fr", "en"]).default("ar"),
  code: z.string().regex(/^\d{6}$/),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

let pool: Pool | null = null;
let transporter: Transporter | null = null;
const ipRequestCounts = new Map<string, { startedAt: number; count: number }>();
const EMAIL_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const IP_REQUEST_LIMIT = 30;

function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("database_unavailable");
  pool = mysql.createPool(url);
  return pool;
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const user = process.env.SAYARTI_GMAIL_USER?.trim();
  const pass = process.env.SAYARTI_GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) throw new Error("email_sender_unavailable");
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function allowIpRequest(req: Request): boolean {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const previous = ipRequestCounts.get(key);
  if (!previous || now - previous.startedAt >= EMAIL_REQUEST_WINDOW_MS) {
    ipRequestCounts.set(key, { startedAt: now, count: 1 });
  } else if (previous.count >= IP_REQUEST_LIMIT) {
    return false;
  } else {
    previous.count += 1;
  }
  if (ipRequestCounts.size > 2_000) {
    for (const [storedKey, value] of ipRequestCounts) {
      if (now - value.startedAt >= EMAIL_REQUEST_WINDOW_MS) {
        ipRequestCounts.delete(storedKey);
      }
    }
  }
  return true;
}

function errorResponse(res: Response, status: number, code: string, extra?: object) {
  res.status(status).json({ success: false, code, ...extra });
}

function emailContent(language: Language, code: string) {
  if (language === "fr") {
    return {
      subject: "Votre code de vérification Sayarti DZ",
      text: `Votre code de vérification Sayarti DZ est ${code}. Il expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#173A2A"><h2>Sayarti DZ</h2><p>Votre code de vérification :</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#114722">${code}</p><p>Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p></div>`,
    };
  }
  if (language === "en") {
    return {
      subject: "Your Sayarti DZ verification code",
      text: `Your Sayarti DZ verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#173A2A"><h2>Sayarti DZ</h2><p>Your verification code:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#114722">${code}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>`,
    };
  }
  return {
    subject: "رمز التحقق من سيارتي DZ",
    text: `رمز التحقق الخاص بك في سيارتي DZ هو ${code}. تنتهي صلاحيته بعد 10 دقائق. إذا لم تطلب هذا الرمز، فتجاهل الرسالة.`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#173A2A"><h2>سيارتي DZ</h2><p>رمز التحقق الخاص بك:</p><p style="direction:ltr;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#114722">${code}</p><p>تنتهي صلاحية الرمز بعد 10 دقائق. إذا لم تطلبه، فتجاهل هذه الرسالة.</p></div>`,
  };
}

export function registerSayartiAuthRoutes(app: Express): void {
  const router = express.Router();

  router.post("/request-code", async (req, res) => {
    const parsed = requestCodeSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 400, "invalid_request");
    const { purpose, language } = parsed.data;
    const email = normalizeEmail(parsed.data.email);
    if (!isValidEmail(email)) return errorResponse(res, 400, "invalid_email");
    if (!allowIpRequest(req)) return errorResponse(res, 429, "request_limit");

    try {
      const db = getPool();
      const [recentRows] = await db.execute<RowDataPacket[]>(
        "SELECT createdAt FROM sayarti_email_challenges WHERE email = ? ORDER BY createdAt DESC LIMIT 1",
        [email],
      );
      const mostRecent = recentRows[0] as { createdAt?: Date | string } | undefined;
      if (mostRecent?.createdAt) {
        const waitSeconds = secondsUntilResend(asDate(mostRecent.createdAt));
        if (waitSeconds > 0) {
          return errorResponse(res, 429, "resend_too_soon", { waitSeconds });
        }
      }

      const [hourRows] = await db.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM sayarti_email_challenges WHERE email = ? AND createdAt >= ?",
        [email, new Date(Date.now() - EMAIL_REQUEST_WINDOW_MS)],
      );
      if (Number((hourRows[0] as { total?: number | string } | undefined)?.total ?? 0) >= EMAIL_CODE_MAX_REQUESTS_PER_HOUR) {
        return errorResponse(res, 429, "request_limit");
      }

      if (purpose === "signup") {
        const [accounts] = await db.execute<RowDataPacket[]>(
          "SELECT id FROM sayarti_accounts WHERE email = ? LIMIT 1",
          [email],
        );
        if (accounts.length > 0) return errorResponse(res, 409, "email_in_use");
      }

      const sender = process.env.SAYARTI_GMAIL_USER?.trim();
      const smtpPassword = process.env.SAYARTI_GMAIL_APP_PASSWORD?.replace(/\s/g, "");
      if (!sender || !smtpPassword) {
        return errorResponse(res, 503, "email_sender_unavailable");
      }

      const code = generateEmailCode();
      const challengeId = randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + EMAIL_CODE_TTL_MS);
      const codeHash = hashEmailCode(
        code,
        challengeId,
        email,
        smtpPassword,
      );
      await db.execute(
        "UPDATE sayarti_email_challenges SET consumedAt = ? WHERE email = ? AND consumedAt IS NULL",
        [now, email],
      );
      await db.execute(
        "INSERT INTO sayarti_email_challenges (id, email, purpose, codeHash, attempts, createdAt, expiresAt, consumedAt) VALUES (?, ?, ?, ?, 0, ?, ?, NULL)",
        [challengeId, email, purpose, codeHash, now, expiresAt],
      );

      const content = emailContent(language, code);
      try {
        await getTransporter().sendMail({
          from: `Sayarti DZ <${sender}>`,
          to: email,
          subject: content.subject,
          text: content.text,
          html: content.html,
        });
      } catch {
        await db.execute(
          "UPDATE sayarti_email_challenges SET consumedAt = ? WHERE id = ?",
          [new Date(), challengeId],
        );
        console.error("[SayartiAuth] Verification email delivery failed");
        return errorResponse(res, 503, "email_delivery_failed");
      }

      return res.json({
        success: true,
        expiresInSeconds: EMAIL_CODE_TTL_MS / 1000,
        resendAfterSeconds: EMAIL_CODE_RESEND_MS / 1000,
      });
    } catch {
      console.error("[SayartiAuth] Failed to request verification code");
      return errorResponse(res, 503, "auth_service_unavailable");
    }
  });

  router.post("/verify-code", async (req, res) => {
    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 400, "invalid_request");
    const input = parsed.data;
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) return errorResponse(res, 400, "invalid_email");
    if (input.purpose === "signup" && (!input.firstName || !input.lastName)) {
      return errorResponse(res, 400, "profile_required");
    }
    if (!allowIpRequest(req)) return errorResponse(res, 429, "request_limit");

    let connection;
    try {
      connection = await getPool().getConnection();
      await connection.beginTransaction();
      const [challengeRows] = await connection.execute<RowDataPacket[]>(
        "SELECT id, email, purpose, codeHash, attempts, createdAt, expiresAt FROM sayarti_email_challenges WHERE email = ? AND purpose = ? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1 FOR UPDATE",
        [email, input.purpose],
      );
      const challenge = challengeRows[0] as ChallengeRow | undefined;
      const now = new Date();
      if (!challenge) {
        await connection.rollback();
        return errorResponse(res, 400, "invalid_or_expired_code");
      }
      if (asDate(challenge.expiresAt).getTime() <= now.getTime()) {
        await connection.execute(
          "UPDATE sayarti_email_challenges SET consumedAt = ? WHERE id = ?",
          [now, challenge.id],
        );
        await connection.commit();
        return errorResponse(res, 400, "invalid_or_expired_code");
      }
      if (Number(challenge.attempts) >= EMAIL_CODE_MAX_ATTEMPTS) {
        await connection.execute(
          "UPDATE sayarti_email_challenges SET consumedAt = ? WHERE id = ?",
          [now, challenge.id],
        );
        await connection.commit();
        return errorResponse(res, 429, "too_many_attempts");
      }

      const smtpPassword = process.env.SAYARTI_GMAIL_APP_PASSWORD?.replace(/\s/g, "");
      if (!smtpPassword) {
        await connection.rollback();
        return errorResponse(res, 503, "email_sender_unavailable");
      }
      const codeMatches = verifyEmailCodeHash(
        input.code,
        challenge.id,
        email,
        smtpPassword,
        challenge.codeHash,
      );
      const attemptsAfterCheck = Number(challenge.attempts) + 1;
      await connection.execute(
        "UPDATE sayarti_email_challenges SET attempts = ?, consumedAt = ? WHERE id = ?",
        [
          attemptsAfterCheck,
          codeMatches || attemptsAfterCheck >= EMAIL_CODE_MAX_ATTEMPTS ? now : null,
          challenge.id,
        ],
      );
      if (!codeMatches) {
        await connection.commit();
        return errorResponse(
          res,
          attemptsAfterCheck >= EMAIL_CODE_MAX_ATTEMPTS ? 429 : 400,
          attemptsAfterCheck >= EMAIL_CODE_MAX_ATTEMPTS
            ? "too_many_attempts"
            : "incorrect_code",
          { attemptsRemaining: Math.max(0, EMAIL_CODE_MAX_ATTEMPTS - attemptsAfterCheck) },
        );
      }

      let account: AccountRow | undefined;
      if (input.purpose === "signup") {
        const [existing] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM sayarti_accounts WHERE email = ? LIMIT 1 FOR UPDATE",
          [email],
        );
        if (existing.length > 0) {
          await connection.commit();
          return errorResponse(res, 409, "email_in_use");
        }
        const id = randomUUID();
        await connection.execute(
          "INSERT INTO sayarti_accounts (id, email, firstName, lastName, createdAt) VALUES (?, ?, ?, ?, ?)",
          [id, email, input.firstName!.trim(), input.lastName!.trim(), now],
        );
        account = {
          id,
          email,
          firstName: input.firstName!.trim(),
          lastName: input.lastName!.trim(),
        } as AccountRow;
      } else {
        const [accounts] = await connection.execute<RowDataPacket[]>(
          "SELECT id, email, firstName, lastName FROM sayarti_accounts WHERE email = ? LIMIT 1 FOR UPDATE",
          [email],
        );
        account = accounts[0] as AccountRow | undefined;
        if (!account) {
          await connection.commit();
          return errorResponse(res, 404, "account_not_found");
        }
      }

      const sessionToken = generateSessionToken();
      const sessionExpiresAt = new Date(now.getTime() + EMAIL_SESSION_TTL_MS);
      await connection.execute(
        "INSERT INTO sayarti_sessions (tokenHash, accountId, createdAt, expiresAt) VALUES (?, ?, ?, ?)",
        [hashSessionToken(sessionToken), account.id, now, sessionExpiresAt],
      );
      await connection.commit();
      return res.json({
        success: true,
        sessionToken,
        expiresAt: sessionExpiresAt.toISOString(),
        account: {
          id: account.id,
          email: account.email,
          firstName: account.firstName,
          lastName: account.lastName,
        },
      });
    } catch {
      if (connection) await connection.rollback().catch(() => undefined);
      console.error("[SayartiAuth] Verification request failed");
      return errorResponse(res, 503, "auth_service_unavailable");
    } finally {
      connection?.release();
    }
  });

  router.post("/session", async (req, res) => {
    const token = readBearerToken(req);
    if (!token) return errorResponse(res, 401, "session_invalid");
    try {
      const db = getPool();
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT a.id, a.email, a.firstName, a.lastName, s.expiresAt FROM sayarti_sessions s INNER JOIN sayarti_accounts a ON a.id = s.accountId WHERE s.tokenHash = ? LIMIT 1",
        [hashSessionToken(token)],
      );
      const account = rows[0] as (AccountRow & { expiresAt: Date | string }) | undefined;
      if (!account || asDate(account.expiresAt).getTime() <= Date.now()) {
        await db.execute("DELETE FROM sayarti_sessions WHERE tokenHash = ?", [hashSessionToken(token)]);
        return errorResponse(res, 401, "session_invalid");
      }
      return res.json({
        success: true,
        account: {
          id: account.id,
          email: account.email,
          firstName: account.firstName,
          lastName: account.lastName,
        },
      });
    } catch {
      console.error("[SayartiAuth] Session lookup failed");
      return errorResponse(res, 503, "auth_service_unavailable");
    }
  });

  router.post("/logout", async (req, res) => {
    const token = readBearerToken(req);
    if (!token) return res.json({ success: true });
    try {
      await getPool().execute(
        "DELETE FROM sayarti_sessions WHERE tokenHash = ?",
        [hashSessionToken(token)],
      );
      return res.json({ success: true });
    } catch {
      console.error("[SayartiAuth] Logout revocation failed");
      return errorResponse(res, 503, "auth_service_unavailable");
    }
  });

  app.use("/api/sayarti/auth", router);
}

function readBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return /^[A-Za-z0-9_-]{40,}$/.test(token) ? token : null;
}
