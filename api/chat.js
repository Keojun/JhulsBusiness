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

async function getConversation(conversationId) {
  const rows = await dbRequest("GET", "conversations", {
    query: `id=eq.${encodeURIComponent(conversationId)}&select=*&limit=1`,
  });
  return Array.isArray(rows) ? rows[0] : null;
}

function canAccessConversation(conversation, customer, isAdmin) {
  if (!conversation) return false;
  if (isAdmin) return true;
  return customer && conversation.customer_id === customer.id;
}

function mapMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderType: m.sender_type,
    body: m.body,
    createdAt: m.created_at,
    readAt: m.read_at,
    createdAtFormatted: formatPhilippinesDateTime(m.created_at),
  };
}

function getResource(req, body) {
  const url = new URL(req.url || "/", "http://localhost");
  return (url.searchParams.get("resource") || body.resource || "conversations").toLowerCase();
}

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    const body = await parseBody(req);
    const resource = getResource(req, body);
    const isAdmin = checkAdmin(req, body);
    const customer = await getCustomerFromRequest(req);
    const url = new URL(req.url || "/", "http://localhost");

    if (resource === "messages") {
      const conversationId =
        url.searchParams.get("conversationId") ||
        url.searchParams.get("conversation_id") ||
        body.conversationId ||
        body.conversation_id;

      if (!conversationId) {
        return sendJson(res, 400, { error: "conversationId is required" });
      }

      const conversation = await getConversation(conversationId);
      if (!canAccessConversation(conversation, customer, isAdmin)) {
        return sendJson(res, 403, { error: "Access denied" });
      }

      if (req.method === "GET") {
        let query = `conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.asc`;
        const since = url.searchParams.get("since");
        if (since) {
          const sinceDate = new Date(since);
          if (!Number.isNaN(sinceDate.getTime())) {
            query += `&created_at=gt.${encodeURIComponent(sinceDate.toISOString())}`;
          }
        }

        const data = await dbRequest("GET", "messages", { query });
        const messages = (Array.isArray(data) ? data : []).map(mapMessage);

        if (isAdmin) {
          const unread = (Array.isArray(data) ? data : []).filter(
            (m) => m.sender_type === "customer" && !m.read_at
          );
          for (const m of unread) {
            await dbRequest("PATCH", "messages", {
              query: `id=eq.${m.id}`,
              body: { read_at: new Date().toISOString() },
              prefer: "return=minimal",
            });
          }
        }

        return sendJson(res, 200, messages);
      }

      if (req.method === "POST") {
        const text = String(body.body || body.message || "").trim();
        if (!text) return sendJson(res, 400, { error: "Message cannot be empty" });
        if (text.length > 2000) {
          return sendJson(res, 400, { error: "Message too long (max 2000 characters)" });
        }

        const senderType = isAdmin ? "admin" : "customer";
        if (!isAdmin && !customer) return sendJson(res, 401, { error: "Login required" });

        const rows = await dbRequest("POST", "messages", {
          body: {
            conversation_id: conversationId,
            sender_type: senderType,
            body: text,
          },
          prefer: "return=representation",
        });

        await dbRequest("PATCH", "conversations", {
          query: `id=eq.${encodeURIComponent(conversationId)}`,
          body: { updated_at: new Date().toISOString() },
          prefer: "return=minimal",
        });

        const msg = Array.isArray(rows) ? rows[0] : rows;
        return sendJson(res, 201, mapMessage(msg));
      }

      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (req.method === "GET") {
      if (isAdmin) {
        const data = await dbRequest("GET", "conversations", {
          query: "select=*&order=updated_at.desc",
        });
        return sendJson(res, 200, await enrichConversations(Array.isArray(data) ? data : []));
      }

      if (!customer) return sendJson(res, 401, { error: "Login required" });

      const data = await dbRequest("GET", "conversations", {
        query: `customer_id=eq.${customer.id}&select=*&order=updated_at.desc`,
      });
      return sendJson(res, 200, await enrichConversations(Array.isArray(data) ? data : []));
    }

    if (req.method === "POST") {
      if (!customer) return sendJson(res, 401, { error: "Login required to start a chat" });

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
