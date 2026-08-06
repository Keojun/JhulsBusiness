const { isDbConfigured, dbRequest, parseBody, sendJson } = require("../lib/db");

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured", fallback: true });
    }

    const body = await parseBody(req);

    if (req.method === "GET") {
      const type = new URL(req.url || "/", "http://localhost").searchParams.get("type") || "site";
      const table = type === "facebook" ? "facebook_reviews" : "site_reviews";

      const data = await dbRequest("GET", table, {
        query: "select=*&order=created_at.desc",
      });

      const reviews = (Array.isArray(data) ? data : []).map((r) => ({
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

      const codeRows = await dbRequest("GET", "review_codes", {
        query: `code=eq.${encodeURIComponent(upperCode)}&used=eq.false&select=*`,
      });

      const codeData = Array.isArray(codeRows) ? codeRows[0] : null;
      if (!codeData) return sendJson(res, 404, { error: "Invalid or used code" });

      const reviewRows = await dbRequest("POST", "site_reviews", {
        body: {
          author,
          text,
          stars: Number(stars),
          verified: true,
          source: "Verified Purchase",
        },
        prefer: "return=representation",
      });

      const review = Array.isArray(reviewRows) ? reviewRows[0] : reviewRows;

      await dbRequest("PATCH", "review_codes", {
        query: `code=eq.${encodeURIComponent(upperCode)}`,
        body: { used: true, used_at: new Date().toISOString() },
        prefer: "return=minimal",
      });

      await dbRequest("PATCH", "orders", {
        query: `id=eq.${encodeURIComponent(codeData.order_id)}`,
        body: { status: "reviewed" },
        prefer: "return=minimal",
      });

      return sendJson(res, 201, {
        author: review.author,
        text: review.text,
        stars: review.stars,
        source: review.source,
        verified: review.verified,
      });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
