const {
  isDbConfigured,
  dbRequest,
  checkAdmin,
  parseBody,
  sendJson,
} = require("../lib/db");

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

    if (req.method === "OPTIONS") return res.status(200).end();

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    const body = await parseBody(req);

    if (req.method === "GET") {
      if (!checkAdmin(req, body)) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }

      const data = await dbRequest("GET", "orders", {
        query: "select=*&order=created_at.desc",
      });

      const orders = (Array.isArray(data) ? data : []).map((o) => ({
        id: o.id,
        username: o.username,
        rerollAmount: o.reroll_amount,
        status: o.status,
        reviewCode: o.review_code,
        date: new Date(o.created_at).toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        createdAt: o.created_at,
      }));

      return sendJson(res, 200, orders);
    }

    if (req.method === "POST") {
      const { id, username, rerollAmount, status, createdAt } = body;

      if (!id || !username || !rerollAmount) {
        return sendJson(res, 400, { error: "Missing required fields" });
      }

      const rows = await dbRequest("POST", "orders", {
        body: {
          id,
          username,
          reroll_amount: Number(rerollAmount),
          status: status || "pending",
          created_at: createdAt || new Date().toISOString(),
        },
        prefer: "return=representation",
      });

      const data = Array.isArray(rows) ? rows[0] : rows;

      return sendJson(res, 201, {
        id: data.id,
        username: data.username,
        rerollAmount: data.reroll_amount,
        status: data.status,
        savedToDb: true,
        date: new Date(data.created_at).toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        createdAt: data.created_at,
      });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
