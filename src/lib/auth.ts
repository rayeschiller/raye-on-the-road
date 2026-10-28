import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "rotr_session";

function secret() {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SITE_PASSWORD || "dev-secret";
}

export function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function sessionToken() {
  const v = "ok";
  return `${v}.${sign(v)}`;
}

export function verifySession(token: string | undefined | null) {
  if (!token) return false;
  const [v, sig] = token.split(".");
  if (!v || !sig) return false;
  const expected = sign(v);
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function checkPassword(input: string) {
  const pw = (process.env.SITE_PASSWORD || "").trim();
  if (!pw) return !process.env.VERCEL_ENV; // no password: allowed only in local dev
  const given = (input || "").trim();
  const a = Buffer.from(pw);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Token for one-click unsubscribe links */
export function unsubToken(email: string) {
  return sign(`unsub:${email.toLowerCase()}`);
}

export function verifyUnsub(email: string, token: string) {
  const expected = unsubToken(email);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
