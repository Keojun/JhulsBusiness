const {
  isDbConfigured,
  sendJson,
  setCors,
  handleOptions,
  checkAdmin,
  parseBody,
} = require("../../lib/db");
const { runChatCleanup, CHAT_RETENTION_DAYS } = require("../../lib/cleanup");

function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.authorization || req.headers.Authorization || "";
  if (auth === `Bearer ${secret}`) return true;

  return req.headers["x-cron-secret"] === secret;
}

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    if (req.method !== "GET" && req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const body = await parseBody(req);
    const isCron = authorizeCron(req);
    const isAdmin = checkAdmin(req, body);

    if (!isCron && !isAdmin) {
      return sendJson(res, 401, {
        error: "Unauthorized — set CRON_SECRET for scheduled runs or use admin password",
      });
    }

    if (!isDbConfigured()) {
      return sendJson(res, 503, { error: "Database not configured" });
    }

    const retentionDays = Number(req.query.days || body.days) || CHAT_RETENTION_DAYS;
    const result = await runChatCleanup(retentionDays);

    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
};
