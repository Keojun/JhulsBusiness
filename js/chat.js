/**
 * Customer chat with Jhul — slide-out panel + floating bubble on Gakuran page
 */

let activeConversationId = null;
let pollTimer = null;
let pendingOrderForChat = null;

function initChat() {
  const openBtn = document.getElementById("btn-open-chat");
  const headerChatBtn = document.getElementById("btn-header-chat");
  const fab = document.getElementById("chat-fab");
  const closeBtn = document.getElementById("btn-close-chat");
  const panel = document.getElementById("chat-panel");
  const form = document.getElementById("chat-form");
  const newChatBtn = document.getElementById("btn-new-chat");

  openBtn?.addEventListener("click", () => openChatPanel());
  headerChatBtn?.addEventListener("click", () => openChatPanel(pendingOrderForChat || null));
  fab?.addEventListener("click", () => openChatPanel(pendingOrderForChat || null));
  closeBtn?.addEventListener("click", () => closeChatPanel());

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await sendCustomerMessage();
  });

  newChatBtn?.addEventListener("click", () => startNewConversation());

  document.addEventListener("rbxdisc:auth", (e) => {
    if (e.detail.customer) {
      showChatFab(false);
    } else {
      closeChatPanel();
      activeConversationId = null;
      hideChatFab();
    }
  });

  document.getElementById("btn-message-jhul-order")?.addEventListener("click", () => {
    if (pendingOrderForChat) {
      openChatPanel(pendingOrderForChat);
    }
  });
}

function showChatFab(pulse = false) {
  const wrap = document.getElementById("chat-fab-wrap");
  const fab = document.getElementById("chat-fab");
  const hint = document.getElementById("chat-fab-hint");
  if (!wrap || !fab) return;

  wrap.classList.remove("hidden");
  document.body.classList.add("has-chat-fab");
  fab.classList.toggle("pulse", pulse);
  if (pulse && hint) hint.classList.remove("hidden");
}

function hideChatFabHint() {
  document.getElementById("chat-fab-hint")?.classList.add("hidden");
  document.getElementById("chat-fab")?.classList.remove("pulse");
}

function hideChatFab() {
  document.getElementById("chat-fab-wrap")?.classList.add("hidden");
  document.body.classList.remove("has-chat-fab");
  hideChatFabHint();
}

function openChatPanel(orderContext = null) {
  getCurrentCustomer().then(async (c) => {
    if (!c) {
      window.location.replace("/login?redirect=" + encodeURIComponent("/gakuran"));
      return;
    }

    hideChatFabHint();
    document.getElementById("chat-panel")?.classList.remove("hidden");
    document.body.classList.add("chat-open");

    if (orderContext) {
      await openOrderChat(orderContext);
    } else {
      await loadConversations();
    }

    startPolling();
  });
}

function closeChatPanel() {
  document.getElementById("chat-panel")?.classList.add("hidden");
  document.body.classList.remove("chat-open");
  stopPolling();

  getCurrentCustomer().then((c) => {
    if (c && document.getElementById("chat-fab-wrap")) showChatFab(false);
  });
}

async function loadConversations() {
  const listEl = document.getElementById("chat-conv-list");
  if (!listEl) return;

  listEl.innerHTML = '<p class="chat-loading">Loading chats…</p>';

  try {
    const convs = await getConversations();
    if (convs.length === 0) {
      const conv = await createConversation("General");
      activeConversationId = conv.id;
      renderConversationList([conv]);
      renderMessages([]);
      return;
    }

    renderConversationList(convs);
    if (!activeConversationId || !convs.find((c) => c.id === activeConversationId)) {
      activeConversationId = convs[0].id;
    }
    await loadMessages(activeConversationId);
  } catch (err) {
    listEl.innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderConversationList(convs) {
  const listEl = document.getElementById("chat-conv-list");
  if (!listEl) return;

  listEl.innerHTML = convs
    .map(
      (c) => `
    <button type="button" class="chat-conv-item ${c.id === activeConversationId ? "active" : ""}" data-conv-id="${c.id}">
      <span class="chat-conv-subject">${escapeHtml(c.subject)}</span>
      <span class="chat-conv-time">${escapeHtml(c.updatedAtFormatted || "")}</span>
    </button>`
    )
    .join("");

  listEl.querySelectorAll(".chat-conv-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      activeConversationId = btn.dataset.convId;
      listEl.querySelectorAll(".chat-conv-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      await loadMessages(activeConversationId);
    });
  });
}

