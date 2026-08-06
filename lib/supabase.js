const { createClient } = require("@supabase/supabase-js");
const { getAdminPassword, checkAdmin, parseBody, sendJson } = require("./api-helpers");

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function isDbConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function generateReviewCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "JHUL-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

module.exports = {
  getSupabase,
  isDbConfigured,
  checkAdmin,
  parseBody,
  sendJson,
  getAdminPassword,
  generateReviewCode,
};
