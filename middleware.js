import { NextResponse } from "@vercel/edge";

const SESSION_COOKIE = "rbxdisc_session";

function getSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
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

export const config = {
  matcher: ["/", "/index", "/index.html", "/gakuran", "/gakuran.html"],
};

export default async function middleware(request) {
  const secret = getSecret();
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (cookie && secret && (await verifySessionToken(cookie, secret))) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