async function loadMessages(conversationId) {
  const threadEl = document.getElementById("chat-messages");
  const headerEl = document.getElementById("chat-thread-header");
  if (!threadEl) return;

  try {
    const messages = await getMessages(conversationId);
    const convs = await getConversations();
    const conv = convs.find((c) => c.id === conversationId);
    if (headerEl && conv) {
      headerEl.textContent = conv.orderId
        ? `${conv.subject} · Order ${conv.orderId}`
        : conv.subject;
    }
    renderMessages(messages);
  } catch (err) {
    threadEl.innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderMessages(messages) {
  const threadEl = document.getElementById("chat-messages");
  if (!threadEl) return;

  if (!messages.length) {
    threadEl.innerHTML = `
      <div class="chat-empty-thread">
        <img src="images/jhul-waving.png" alt="" class="sticker" style="width:70px;" />
        <p>Say hi to Jhul! Ask about your order, payment, or rerolls.</p>
      </div>`;
    return;
  }

  threadEl.innerHTML = messages
    .map(
      (m) => `
    <div class="chat-bubble chat-bubble-${m.senderType}">
      <p>${escapeHtml(m.body)}</p>
      <time>${escapeHtml(m.createdAtFormatted || "")}</time>
    </div>`
    )
    .join("");

  threadEl.scrollTop = threadEl.scrollHeight;
}

async function sendCustomerMessage() {
  const input = document.getElementById("chat-input");
  const text = input?.value.trim();
  if (!text || !activeConversationId) return;

  input.disabled = true;
  try {
    await sendChatMessage(activeConversationId, text);
    input.value = "";
    await loadMessages(activeConversationId);
    await loadConversations();
  } catch (err) {
    alert(err.message);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

async function startNewConversation() {
  const subject = prompt("Chat subject (e.g. Order question):", "General");
  if (subject === null) return;
  try {
    const conv = await createConversation(subject.trim() || "General");
    activeConversationId = conv.id;
    await loadConversations();
    await loadMessages(conv.id);
  } catch (err) {
    alert(err.message);
  }
}

async function openOrderChat(order) {
  try {
    const convs = await getConversations();
    let conv = convs.find((c) => c.orderId === order.id);
    if (!conv) {
      conv = await createConversation(`Order ${order.id}`, order.id);
    }
    activeConversationId = conv.id;
    await loadConversations();
    await loadMessages(conv.id);

    if (order.username) {
      const input = document.getElementById("chat-input");
      if (input && !input.value) {
        input.placeholder = `Hi Jhul! I placed order ${order.id} for ${order.rerollAmount} rerolls…`;
      }
    }
  } catch (err) {
    alert(err.message);
  }
}

function setPendingOrderForChat(order) {
  pendingOrderForChat = order;
  const btn = document.getElementById("btn-message-jhul-order");
  if (btn) btn.classList.remove("hidden");
  showChatFab(true);
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!activeConversationId || document.getElementById("chat-panel")?.classList.contains("hidden")) return;
    try {
      await loadMessages(activeConversationId);
    } catch (_) {}
  }, 5000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

window.openChatPanel = openChatPanel;
window.setPendingOrderForChat = setPendingOrderForChat;
window.showChatFab = showChatFab;

document.addEventListener("DOMContentLoaded", initChat);
