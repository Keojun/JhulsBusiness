const { getSupabase, isDbConfigured, parseBody, sendJson } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  if (!isDbConfigured()) {
    return sendJson(res, 503, { error: "Database not configured", fallback: true });
  }

  const body = await parseBody(req);
  const { code } = body;
  if (!code) return sendJson(res, 400, { error: "code required" });

  const supabase = getSupabase();
  const upperCode = code.toUpperCase();

  const { data, error } = await supabase
    .from("review_codes")
    .select("*")
    .eq("code", upperCode)
    .eq("used", false)
    .maybeSingle();

  if (error) return sendJson(res, 500, { error: error.message });
  if (!data) return sendJson(res, 404, { error: "Invalid or used code" });

  return sendJson(res, 200, { valid: true, orderId: data.order_id, code: upperCode });
};
