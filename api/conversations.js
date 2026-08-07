const {
  isDbConfigured,
  dbRequest,
  parseBody,
  checkAdmin,
  sendJson,
  setCors,
  handleOptions,
} = require("../lib/db");
const { getCustomerFromRequest } = require("../lib/auth");
const { formatPhilippinesDateTime } = require("../lib/datetime");

async function enrichConversations(conversations) {
  if (!conversations.length) return [];

  const customerIds = [...new Set(conversations.map((c) => c.customer_id))];
  const customers = await dbRequest("GET", "customers", {
    query: `id=in.(${customerIds.join(",")})&select=id,email,roblox_username,display_name`,
  });
  const customerMap = Object.fromEntries(
    (Array.isArray(customers) ? customers : []).map((c) => [c.id, c])
  );

  return conversations.map((c) => {
    const customer = customerMap[c.customer_id] || {};
    return {
      id: c.id,
      customerId: c.customer_id,
      orderId: c.order_id,
      subject: c.subject,
      status: c.status,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      customerEmail: customer.email || null,
      customerRoblox: customer.roblox_username || null,
      customerName: customer.display_name || customer.roblox_username || "Customer",
      updatedAtFormatted: formatPhilippinesDateTime(c.updated_at),
    };
  });
}

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    const body = await parseBody(req);
    const isAdmin = checkAdmin(req, body);
    const customer = await getCustomerFromRequest(req);

    if (req.method === "GET") {
      if (isAdmin) {
        const data = await dbRequest("GET", "conversations", {
          query: "select=*&order=updated_at.desc",
        });
        const list = await enrichConversations(Array.isArray(data) ? data : []);
        return sendJson(res, 200, list);
      }

      if (!customer) {
        return sendJson(res, 401, { error: "Login required" });
      }

      const data = await dbRequest("GET", "conversations", {
        query: `customer_id=eq.${customer.id}&select=*&order=updated_at.desc`,
      });
      const list = await enrichConversations(Array.isArray(data) ? data : []);
      return sendJson(res, 200, list);
    }

    if (req.method === "POST") {
      if (!customer) {
        return sendJson(res, 401, { error: "Login required to start a chat" });
      }

      const subject = String(body.subject || "General").trim() || "General";
      const orderId = body.orderId || body.order_id || null;

      const rows = await dbRequest("POST", "conversations", {
        body: {
          customer_id: customer.id,
          order_id: orderId,
          subject,
          status: "open",
          updated_at: new Date().toISOString(),
        },
        prefer: "return=representation",
      });

      const conv = Array.isArray(rows) ? rows[0] : rows;
      const [enriched] = await enrichConversations([conv]);
      return sendJson(res, 201, enriched);
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
