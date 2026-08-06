const { getSupabase, isDbConfigured, parseBody, sendJson } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!isDbConfigured()) {
    return sendJson(res, 503, { error: "Database not configured", fallback: true });
  }

  const supabase = getSupabase();
  const body = await parseBody(req);

  if (req.method === "GET") {
    const type = new URL(req.url || "/", "http://localhost").searchParams.get("type") || "site";
    const table = type === "facebook" ? "facebook_reviews" : "site_reviews";

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return sendJson(res, 500, { error: error.message });

    const reviews = data.map((r) => ({
      author: r.author,
      text: r.text,
      stars: r.stars,
      source: r.source,
      verified: r.verified,
      createdAt: r.created_at,
    }));

    return sendJson(res, 200, reviews);
  }

  if (req.method === "POST") {
    const { code, author, text, stars } = body;

    if (!code || !author || !text || !stars) {
      return sendJson(res, 400, { error: "Missing required fields" });
    }

    const upperCode = code.toUpperCase();

    const { data: codeData, error: codeError } = await supabase
      .from("review_codes")
      .select("*")
      .eq("code", upperCode)
      .eq("used", false)
      .maybeSingle();

    if (codeError) return sendJson(res, 500, { error: codeError.message });
    if (!codeData) return sendJson(res, 404, { error: "Invalid or used code" });

    const { data: review, error: reviewError } = await supabase
      .from("site_reviews")
      .insert({
        author,
        text,
        stars: Number(stars),
        verified: true,
        source: "Verified Purchase",
      })
      .select()
      .single();

    if (reviewError) return sendJson(res, 500, { error: reviewError.message });

    await supabase
      .from("review_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("code", upperCode);

    await supabase.from("orders").update({ status: "reviewed" }).eq("id", codeData.order_id);

    return sendJson(res, 201, {
      author: review.author,
      text: review.text,
      stars: review.stars,
      source: review.source,
      verified: review.verified,
    });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
};
