const {
  getSupabase,
  isDbConfigured,
  checkAdmin,
  parseBody,
  sendJson,
  generateReviewCode,
} = require("../../lib/supabase");

module.exports = async function handler(req, res) {
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

  const supabase = getSupabase();
  const code = generateReviewCode();

  const { error: codeError } = await supabase.from("review_codes").insert({
    code,
    order_id: orderId,
    used: false,
  });

  if (codeError) return sendJson(res, 500, { error: codeError.message });

  const { error: orderError } = await supabase
    .from("orders")
    .update({ status: "completed", review_code: code })
    .eq("id", orderId);

  if (orderError) return sendJson(res, 500, { error: orderError.message });

  return sendJson(res, 200, { code, orderId });
};
