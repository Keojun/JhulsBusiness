const { getSupabase, isDbConfigured, checkAdmin } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!isDbConfigured()) {
    return res.status(503).json({ error: "Database not configured", fallback: true });
  }

  const supabase = getSupabase();

  if (req.method === "GET") {
    if (!checkAdmin(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const orders = data.map((o) => ({
      id: o.id,
      username: o.username,
      rerollAmount: o.reroll_amount,
      status: o.status,
      reviewCode: o.review_code,
      date: new Date(o.created_at).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      createdAt: o.created_at,
    }));

    return res.status(200).json(orders);
  }

  if (req.method === "POST") {
    const { id, username, rerollAmount, status, createdAt } = req.body || {};

    if (!id || !username || !rerollAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({
        id,
        username,
        reroll_amount: Number(rerollAmount),
        status: status || "pending",
        created_at: createdAt || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({
      id: data.id,
      username: data.username,
      rerollAmount: data.reroll_amount,
      status: data.status,
      date: new Date(data.created_at).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      createdAt: data.created_at,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
