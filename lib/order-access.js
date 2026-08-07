/**
 * Verify an order belongs to the logged-in customer.
 */

const { dbRequest } = require("./db");

async function assertOrderOwnedByCustomer(orderId, customer) {
  if (!orderId || !customer?.id) {
    return { ok: false, status: 400, error: "Invalid order" };
  }

  const rows = await dbRequest("GET", "orders", {
    query: `id=eq.${encodeURIComponent(orderId)}&select=id,customer_id&limit=1`,
  });

  const order = Array.isArray(rows) ? rows[0] : null;
  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  if (!order.customer_id || order.customer_id !== customer.id) {
    return { ok: false, status: 403, error: "This order is not linked to your account" };
  }

  return { ok: true, order };
}

module.exports = { assertOrderOwnedByCustomer };
