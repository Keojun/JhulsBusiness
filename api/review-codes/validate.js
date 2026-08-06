const { getSupabase, isDbConfigured } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!isDbConfigured()) {
    return res.status(503).json({ error: "Database not configured", fallback: true });
  }

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "code required" });

  const supabase = getSupabase();
  const upperCode = code.toUpperCase();

  const { data, error } = await supabase
    .from("review_codes")
    .select("*")
    .eq("code", upperCode)
    .eq("used", false)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Invalid or used code" });

  return res.status(200).json({ valid: true, orderId: data.order_id, code: upperCode });
};
