const {
  isDbConfigured,
  dbRequest,
  checkAdmin,
  parseBody,
  sendJson,
  generateReviewCode,
} = require("../../lib/db");

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    const body = await parseBody(req);

    if (!checkAdmin(req, body)) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }

    const { orderId } = body;
    if (!orderId) return sendJson(res, 400, { error: "orderId required" });

    const code = generateReviewCode();

    await dbRequest("POST", "review_codes", {
      body: { code, order_id: orderId, used: false },
      prefer: "return=minimal",
    });

    await dbRequest("PATCH", "orders", {
      query: `id=eq.${encodeURIComponent(orderId)}`,
      body: { status: "completed", review_code: code },
      prefer: "return=minimal",
    });

    return sendJson(res, 200, { code, orderId });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
