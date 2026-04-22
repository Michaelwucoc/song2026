import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "admin_session";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "";
}

function getSessionTtlSeconds() {
  const raw = Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? "43200"); // 12h
  if (!Number.isFinite(raw) || raw <= 0) return 43200;
  return Math.min(Math.floor(raw), 7 * 24 * 60 * 60);
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function sign(issuedAtSec: number) {
  const secret = getAdminPassword();
  return sha256(`${secret}:${issuedAtSec}`);
}

export async function verifyAdminSession() {
  const secret = getAdminPassword();
  if (!secret) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;

  const issuedAtSec = Number(parts[1]);
  if (!Number.isFinite(issuedAtSec)) return false;

  const expected = sign(issuedAtSec);
  const provided = parts[2];
  if (expected.length !== provided.length) return false;

  const ok = timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  if (!ok) return false;

  const ttl = getSessionTtlSeconds();
  const age = Math.floor(Date.now() / 1000) - issuedAtSec;
  return age >= 0 && age <= ttl;
}

export function buildAdminSessionToken() {
  const issuedAtSec = Math.floor(Date.now() / 1000);
  return `v1.${issuedAtSec}.${sign(issuedAtSec)}`;
}

export const adminCookie = {
  name: ADMIN_COOKIE,
  maxAgeSeconds: getSessionTtlSeconds,
};

