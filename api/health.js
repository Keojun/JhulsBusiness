const { isDbConfigured, testConnection, sendJson } = require("../lib/db");

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");

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
      dbError: dbConnected ? null : dbError || "Run supabase/schema.sql in Supabase SQL Editor",
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message, database: "crash" });
  }
};
