/**
 * Shared helpers for live chat polling (admin + customer).
 */

const CHAT_POLL_ADMIN_MS = 2500;
const CHAT_POLL_CUSTOMER_MS = 3000;

function convListFingerprint(conversations) {
  if (!Array.isArray(conversations) || !conversations.length) return "";
  return conversations
    .map((c) => `${c.id}:${c.updatedAt || ""}:${c.unreadCount || 0}`)
    .join("|");
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
    if (inFlight) return;
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

function totalUnreadCount(conversations) {
  if (!Array.isArray(conversations)) return 0;
  return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}

function updateChatBadge(el, count) {
  if (!el) return;
  const n = Math.max(0, Number(count) || 0);
  el.textContent = n > 99 ? "99+" : String(n);
  el.classList.toggle("hidden", n === 0);
  el.setAttribute("aria-label", n ? `${n} unread messages` : "");
}

function unreadBadgeHtml(count) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return "";
  const label = n > 99 ? "99+" : String(n);
  return `<span class="chat-notify-badge chat-notify-badge-inline" aria-label="${n} unread">${label}</span>`;
}

let baseDocumentTitle = document.title;

function setDocumentTitleBadge(count, titleBase) {
  if (titleBase) baseDocumentTitle = titleBase;
  const n = Math.max(0, Number(count) || 0);
  document.title = n > 0 ? `(${n}) ${baseDocumentTitle}` : baseDocumentTitle;
}

function showChatToast(message, type = "info") {
  let toast = document.getElementById("chat-notify-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "chat-notify-toast";
    toast.className = "chat-notify-toast hidden";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `chat-notify-toast chat-notify-toast-${type}`;
  clearTimeout(showChatToast._timer);
  showChatToast._timer = setTimeout(() => toast.classList.add("hidden"), 4500);
}

function playNotifySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch (_) {}
}

function notifyNewMessage({ title, body, tag, silent = false }) {
  if (!silent && !document.hidden) {
    showChatToast(body || title, "info");
    playNotifySound();
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        tag: tag || "rbxdisc-chat",
        icon: "images/jhul-logo.png",
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (_) {}
  }
}

function requestNotifyPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

document.addEventListener("click", requestNotifyPermission, { once: true });
