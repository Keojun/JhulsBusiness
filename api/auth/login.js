const {
  isDbConfigured,
  dbRequest,
  parseBody,
  sendJson,
  setCors,
  handleOptions,
} = require("../../lib/db");
const {
  verifyPassword,
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

    if (!email || !isValidEmail(email)) {
      return sendJson(res, 400, { error: "Valid email is required" });
    }
    if (!password) {
      return sendJson(res, 400, { error: "Password is required" });
    }

    const rows = await dbRequest("GET", "customers", {
      query: `email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
    });

    const customer = Array.isArray(rows) ? rows[0] : null;
    if (!customer || !verifyPassword(password, customer.password_hash)) {
      return sendJson(res, 401, { error: "Invalid email or password" });
    }

    const token = await createSession(customer.id);

    return sendJson(res, 200, {
      token,
      customer: mapCustomer(customer),
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
