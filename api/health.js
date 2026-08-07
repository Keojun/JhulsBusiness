const {
  isDbConfigured,
  checkAdmin,
  parseBody,
  sendJson,
  setCors,
  handleOptions,
} = require("../lib/db");
const { runChatCleanup } = require("../lib/cleanup");
const { runHealthCheck, renderHealthHtml } = require("../lib/health-check");

function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization || req.headers.Authorization || "";
  return auth === `Bearer ${secret}` || req.headers["x-cron-secret"] === secret;
}

function wantsJson(req, url) {
  if (url.searchParams.get("format") === "json") return true;
  const accept = req.headers.accept || req.headers.Accept || "";
  return accept.includes("application/json");
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");

  try {
    setCors(res);
    if (handleOptions(req, res)) return;

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

    const report = await runHealthCheck();

    if (wantsJson(req, url)) {
      const httpStatus = report.status === "down" ? 503 : 200;
      return sendJson(res, httpStatus, report);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(report.status === "down" ? 503 : 200).send(renderHealthHtml(report));
  } catch (err) {
    if (wantsJson(req, url)) {
      return sendJson(res, 500, {
        service: "RBXDISC",
        status: "down",
        online: false,
        error: err.message,
      });
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#fdecea;">
        <h1>❌ RBXDISC Health Check Failed</h1>
        <p>${err.message}</p>
        <p><a href="?format=json">View JSON</a></p>
      </body></html>`
    );
  }
};
