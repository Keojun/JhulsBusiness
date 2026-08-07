const {
  isDbConfigured,
  parseBody,
  sendJson,
  setCors,
  handleOptions,
} = require("../../lib/db");
const { deleteSession, getBearerToken } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const body = await parseBody(req);
    const token = getBearerToken(req) || body.token;

    if (isDbConfigured() && token) {
      await deleteSession(token);
    }

    return sendJson(res, 200, { ok: true });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
