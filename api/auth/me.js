const {
  isDbConfigured,
  sendJson,
  setCors,
  handleOptions,
} = require("../../lib/db");
const { getCustomerFromRequest } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    const customer = await getCustomerFromRequest(req);
    if (!customer) {
      return sendJson(res, 401, { error: "Not logged in" });
    }

    return sendJson(res, 200, { customer });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
