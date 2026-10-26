import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Single-user app: one password (APP_PASSWORD) guards everything.
// The session cookie holds an HMAC derived from it, so changing the
// password signs every device out.

export const SESSION_COOKIE = "log_session";
export const TZ_COOKIE = "log_tz";

export function passwordConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

function expectedToken(): string | null {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  const secret = process.env.SESSION_SECRET || password;
  return createHmac("sha256", secret).update(`log-session:${password}`).digest("hex");
}

export function sessionToken(): string | null {
  return expectedToken();
}

export function isValidSession(token: string | undefined): boolean {
  const expected = expectedToken();
  // Without a password, only local development is open.
  if (!expected) return process.env.NODE_ENV !== "production";
  if (!token || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function passwordMatches(input: string): boolean {
  const password = process.env.APP_PASSWORD;
  if (!password) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(password).digest();
  return timingSafeEqual(a, b);
}
