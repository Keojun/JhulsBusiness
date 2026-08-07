const {
  isDbConfigured,
  dbRequest,
  checkAdmin,
  parseBody,
  sendJson,
  generateReviewCode,
} = require("../lib/db");
const { formatPhilippinesDateTime } = require("../lib/datetime");
const { getCustomerFromRequest } = require("../lib/auth");

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password, Authorization");

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
        pricePHP: o.price_php != null ? Number(o.price_php) : null,
        paymentMethod: o.payment_method || null,
        customerId: o.customer_id || null,
        status: o.status,
        reviewCode: o.review_code,
        date: formatPhilippinesDateTime(o.created_at),
        createdAt: o.created_at,
      }));

      return sendJson(res, 200, orders);
    }

    if (req.method === "POST") {
      if (body.action === "complete") {
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
      }

      const { id, username, rerollAmount, pricePHP, paymentMethod, status, createdAt } = body;

      if (!id || !username || !rerollAmount) {
        return sendJson(res, 400, { error: "Missing required fields" });
      }

      const row = {
        id,
        username,
        reroll_amount: Number(rerollAmount),
        status: status || "pending",
        created_at: createdAt || new Date().toISOString(),
      };

      if (pricePHP != null) row.price_php = Number(pricePHP);
      if (paymentMethod) row.payment_method = paymentMethod;

      const customer = await getCustomerFromRequest(req);
      if (customer) row.customer_id = customer.id;

      const rows = await dbRequest("POST", "orders", {
        body: row,
        prefer: "return=representation",
      });

      const data = Array.isArray(rows) ? rows[0] : rows;

      return sendJson(res, 201, {
        id: data.id,
        username: data.username,
        rerollAmount: data.reroll_amount,
        pricePHP: data.price_php != null ? Number(data.price_php) : null,
        paymentMethod: data.payment_method || null,
        status: data.status,
        savedToDb: true,
        date: formatPhilippinesDateTime(data.created_at),
        createdAt: data.created_at,
      });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
