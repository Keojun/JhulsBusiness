const { getSupabase, isDbConfigured, checkAdmin, generateReviewCode } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!isDbConfigured()) {
    return res.status(503).json({ error: "Database not configured", fallback: true });
  }

  if (!checkAdmin(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId required" });

  const supabase = getSupabase();
  const code = generateReviewCode();

  const { error: codeError } = await supabase.from("review_codes").insert({
    code,
    order_id: orderId,
    used: false,
  });

  if (codeError) return res.status(500).json({ error: codeError.message });

  const { error: orderError } = await supabase
    .from("orders")
    .update({ status: "completed", review_code: code })
    .eq("id", orderId);

  if (orderError) return res.status(500).json({ error: orderError.message });

  return res.status(200).json({ code, orderId });
};
