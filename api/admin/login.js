const { checkAdmin, parseBody, sendJson } = require("../../lib/db");

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

    const body = await parseBody(req);
    const password = body.password || "";

    if (checkAdmin(req, { password })) {
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 401, { ok: false, error: "Incorrect password" });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
