/**
 * Delete old chat data and expired login sessions.
 */

const { dbRequest, isDbConfigured } = require("./db");

const CHAT_RETENTION_DAYS = 30;

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function cleanupOldConversations(retentionDays = CHAT_RETENTION_DAYS) {
  const cutoff = daysAgoIso(retentionDays);
  const deleted = await dbRequest("DELETE", "conversations", {
    query: `updated_at=lt.${encodeURIComponent(cutoff)}`,
    prefer: "return=representation",
  });
  const rows = Array.isArray(deleted) ? deleted : [];
  return { deletedConversations: rows.length, cutoff };
}

async function cleanupExpiredSessions() {
  const now = new Date().toISOString();
  const deleted = await dbRequest("DELETE", "customer_sessions", {
    query: `expires_at=lt.${encodeURIComponent(now)}`,
    prefer: "return=representation",
  });
  const rows = Array.isArray(deleted) ? deleted : [];
  return { deletedSessions: rows.length };
}

async function runChatCleanup(retentionDays = CHAT_RETENTION_DAYS) {
  if (!isDbConfigured()) {
    return { ok: false, error: "Database not configured" };
  }

  const conversations = await cleanupOldConversations(retentionDays);
  const sessions = await cleanupExpiredSessions();

  return {
    ok: true,
    retentionDays,
    ...conversations,
    ...sessions,
    ranAt: new Date().toISOString(),
  };
}

module.exports = {
  CHAT_RETENTION_DAYS,
  runChatCleanup,
  cleanupOldConversations,
  cleanupExpiredSessions,
};
