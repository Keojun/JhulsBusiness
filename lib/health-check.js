/**
 * Health check probes for RBXDISC status page.
 */

const { isDbConfigured, dbRequest, dbHeaders, dbUrl } = require("./db");
const { formatPhilippinesDateTime } = require("./datetime");

const CORE_TABLES = [
  { key: "orders", label: "Orders", required: true },
  { key: "customers", label: "Customer accounts", required: true },
  { key: "customer_sessions", label: "Login sessions", required: true },
  { key: "conversations", label: "Chat conversations", required: true },
  { key: "messages", label: "Chat messages", required: true },
  { key: "review_codes", label: "Review codes", required: true },
  { key: "site_reviews", label: "Site reviews", required: true },
  { key: "facebook_reviews", label: "Facebook reviews", required: false },
];

async function probeTable(table) {
  try {
    await dbRequest("GET", table, { query: "select=*&limit=1" });
    return { status: "ok", message: "Table reachable" };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

async function getTableCount(table) {
  try {
    const headers = dbHeaders();
    headers.Prefer = "count=exact";
    const res = await fetch(dbUrl(table, "select=*&limit=0"), { method: "GET", headers });
    if (!res.ok) return null;
    const range = res.headers.get("content-range") || "";
    const total = range.includes("/") ? range.split("/")[1] : null;
    return total != null && total !== "*" ? Number(total) : null;
  } catch {
    return null;
  }
}

function envCheck(name, required = true) {
  const set = Boolean(process.env[name]);
  return {
    status: set ? "ok" : required ? "missing" : "optional",
    label: name,
    configured: set,
  };
}

async function runHealthCheck() {
  const now = new Date();
  const checks = {
    environment: {
      status: "ok",
      items: [
        envCheck("SUPABASE_URL"),
        envCheck("SUPABASE_SERVICE_ROLE_KEY"),
        envCheck("ADMIN_PASSWORD"),
        envCheck("SESSION_SECRET", false),
        envCheck("CRON_SECRET", false),
      ],
    },
    database: {
      status: "unknown",
      connected: false,
      message: null,
      tables: {},
      counts: {},
    },
    features: {},
  };

  const envMissing = checks.environment.items.filter(
    (i) => i.status === "missing" && ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_PASSWORD"].includes(i.label)
  );
  if (envMissing.length > 0) {
    checks.environment.status = "missing";
  }

  checks.features = {
    customerLogin: { status: "unknown", label: "Customer login & signup" },
    orderShop: { status: "unknown", label: "Gakuran order shop" },
    inAppChat: { status: "unknown", label: "In-app chat (customer ↔ Jhul)" },
    adminPanel: { status: checks.environment.items.find((i) => i.label === "ADMIN_PASSWORD")?.configured ? "ok" : "warn", label: "Admin panel (/admin)" },
    chatCleanupCron: {
      status: process.env.CRON_SECRET ? "ok" : "warn",
      label: "Auto chat cleanup (daily cron)",
      message: process.env.CRON_SECRET ? "CRON_SECRET set — daily cleanup enabled" : "Set CRON_SECRET in Vercel for auto cleanup",
    },
    sessionSecurity: {
      status: process.env.SESSION_SECRET ? "ok" : "warn",
      label: "Signed session cookies",
      message: process.env.SESSION_SECRET ? "SESSION_SECRET set" : "Using ADMIN_PASSWORD fallback — set SESSION_SECRET for best security",
    },
  };

  if (!isDbConfigured()) {
    checks.database.status = "not_configured";
    checks.database.message = "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel";
    checks.features.customerLogin.status = "down";
    checks.features.orderShop.status = "down";
    checks.features.inAppChat.status = "down";
  } else {
    try {
      await dbRequest("GET", "orders", { query: "select=id&limit=1" });
      checks.database.connected = true;
    } catch (err) {
      checks.database.status = "error";
      checks.database.message = err.message;
      checks.features.customerLogin.status = "down";
      checks.features.orderShop.status = "down";
      checks.features.inAppChat.status = "down";
    }

    if (checks.database.connected) {
      for (const table of CORE_TABLES) {
        const result = await probeTable(table.key);
        checks.database.tables[table.key] = {
          ...result,
          label: table.label,
          required: table.required,
        };
      }

      const failedRequired = Object.values(checks.database.tables).filter(
        (t) => t.required && t.status !== "ok"
      );
      checks.database.status = failedRequired.length ? "missing_tables" : "ok";
      if (failedRequired.length) {
        checks.database.message =
          "Run supabase/schema.sql and supabase/migration-customer-chat.sql in Supabase SQL Editor";
      }

      const countTables = ["orders", "customers", "conversations", "messages"];
      for (const table of countTables) {
        checks.database.counts[table] = await getTableCount(table);
      }

      const customersOk = checks.database.tables.customers?.status === "ok";
      const chatOk =
        checks.database.tables.conversations?.status === "ok" &&
        checks.database.tables.messages?.status === "ok";

      checks.features.customerLogin.status = customersOk ? "ok" : "down";
      checks.features.orderShop.status = checks.database.tables.orders?.status === "ok" ? "ok" : "down";
      checks.features.inAppChat.status = chatOk ? "ok" : "down";
    }
  }

  const statuses = [
    checks.environment.status,
    checks.database.status,
    ...Object.values(checks.features).map((f) => f.status),
  ];

  let overall = "healthy";
  if (statuses.includes("down") || statuses.includes("error") || statuses.includes("not_configured")) {
    overall = "down";
  } else if (
    statuses.includes("missing") ||
    statuses.includes("missing_tables") ||
    statuses.includes("warn")
  ) {
    overall = "degraded";
  }

  return {
    service: "RBXDISC",
    tagline: "Gakuran reroll shop by Jhul Cammayo",
    status: overall,
    online: true,
    timestamp: now.toISOString(),
    timestampPH: formatPhilippinesDateTime(now),
    timezone: "Asia/Manila (UTC+8)",
    checks,
    links: {
      site: "https://rbxdisc.vercel.app",
      login: "https://rbxdisc.vercel.app/login",
      shop: "https://rbxdisc.vercel.app/gakuran",
      admin: "https://rbxdisc.vercel.app/admin",
    },
    tips:
      overall === "healthy"
        ? ["All core systems look good.", "Visit /login to test customer signup.", "Visit /admin to manage orders and chats."]
        : overall === "degraded"
          ? ["Some optional settings are missing or tables need migration.", "Check warnings below and run SQL migrations in Supabase if needed."]
          : ["Fix database or environment errors below before customers can use the shop."],
  };
}

function statusIcon(status) {
  if (status === "ok" || status === "healthy") return "✅";
  if (status === "warn" || status === "degraded" || status === "optional" || status === "missing_tables") return "⚠️";
  return "❌";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHealthHtml(report) {
  const overallColor =
    report.status === "healthy" ? "#2d5a3d" : report.status === "degraded" ? "#7c4a1e" : "#c0392b";
  const overallBg =
    report.status === "healthy" ? "#e8f5e9" : report.status === "degraded" ? "#fff3e0" : "#fdecea";

  const envRows = report.checks.environment.items
    .map(
      (item) => `
      <tr>
        <td>${statusIcon(item.status)} ${escapeHtml(item.label)}</td>
        <td>${item.configured ? "Configured" : item.status === "optional" ? "Optional — not set" : "Missing"}</td>
      </tr>`
    )
    .join("");

  const tableRows = Object.entries(report.checks.database.tables)
    .map(
      ([key, t]) => `
      <tr>
        <td>${statusIcon(t.status)} ${escapeHtml(t.label)}</td>
        <td><code>${escapeHtml(key)}</code></td>
        <td>${escapeHtml(t.message || t.status)}</td>
        <td>${report.checks.database.counts[key] != null ? report.checks.database.counts[key] : "—"}</td>
      </tr>`
    )
    .join("");

  const featureRows = Object.values(report.checks.features)
    .map(
      (f) => `
      <tr>
        <td>${statusIcon(f.status)} ${escapeHtml(f.label)}</td>
        <td>${escapeHtml(f.message || f.status)}</td>
      </tr>`
    )
    .join("");

  const tipList = report.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RBXDISC System Status</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      background: linear-gradient(135deg, #fffaf5 0%, #e8f5e9 50%, #ffe8d6 100%);
      color: #2d3436;
      min-height: 100vh;
      padding: 1.5rem;
      line-height: 1.5;
    }
    .wrap { max-width: 820px; margin: 0 auto; }
    .hero {
      background: white;
      border-radius: 16px;
      padding: 1.5rem 1.75rem;
      border: 2px solid #b8e6c1;
      box-shadow: 0 4px 24px rgba(107, 196, 138, 0.15);
      margin-bottom: 1rem;
    }
    .hero h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
    .hero p { color: #4a5568; font-size: 0.95rem; }
    .status-pill {
      display: inline-block;
      margin-top: 0.75rem;
      padding: 0.45rem 1rem;
      border-radius: 999px;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 0.85rem;
      color: ${overallColor};
      background: ${overallBg};
      border: 2px solid ${overallColor}33;
    }
    .meta { margin-top: 0.75rem; font-size: 0.85rem; color: #4a5568; }
    .card {
      background: white;
      border-radius: 14px;
      padding: 1.25rem 1.5rem;
      border: 2px solid #b8e6c1;
      margin-bottom: 1rem;
      box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    }
    .card h2 { font-size: 1.05rem; margin-bottom: 0.85rem; color: #2d3436; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { padding: 0.55rem 0.5rem; text-align: left; border-bottom: 1px solid #e8f5e9; vertical-align: top; }
    th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #4a5568; }
    code { background: #fff3e0; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.82rem; }
    ul { padding-left: 1.2rem; color: #4a5568; font-size: 0.92rem; }
    .links { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .links a {
      color: #ff9a5c;
      font-weight: 700;
      text-decoration: none;
      background: #fffaf5;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      border: 1px solid #ffc9a3;
      font-size: 0.85rem;
    }
    .json-link { margin-top: 1rem; font-size: 0.85rem; color: #4a5568; }
    .json-link a { color: #6bc48a; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>🎴 RBXDISC System Status</h1>
      <p>Gakuran reroll shop — connection & feature health check</p>
      <span class="status-pill">${statusIcon(report.status)} ${escapeHtml(report.status)}</span>
      <div class="meta">
        <div>🕐 Philippines time: <strong>${escapeHtml(report.timestampPH)}</strong></div>
        <div>🌐 Site online: <strong>${report.online ? "Yes" : "No"}</strong></div>
        ${report.checks.database.message ? `<div>ℹ️ ${escapeHtml(report.checks.database.message)}</div>` : ""}
      </div>
    </div>

    <div class="card">
      <h2>⚙️ Environment Variables (Vercel)</h2>
      <table>
        <thead><tr><th>Variable</th><th>Status</th></tr></thead>
        <tbody>${envRows}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>🗄️ Database (Supabase)</h2>
      <p style="font-size:0.88rem;color:#4a5568;margin-bottom:0.75rem;">
        Connection: <strong>${report.checks.database.connected ? "✅ Connected" : "❌ Not connected"}</strong>
      </p>
      <table>
        <thead><tr><th>Table</th><th>Name</th><th>Status</th><th>Rows</th></tr></thead>
        <tbody>${tableRows || "<tr><td colspan='4'>No table data — database not connected</td></tr>"}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>✨ Features</h2>
      <table>
        <thead><tr><th>Feature</th><th>Details</th></tr></thead>
        <tbody>${featureRows}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>🔗 Quick Links</h2>
      <div class="links">
        <a href="${report.links.login}">Login / Sign Up</a>
        <a href="${report.links.shop}">Gakuran Shop</a>
        <a href="${report.links.admin}">Admin Panel</a>
        <a href="${report.links.site}">Home</a>
      </div>
    </div>

    <div class="card">
      <h2>💡 What to do next</h2>
      <ul>${tipList}</ul>
    </div>

    <p class="json-link">Need raw JSON? Open <a href="?format=json">/api/health?format=json</a></p>
  </div>
</body>
</html>`;
}

module.exports = {
  runHealthCheck,
  renderHealthHtml,
  statusIcon,
};
