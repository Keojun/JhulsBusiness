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
const { ORDER_STATUSES, isActiveOrderStatus } = require("../lib/order-status");

function mapOrderRow(o) {
  return {
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
  };
}

async function getOrderById(orderId) {
  const rows = await dbRequest("GET", "orders", {
    query: `id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function findDuplicateActiveOrder(customerId, rerollAmount, excludeId = null) {
  const rows = await dbRequest("GET", "orders", {
    query: `customer_id=eq.${customerId}&reroll_amount=eq.${Number(rerollAmount)}&select=id,status,created_at&order=created_at.desc`,
  });
  const orders = Array.isArray(rows) ? rows : [];
  const cutoff = Date.now() - 30 * 60 * 1000;

  return orders.find((o) => {
    if (excludeId && o.id === excludeId) return false;
    if (!isActiveOrderStatus(o.status)) return false;
    return new Date(o.created_at).getTime() >= cutoff;
  });
}

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
      const isAdmin = checkAdmin(req, body);
      const customer = !isAdmin ? await getCustomerFromRequest(req) : null;

      if (!isAdmin && !customer) {
        return sendJson(res, 401, { error: "Login required" });
      }

      let query = "select=*&order=created_at.desc";
      if (!isAdmin) {
        query = `customer_id=eq.${customer.id}&select=*&order=created_at.desc`;
      }

      const data = await dbRequest("GET", "orders", { query });
      const orders = (Array.isArray(data) ? data : []).map(mapOrderRow);
      return sendJson(res, 200, orders);
    }

    if (req.method === "POST") {
      if (body.action === "void") {
        if (!checkAdmin(req, body)) {
          return sendJson(res, 401, { error: "Unauthorized" });
        }

        const { orderId } = body;
        if (!orderId) return sendJson(res, 400, { error: "orderId required" });

        const order = await getOrderById(orderId);
        if (!order) return sendJson(res, 404, { error: "Order not found" });
        if (order.status === ORDER_STATUSES.VOIDED) {
          return sendJson(res, 400, { error: "Order is already voided" });
        }

        await dbRequest("PATCH", "orders", {
          query: `id=eq.${encodeURIComponent(orderId)}`,
          body: { status: ORDER_STATUSES.VOIDED, review_code: null },
          prefer: "return=minimal",
        });

        await dbRequest("DELETE", "review_codes", {
          query: `order_id=eq.${encodeURIComponent(orderId)}`,
          prefer: "return=minimal",
        });

        return sendJson(res, 200, { ok: true, orderId, status: ORDER_STATUSES.VOIDED });
      }

      if (body.action === "verify") {
        if (!checkAdmin(req, body)) {
          return sendJson(res, 401, { error: "Unauthorized" });
        }

        const { orderId } = body;
        if (!orderId) return sendJson(res, 400, { error: "orderId required" });

        const order = await getOrderById(orderId);
        if (!order) return sendJson(res, 404, { error: "Order not found" });
        if (order.status !== ORDER_STATUSES.PENDING) {
          return sendJson(res, 400, {
            error: "Only orders awaiting payment verification can be marked as processing",
          });
        }

        await dbRequest("PATCH", "orders", {
          query: `id=eq.${encodeURIComponent(orderId)}`,
          body: { status: ORDER_STATUSES.PROCESSING },
          prefer: "return=minimal",
        });

        return sendJson(res, 200, { ok: true, orderId, status: ORDER_STATUSES.PROCESSING });
      }

      if (body.action === "complete") {
        if (!checkAdmin(req, body)) {
          return sendJson(res, 401, { error: "Unauthorized" });
        }

        const { orderId } = body;
        if (!orderId) return sendJson(res, 400, { error: "orderId required" });

        const order = await getOrderById(orderId);
        if (!order) return sendJson(res, 404, { error: "Order not found" });
        if (order.status !== ORDER_STATUSES.PROCESSING) {
          return sendJson(res, 400, {
            error: "Mark the order as Processing (payment verified) before completing",
          });
        }

        const code = generateReviewCode();

        await dbRequest("POST", "review_codes", {
          body: { code, order_id: orderId, used: false },
          prefer: "return=minimal",
        });

        await dbRequest("PATCH", "orders", {
          query: `id=eq.${encodeURIComponent(orderId)}`,
          body: { status: ORDER_STATUSES.COMPLETED, review_code: code },
          prefer: "return=minimal",
        });

        return sendJson(res, 200, { code, orderId });
      }

      if (body.action === "confirm_payment") {
        const customer = await getCustomerFromRequest(req);
        if (!customer) return sendJson(res, 401, { error: "Login required" });

        const { orderId, paymentMethod } = body;
        if (!orderId) return sendJson(res, 400, { error: "orderId required" });

        const order = await getOrderById(orderId);
        if (!order) return sendJson(res, 404, { error: "Order not found" });
        if (order.customer_id !== customer.id) {
          return sendJson(res, 403, { error: "This order is not linked to your account" });
        }

        const allowed = [ORDER_STATUSES.AWAITING_PAYMENT, ORDER_STATUSES.PENDING];
        if (!allowed.includes(order.status)) {
          return sendJson(res, 400, { error: "This order cannot be updated" });
        }

        const patch = {
          status: ORDER_STATUSES.PENDING,
          payment_method: paymentMethod || order.payment_method,
        };

        await dbRequest("PATCH", "orders", {
          query: `id=eq.${encodeURIComponent(orderId)}`,
          body: patch,
          prefer: "return=minimal",
        });

        const updated = await getOrderById(orderId);
        return sendJson(res, 200, mapOrderRow(updated));
      }

      const { id, username, rerollAmount, pricePHP, paymentMethod, status, createdAt } = body;

      if (!id || !username || !rerollAmount) {
        return sendJson(res, 400, { error: "Missing required fields" });
      }

      const customer = await getCustomerFromRequest(req);
      if (!customer) {
        return sendJson(res, 401, { error: "Login required to place orders" });
      }

      const existing = await getOrderById(id);
      if (existing) {
        if (existing.customer_id !== customer.id) {
          return sendJson(res, 403, { error: "Order ID conflict" });
        }
        return sendJson(res, 200, mapOrderRow(existing));
      }

      const duplicate = await findDuplicateActiveOrder(customer.id, rerollAmount);
      if (duplicate) {
        return sendJson(res, 409, {
          error: "You already have an active order in progress. Finish or wait before placing another.",
          existingOrderId: duplicate.id,
        });
      }

      const normalizedUsername = String(username).trim();
      const initialStatus = status || ORDER_STATUSES.AWAITING_PAYMENT;

      const row = {
        id,
        username: normalizedUsername,
        reroll_amount: Number(rerollAmount),
        status: initialStatus,
        created_at: createdAt || new Date().toISOString(),
        customer_id: customer.id,
      };

      if (pricePHP != null) row.price_php = Number(pricePHP);
      if (paymentMethod) row.payment_method = paymentMethod;

      const rows = await dbRequest("POST", "orders", {
        body: row,
        prefer: "return=representation",
      });

      const data = Array.isArray(rows) ? rows[0] : rows;
      return sendJson(res, 201, { ...mapOrderRow(data), savedToDb: true });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
