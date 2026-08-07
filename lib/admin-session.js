/**
 * Signed HttpOnly admin session cookie (30 days, same as customer sessions).
 */

const crypto = require("crypto");
const { SESSION_DAYS, getSessionSecret, parseCookies } = require("./session-cookie");

const ADMIN_COOKIE = "rbxdisc_admin";

function signPayload(payloadB64) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payloadB64).digest("hex");
}

function createAdminSessionValue() {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payloadB64 = Buffer.from(JSON.stringify({ role: "admin", exp })).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

function verifyAdminSessionValue(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return false;

  let value = rawValue;
  try {
    value = decodeURIComponent(rawValue);
  } catch {
    value = rawValue;
  }

  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;

  const payloadB64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = signPayload(payloadB64);

  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (payload.role !== "admin" || !payload.exp) return false;
    if (Date.now() > Number(payload.exp)) return false;
    return true;
  } catch {
    return false;
  }
}

function isAdminSessionValid(req) {
  const cookies = parseCookies(req);
  return verifyAdminSessionValue(cookies[ADMIN_COOKIE]);
}

function setAdminSessionCookie(res) {
  const value = createAdminSessionValue();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearAdminSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

module.exports = {
  ADMIN_COOKIE,
  isAdminSessionValid,
  setAdminSessionCookie,
  clearAdminSessionCookie,
};
