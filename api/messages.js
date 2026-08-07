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

async function getConversation(conversationId) {
  const rows = await dbRequest("GET", "conversations", {
    query: `id=eq.${encodeURIComponent(conversationId)}&select=*&limit=1`,
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function canAccessConversation(conversation, customer, isAdmin) {
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
    const conversationId =
      req.query.conversationId ||
      req.query.conversation_id ||
      body.conversationId ||
      body.conversation_id;

    if (!conversationId) {
      return sendJson(res, 400, { error: "conversationId is required" });
    }

    const conversation = await getConversation(conversationId);
    if (!(await canAccessConversation(conversation, customer, isAdmin))) {
      return sendJson(res, 403, { error: "Access denied" });
    }

    if (req.method === "GET") {
      const data = await dbRequest("GET", "messages", {
        query: `conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.asc`,
      });
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
      if (!text) {
        return sendJson(res, 400, { error: "Message cannot be empty" });
      }
      if (text.length > 2000) {
        return sendJson(res, 400, { error: "Message too long (max 2000 characters)" });
      }

      const senderType = isAdmin ? "admin" : "customer";
      if (!isAdmin && !customer) {
        return sendJson(res, 401, { error: "Login required" });
      }

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
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
