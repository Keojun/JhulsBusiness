const {
  isDbConfigured,
  dbRequest,
  parseBody,
  checkAdmin,
  sendJson,
  setCors,
  handleOptions,
} = require("../lib/db");
const { getRawSessionToken, setSessionCookie, clearSessionCookie } = require("../lib/session-cookie");
const {
  isAdminSessionValid,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} = require("../lib/admin-session");
const {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getCustomerFromRequest,
  sanitizeEmail,
  isValidEmail,
  mapCustomer,
} = require("../lib/auth");
const { rateLimit } = require("../lib/rate-limit");

function getAction(req, body) {
  const url = new URL(req.url || "/", "http://localhost");
  return (url.searchParams.get("action") || body.action || "").toLowerCase();
}

function authFailure(res, message, status = 401) {
  return sendJson(res, status, { error: message });
}

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    const body = await parseBody(req);
    const action = getAction(req, body);

    if (action === "admin-login") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

      const limit = rateLimit(req, { key: "admin-login", limit: 8, windowMs: 15 * 60 * 1000 });
      if (!limit.ok) {
        return sendJson(res, 429, { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` });
      }

      const password = body.password || "";
      if (checkAdmin(req, { password })) {
        setAdminSessionCookie(res);
        return sendJson(res, 200, { ok: true });
      }
      return authFailure(res, "Incorrect password");
    }

    if (action === "admin-me") {
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
      if (isAdminSessionValid(req)) {
        return sendJson(res, 200, { ok: true });
      }
      return authFailure(res, "Not logged in");
    }

    if (action === "admin-logout") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
      clearAdminSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (action === "logout") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

      const rawToken = getRawSessionToken(req);
      if (isDbConfigured() && rawToken) await deleteSession(rawToken);
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (action === "me") {
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
      if (!isDbConfigured()) {
        return sendJson(res, 503, { error: "Database not configured", fallback: true });
      }

      const customer = await getCustomerFromRequest(req);
      if (!customer) return authFailure(res, "Not logged in");
      return sendJson(res, 200, { customer });
    }

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    if (action === "signup") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

      const limit = rateLimit(req, { key: "signup", limit: 6, windowMs: 60 * 60 * 1000 });
      if (!limit.ok) {
        return sendJson(res, 429, { error: `Too many signups. Try again in ${limit.retryAfterSec}s.` });
      }

      const email = sanitizeEmail(body.email);
      const password = String(body.password || "");
      const robloxUsername = String(body.robloxUsername || body.roblox_username || "").trim();
      const displayName = String(body.displayName || body.display_name || robloxUsername).trim();

      if (!email || !isValidEmail(email)) {
        return sendJson(res, 400, { error: "Valid email is required" });
      }
      if (password.length < 8) {
        return sendJson(res, 400, { error: "Password must be at least 8 characters" });
      }
      if (!robloxUsername || robloxUsername.length > 32) {
        return sendJson(res, 400, { error: "Valid Roblox username is required" });
      }

      const existing = await dbRequest("GET", "customers", {
        query: `email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      });
      if (Array.isArray(existing) && existing.length > 0) {
        return sendJson(res, 409, { error: "An account with this email already exists. Try logging in." });
      }

      const rows = await dbRequest("POST", "customers", {
        body: {
          email,
          roblox_username: robloxUsername,
          display_name: displayName,
          password_hash: hashPassword(password),
        },
        prefer: "return=representation",
      });

      const customer = Array.isArray(rows) ? rows[0] : rows;
      const token = await createSession(customer.id);
      setSessionCookie(res, token);
      return sendJson(res, 201, { customer: mapCustomer(customer) });
    }

    if (action === "login") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

      const limit = rateLimit(req, { key: "login", limit: 12, windowMs: 15 * 60 * 1000 });
      if (!limit.ok) {
        return sendJson(res, 429, { error: `Too many login attempts. Try again in ${limit.retryAfterSec}s.` });
      }

      const email = sanitizeEmail(body.email);
      const password = String(body.password || "");

      if (!email || !isValidEmail(email)) {
        return sendJson(res, 400, { error: "Valid email is required" });
      }
      if (!password) return sendJson(res, 400, { error: "Password is required" });

      const rows = await dbRequest("GET", "customers", {
        query: `email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
      });

      const customer = Array.isArray(rows) ? rows[0] : null;
      if (!customer || !verifyPassword(password, customer.password_hash)) {
        return authFailure(res, "Invalid email or password");
      }

      const token = await createSession(customer.id);
      setSessionCookie(res, token);
      return sendJson(res, 200, { customer: mapCustomer(customer) });
    }

    return sendJson(res, 400, {
      error: "Unknown action. Use ?action=signup|login|logout|me|admin-login|admin-me|admin-logout",
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
