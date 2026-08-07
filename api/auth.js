const {
  isDbConfigured,
  dbRequest,
  parseBody,
  checkAdmin,
  sendJson,
  setCors,
  handleOptions,
} = require("../lib/db");
const {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getBearerToken,
  getCustomerFromRequest,
  sanitizeEmail,
  isValidEmail,
  mapCustomer,
} = require("../lib/auth");

function getAction(req, body) {
  const url = new URL(req.url || "/", "http://localhost");
  return (
    url.searchParams.get("action") ||
    body.action ||
    ""
  ).toLowerCase();
}

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    const body = await parseBody(req);
    const action = getAction(req, body);

    if (action === "admin-login") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
      const password = body.password || "";
      if (checkAdmin(req, { password })) {
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 401, { ok: false, error: "Incorrect password" });
    }

    if (action === "logout") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
      const token = getBearerToken(req) || body.token;
      if (isDbConfigured() && token) await deleteSession(token);
      return sendJson(res, 200, { ok: true });
    }

    if (action === "me") {
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
      if (!isDbConfigured()) {
        return sendJson(res, 503, { error: "Database not configured", fallback: true });
      }
      const customer = await getCustomerFromRequest(req);
      if (!customer) return sendJson(res, 401, { error: "Not logged in" });
      return sendJson(res, 200, { customer });
    }

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    if (action === "signup") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

      const email = sanitizeEmail(body.email);
      const password = String(body.password || "");
      const robloxUsername = String(body.robloxUsername || body.roblox_username || "").trim();
      const displayName = String(body.displayName || body.display_name || robloxUsername).trim();

      if (!email || !isValidEmail(email)) {
        return sendJson(res, 400, { error: "Valid email is required" });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: "Password must be at least 6 characters" });
      }
      if (!robloxUsername) {
        return sendJson(res, 400, { error: "Roblox username is required" });
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
      return sendJson(res, 201, { token, customer: mapCustomer(customer) });
    }

    if (action === "login") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

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
        return sendJson(res, 401, { error: "Invalid email or password" });
      }

      const token = await createSession(customer.id);
      return sendJson(res, 200, { token, customer: mapCustomer(customer) });
    }

    return sendJson(res, 400, {
      error: "Unknown action. Use ?action=signup|login|logout|me|admin-login",
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
