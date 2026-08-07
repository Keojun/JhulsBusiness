/**
 * Simple in-memory rate limiter (per serverless instance).
 */

const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function rateLimit(req, { key, limit = 10, windowMs = 15 * 60 * 1000 }) {
  const ip = getClientIp(req);
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();

  let entry = buckets.get(bucketKey);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  return { ok: true, remaining: limit - entry.count };
}

module.exports = { rateLimit, getClientIp };
