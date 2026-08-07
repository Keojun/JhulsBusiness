const {
  isDbConfigured,
  testConnection,
  checkAdmin,
  parseBody,
  sendJson,
  setCors,
  handleOptions,
} = require("../lib/db");
const { runChatCleanup } = require("../lib/cleanup");

function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization || req.headers.Authorization || "";
  return auth === `Bearer ${secret}` || req.headers["x-cron-secret"] === secret;
}

module.exports = async function handler(req, res) {
  try {
    setCors(res);
    if (handleOptions(req, res)) return;

    const url = new URL(req.url || "/", "http://localhost");
    const isCleanup = url.searchParams.get("cleanup") === "1";

    if (isCleanup) {
      const body = await parseBody(req);
      const isCron = authorizeCron(req);
      const isAdmin = checkAdmin(req, body);

      if (!isCron && !isAdmin) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }
      if (!isDbConfigured()) {
        return sendJson(res, 503, { error: "Database not configured" });
      }

      const retentionDays = Number(url.searchParams.get("days") || body.days) || 30;
      const result = await runChatCleanup(retentionDays);
      return sendJson(res, 200, result);
    }

    const configured = isDbConfigured();
    let dbConnected = false;
    let dbError = null;

    if (configured) {
      const test = await testConnection();
      dbConnected = test.ok;
      dbError = test.error || null;
    }

    return sendJson(res, 200, {
      database: configured ? (dbConnected ? "connected" : "error") : "not_configured",
      supabaseUrl: process.env.SUPABASE_URL ? "set" : "missing",
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
      adminPassword: process.env.ADMIN_PASSWORD ? "custom" : "default (jhul2026)",
      cronSecret: process.env.CRON_SECRET ? "set" : "missing",
      dbError: dbConnected ? null : dbError || "Run supabase/schema.sql in Supabase SQL Editor",
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message, database: "crash" });
  }
};
