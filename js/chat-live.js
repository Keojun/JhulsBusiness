/**
 * Shared helpers for live chat polling (admin + customer).
 */

const CHAT_POLL_ADMIN_MS = 2500;
const CHAT_POLL_CUSTOMER_MS = 3000;

function convListFingerprint(conversations) {
  if (!Array.isArray(conversations) || !conversations.length) return "";
  return conversations.map((c) => `${c.id}:${c.updatedAt || ""}`).join("|");
}

function isNearBottom(el, threshold = 80) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function scrollChatToBottom(el, force = false) {
  if (!el) return;
  if (force || isNearBottom(el)) {
    el.scrollTop = el.scrollHeight;
  }
}

function escapeChatHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function escapeChatAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

function messageBubbleHtml(m, options = {}) {
  const pending = options.pending || m.pending ? " chat-bubble-pending" : "";
  const isNew = options.isNew ? " chat-bubble-new" : "";
  const idAttr = m.id ? ` data-msg-id="${escapeChatAttr(m.id)}"` : "";
  const timeLabel = m.createdAtFormatted || (options.pending ? "Sending…" : "");

  return `
    <div class="chat-bubble chat-bubble-${m.senderType}${pending}${isNew}"${idAttr}>
      <p>${escapeChatHtml(m.body)}</p>
      <time>${escapeChatHtml(timeLabel)}</time>
    </div>`;
}

function renderMessageThread(threadEl, messages, options = {}) {
  if (!threadEl) return;

  const emptyHtml =
    threadEl.dataset.emptyHtml ||
    '<p class="chat-empty">No messages yet.</p>';

  if (!messages.length) {
    threadEl.innerHTML = emptyHtml;
    return;
  }

  threadEl.innerHTML = messages.map((m) => messageBubbleHtml(m)).join("");
  scrollChatToBottom(threadEl, options.forceScroll !== false);
}

function appendMessages(threadEl, messages, options = {}) {
  if (!threadEl || !messages.length) return;

  threadEl.querySelector(".chat-empty-thread, .chat-empty")?.remove();

  const wasNearBottom = isNearBottom(threadEl);

  for (const m of messages) {
    if (m.id && threadEl.querySelector(`[data-msg-id="${escapeChatAttr(m.id)}"]`)) {
      continue;
    }
    threadEl.insertAdjacentHTML("beforeend", messageBubbleHtml(m, { isNew: true }));
  }

  scrollChatToBottom(threadEl, options.forceScroll || wasNearBottom);
}

function replacePendingMessage(threadEl, tempId, message) {
  if (!threadEl) return;
  const pending = threadEl.querySelector(`[data-msg-id="${escapeChatAttr(tempId)}"]`);
  if (pending) {
    pending.outerHTML = messageBubbleHtml(message);
    scrollChatToBottom(threadEl, true);
    return;
  }
  appendMessages(threadEl, [message], { forceScroll: true });
}

function removePendingMessage(threadEl, tempId) {
  threadEl?.querySelector(`[data-msg-id="${escapeChatAttr(tempId)}"]`)?.remove();
}

function getLastMessageTimestamp(messages) {
  if (!Array.isArray(messages) || !messages.length) return null;
  return messages[messages.length - 1].createdAt || null;
}

function createChatPoller(pollFn, intervalMs) {
  let timer = null;
  let inFlight = false;

  async function tick() {
    if (inFlight || document.hidden) return;
    inFlight = true;
    try {
      await pollFn();
    } catch (_) {}
    inFlight = false;
  }

  function start() {
    stop();
    tick();
    timer = setInterval(tick, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function onVisibilityChange() {
    if (!document.hidden && timer) tick();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);

  return { start, stop, tick };
}

function setLiveBadge(el, active) {
  if (!el) return;
  el.classList.toggle("hidden", !active);
  el.setAttribute("aria-hidden", active ? "false" : "true");
}
