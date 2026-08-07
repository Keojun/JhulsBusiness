/**
 * Customer auth — password hashing and session tokens (no npm deps).
 */

const crypto = require("crypto");
const { dbRequest, isDbConfigured } = require("./db");

const SESSION_DAYS = 30;
const TOKEN_BYTES = 32;

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "rbxdisc-session-secret";
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const attempt = crypto.scryptSync(password, salt, 64).toString("hex");
  if (hash.length !== attempt.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
  } catch {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString();
}

async function createSession(customerId) {
  const token = generateToken();
  await dbRequest("POST", "customer_sessions", {
    body: {
      token,
      customer_id: customerId,
      expires_at: sessionExpiry(),
    },
    prefer: "return=representation",
  });
  return token;
}

async function deleteSession(token) {
  if (!token) return;
  try {
    await dbRequest("DELETE", "customer_sessions", {
      query: `token=eq.${encodeURIComponent(token)}`,
    });
  } catch (_) {}
}

async function getCustomerByToken(token) {
  if (!token || !isDbConfigured()) return null;

  const sessions = await dbRequest("GET", "customer_sessions", {
    query: `token=eq.${encodeURIComponent(token)}&select=customer_id,expires_at&limit=1`,
  });

  const session = Array.isArray(sessions) ? sessions[0] : null;
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    await deleteSession(token);
    return null;
  }

  const customers = await dbRequest("GET", "customers", {
    query: `id=eq.${session.customer_id}&select=id,email,roblox_username,display_name,created_at&limit=1`,
  });

  const customer = Array.isArray(customers) ? customers[0] : null;
  if (!customer) return null;

  return {
    id: customer.id,
    email: customer.email,
    robloxUsername: customer.roblox_username,
    displayName: customer.display_name || customer.roblox_username,
    createdAt: customer.created_at,
  };
}

function getBearerToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

async function getCustomerFromRequest(req) {
  return getCustomerByToken(getBearerToken(req));
}

function sanitizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function mapCustomer(row) {
  return {
    id: row.id,
    email: row.email,
    robloxUsername: row.roblox_username,
    displayName: row.display_name || row.roblox_username,
    createdAt: row.created_at,
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getCustomerByToken,
  getBearerToken,
  getCustomerFromRequest,
  sanitizeEmail,
  isValidEmail,
  mapCustomer,
  getSessionSecret,
};
