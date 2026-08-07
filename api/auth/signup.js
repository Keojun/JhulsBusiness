const {
  isDbConfigured,
  dbRequest,
  parseBody,
  sendJson,
  setCors,
  handleOptions,
} = require("../../lib/db");
const {
  hashPassword,
  createSession,
  sanitizeEmail,
  isValidEmail,
  mapCustomer,
} = require("../../lib/auth");

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    const body = await parseBody(req);
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

    return sendJson(res, 201, {
      token,
      customer: mapCustomer(customer),
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
