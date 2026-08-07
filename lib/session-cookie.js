/**
 * Signed session cookies — HttpOnly, verified on edge middleware and API.
 */

const crypto = require("crypto");

const SESSION_COOKIE = "rbxdisc_session";
const SESSION_DAYS = 30;

function getSessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "rbxdisc-dev-secret-set-env-in-production"
  );
}

function signSessionToken(rawToken) {
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(rawToken).digest("hex");
  return `${rawToken}.${sig}`;
}

function verifySessionToken(signedValue) {
  if (!signedValue || typeof signedValue !== "string") return null;
  const dot = signedValue.lastIndexOf(".");
  if (dot <= 0) return null;

  const raw = signedValue.slice(0, dot);
  const sig = signedValue.slice(dot + 1);
  const expected = crypto.createHmac("sha256", getSessionSecret()).update(raw).digest("hex");

  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }

  return raw;
}

function parseCookies(req) {
  const header = req.headers.cookie || req.headers.Cookie || "";
  const cookies = {};
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function getRawSessionToken(req) {
  const cookies = parseCookies(req);
  const fromCookie = cookies[SESSION_COOKIE];
  if (fromCookie) {
    return verifySessionToken(fromCookie);
  }

  const auth = req.headers.authorization || req.headers.Authorization || "";
  if (auth.startsWith("Bearer ")) {
    return verifySessionToken(auth.slice(7).trim());
  }

  return null;
}

function setSessionCookie(res, rawToken) {
  const signed = signSessionToken(rawToken);
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(signed)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

module.exports = {
  SESSION_COOKIE,
  SESSION_DAYS,
  getSessionSecret,
  signSessionToken,
  verifySessionToken,
  parseCookies,
  getRawSessionToken,
  setSessionCookie,
  clearSessionCookie,
};
