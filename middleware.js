/**
 * Vercel Edge Middleware — login gate for protected pages.
 * Uses standard Web APIs only (no @vercel/edge / Next.js imports).
 */

const SESSION_COOKIE = "rbxdisc_session";

export const config = {
  matcher: ["/", "/index", "/index.html", "/gakuran", "/gakuran.html"],
};

function getSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function getCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  const parts = header.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySessionToken(signedValue, secret) {
  if (!signedValue || !secret) return false;

  let decoded = signedValue;
  try {
    decoded = decodeURIComponent(signedValue);
  } catch {
    decoded = signedValue;
  }

  const dot = decoded.lastIndexOf(".");
  if (dot <= 0) return false;

  const raw = decoded.slice(0, dot);
  const sig = decoded.slice(dot + 1);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  const expected = bytesToHex(mac);

  return timingSafeEqual(sig, expected);
}

export default async function middleware(request) {
  const secret = getSecret();
  const cookie = getCookie(request, SESSION_COOKIE);

  if (cookie && secret && (await verifySessionToken(cookie, secret))) {
    return new Response(null, {
      headers: { "x-middleware-next": "1" },
    });
  }

  const url = new URL(request.url);
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("redirect", url.pathname);

  return Response.redirect(loginUrl.toString(), 307);
}
