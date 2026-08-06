const {
  getSupabase,
  isDbConfigured,
  checkAdmin,
  parseBody,
  sendJson,
} = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!isDbConfigured()) {
    return sendJson(res, 503, { error: "Database not configured", fallback: true });
  }

  const supabase = getSupabase();
  const body = await parseBody(req);

  if (req.method === "GET") {
    if (!checkAdmin(req, body)) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return sendJson(res, 500, { error: error.message });

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

    return sendJson(res, 200, orders);
  }

  if (req.method === "POST") {
    const { id, username, rerollAmount, status, createdAt } = body;

    if (!id || !username || !rerollAmount) {
      return sendJson(res, 400, { error: "Missing required fields" });
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

    if (error) return sendJson(res, 500, { error: error.message });

    return sendJson(res, 201, {
      id: data.id,
      username: data.username,
      rerollAmount: data.reroll_amount,
      status: data.status,
      savedToDb: true,
      date: new Date(data.created_at).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      createdAt: data.created_at,
    });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
};
