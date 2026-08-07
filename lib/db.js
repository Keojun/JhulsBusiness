/**
 * Supabase REST client — no npm packages needed, works reliably on Vercel.
 */

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "jhul2026";
}

function isDbConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function dbHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function dbUrl(table, query = "") {
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  return `${base}/rest/v1/${table}${query ? "?" + query : ""}`;
}

async function dbRequest(method, table, { query = "", body = null, prefer = null } = {}) {
  const headers = dbHeaders();
  if (prefer) headers.Prefer = prefer;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(dbUrl(table, query), options);
  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && data.message) ||
      (data && data.error) ||
      (typeof data === "string" ? data : `HTTP ${res.status}`);
    throw new Error(msg);
  }

  return data;
}

async function testConnection() {
  if (!isDbConfigured()) return { ok: false, error: "not_configured" };
  try {
    await dbRequest("GET", "orders", { query: "select=id&limit=1" });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.length > 0) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function checkAdmin(req, body) {
  const password = req.headers["x-admin-password"] || (body && body.password);
  return password === getAdminPassword();
}

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Password, Authorization"
  );
}

function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.status(200).end();
    return true;
  }
  return false;
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
  isDbConfigured,
  dbRequest,
  dbHeaders,
  dbUrl,
  testConnection,
  parseBody,
  checkAdmin,
  sendJson,
  setCors,
  handleOptions,
  getAdminPassword,
  generateReviewCode,
};
