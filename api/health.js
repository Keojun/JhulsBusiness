const { getSupabase, isDbConfigured, sendJson } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const dbOk = isDbConfigured();
  const supabase = dbOk ? getSupabase() : null;

  let dbConnected = false;
  if (supabase) {
    const { error } = await supabase.from("orders").select("id").limit(1);
    dbConnected = !error;
  }

  return sendJson(res, 200, {
    database: dbOk ? (dbConnected ? "connected" : "error") : "not_configured",
    supabaseUrl: process.env.SUPABASE_URL ? "set" : "missing",
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
    adminPassword: process.env.ADMIN_PASSWORD ? "custom" : "default (jhul2026)",
    dbError: dbConnected ? null : "Check Supabase tables — run supabase/schema.sql",
  });
};
