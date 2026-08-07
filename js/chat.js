/**
 * Customer chat with Jhul — slide-out panel + floating bubble on Gakuran page
 */

let activeConversationId = null;
let customerChatPoller = null;
let customerNotifyPoller = null;
let pendingOrderForChat = null;
const customerMessageCache = new Map();
let customerConvFingerprint = "";
let lastCustomerTotalUnread = null;

function orderLinkedConversations(convs) {
  if (!Array.isArray(convs)) return [];
  return convs.filter((c) => c.orderId);
}

function resetCustomerChatState() {
  closeChatPanel();
  activeConversationId = null;
  pendingOrderForChat = null;
  customerMessageCache.clear();
  customerConvFingerprint = "";
  lastCustomerTotalUnread = null;
  hideChatFab();
  stopCustomerNotifyPoll();
  stopPolling();
  updateCustomerChatBadges(0);
  setDocumentTitleBadge(0);
}

function initChat() {
  const openBtn = document.getElementById("btn-open-chat");
  const headerChatBtn = document.getElementById("btn-header-chat");
  const fab = document.getElementById("chat-fab");
  const closeBtn = document.getElementById("btn-close-chat");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  openBtn?.addEventListener("click", () => openChatPanel(pendingOrderForChat || null));
  headerChatBtn?.addEventListener("click", () => openChatPanel(pendingOrderForChat || null));
  fab?.addEventListener("click", () => openChatPanel(pendingOrderForChat || null));
  closeBtn?.addEventListener("click", () => closeChatPanel());

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await sendCustomerMessage();
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form?.requestSubmit();
    }
  });

  input?.addEventListener("input", autoResizeChatInput);

  document.addEventListener("rbxdisc:auth", (e) => {
    if (e.detail.customer) {
      showChatFab(false);
      startCustomerNotifyPoll();
    } else {
      resetCustomerChatState();
    }
  });

  document.addEventListener("rbxdisc:logout", () => {
    resetCustomerChatState();
  });

  document.getElementById("btn-message-jhul-order")?.addEventListener("click", () => {
    if (pendingOrderForChat) {
      openChatPanel(pendingOrderForChat);
    }
  });
}

function autoResizeChatInput() {
  const input = document.getElementById("chat-input");
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function setChatComposerEnabled(enabled, hint) {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const hintEl = document.getElementById("chat-composer-hint");
  const composer = document.querySelector(".chat-composer");

  form?.classList.toggle("chat-form-disabled", !enabled);
  composer?.classList.toggle("chat-composer-disabled", !enabled);
  if (input) {
    input.disabled = !enabled;
    if (!enabled) input.value = "";
  }
  if (hintEl && hint !== undefined) {
    hintEl.textContent = hint;
  }
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
    stopCustomerNotifyPoll();
  });
}

function clearConversationCache(conversationId) {
  if (conversationId) customerMessageCache.delete(conversationId);
}

function closeChatPanel() {
  document.getElementById("chat-panel")?.classList.add("hidden");
  document.body.classList.remove("chat-open");
  stopPolling();

  getCurrentCustomer().then((c) => {
    if (c && document.getElementById("chat-fab-wrap")) {
      showChatFab(false);
      startCustomerNotifyPoll();
    }
  });
}

async function showOrderPickerState() {
  const threadEl = document.getElementById("chat-messages");
  const headerEl = document.getElementById("chat-thread-header");
  if (!threadEl) return;

  activeConversationId = null;
  setChatComposerEnabled(false, "Place or select an order to start chatting");

  if (headerEl) headerEl.textContent = "Choose an order";

  threadEl.innerHTML = '<p class="chat-loading">Loading your orders…</p>';

  try {
    const orders = await getCustomerOrders();

    if (!orders.length) {
      threadEl.innerHTML = `
        <div class="chat-empty-thread chat-order-prompt">
          <img src="images/jhul-waving.png" alt="" class="sticker" style="width:72px;" />
          <h4>Chat opens after you order</h4>
          <p>Place a Gakuran reroll order first — then you can message Jhul about payment, delivery, or your rerolls.</p>
          <a href="#order-form" class="btn btn-primary btn-sm chat-order-cta" id="chat-go-order">Go to order form</a>
        </div>`;
      document.getElementById("chat-go-order")?.addEventListener("click", () => {
        closeChatPanel();
        document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" });
      });
      return;
    }

    const items = orders
      .map(
        (o) => `
      <button type="button" class="chat-order-pick" data-order-id="${escapeHtml(o.id)}">
        <span class="chat-order-pick-id">${escapeHtml(o.id)}</span>
        <span class="chat-order-pick-meta">${escapeHtml(o.rerollAmount)} rerolls · ${escapeHtml(o.status || "pending")}</span>
        <span class="chat-order-pick-date">${escapeHtml(o.date || "")}</span>
      </button>`
      )
      .join("");

    threadEl.innerHTML = `
      <div class="chat-empty-thread chat-order-prompt">
        <img src="images/jhul-waving.png" alt="" class="sticker" style="width:72px;" />
        <h4>Message Jhul about an order</h4>
        <p>Pick which order you want to talk about:</p>
        <div class="chat-order-list">${items}</div>
      </div>`;

    threadEl.querySelectorAll(".chat-order-pick").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const order = orders.find((o) => o.id === btn.dataset.orderId);
        if (order) await openOrderChat(order);
      });
    });
  } catch (err) {
    threadEl.innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadConversations() {
  const listEl = document.getElementById("chat-conv-list");
  if (!listEl) return;

  listEl.innerHTML = '<p class="chat-loading">Loading chats…</p>';

  try {
    const allConvs = await getConversations();
    const convs = orderLinkedConversations(allConvs);
    customerConvFingerprint = convListFingerprint(convs);

    if (convs.length === 0) {
      renderConversationList([]);
      renderConvChips([]);
      await showOrderPickerState();
      return;
    }

    renderConversationList(convs);
    renderConvChips(convs);
    applyCustomerUnreadState(convs, { notify: false });
    setChatComposerEnabled(true, "Type your message below");

    if (!activeConversationId || !convs.find((c) => c.id === activeConversationId)) {
      activeConversationId = convs[0].id;
    }
    await loadMessages(activeConversationId, { forceFull: true });
  } catch (err) {
    listEl.innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderConvChips(convs) {
  const chipsEl = document.getElementById("chat-conv-chips");
  if (!chipsEl) return;

  if (!convs.length || convs.length === 1) {
    chipsEl.classList.add("hidden");
    chipsEl.innerHTML = "";
    return;
  }

  chipsEl.classList.remove("hidden");
  chipsEl.innerHTML = convs
    .map(
      (c) => `
    <button type="button" class="chat-conv-chip ${c.id === activeConversationId ? "active" : ""} ${c.unreadCount ? "has-unread" : ""}" data-conv-id="${c.id}">
      ${escapeHtml(c.orderId ? `Order ${c.orderId}` : c.subject)}${unreadBadgeHtml(c.unreadCount)}
    </button>`
    )
    .join("");

  chipsEl.querySelectorAll(".chat-conv-chip").forEach((btn) => {
    btn.addEventListener("click", async () => {
      activeConversationId = btn.dataset.convId;
      clearConversationCache(activeConversationId);
      chipsEl.querySelectorAll(".chat-conv-chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("chat-conv-list")?.querySelectorAll(".chat-conv-item").forEach((b) => {
        b.classList.toggle("active", b.dataset.convId === activeConversationId);
      });
      setChatComposerEnabled(true, "Type your message below");
      await loadMessages(activeConversationId, { forceFull: true });
    });
  });
}

function renderConversationList(convs) {
  const listEl = document.getElementById("chat-conv-list");
  if (!listEl) return;

  if (!convs.length) {
    listEl.innerHTML = '<p class="chat-empty">No chats yet — pick an order below.</p>';
    return;
  }

  listEl.innerHTML = convs
    .map(
      (c) => `
    <button type="button" class="chat-conv-item ${c.id === activeConversationId ? "active" : ""} ${c.unreadCount ? "has-unread" : ""}" data-conv-id="${c.id}">
      <span class="chat-conv-subject">${escapeHtml(c.orderId ? `Order ${c.orderId}` : c.subject)}${unreadBadgeHtml(c.unreadCount)}</span>
      <span class="chat-conv-time">${escapeHtml(c.updatedAtFormatted || "")}</span>
    </button>`
    )
    .join("");

  listEl.querySelectorAll(".chat-conv-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      activeConversationId = btn.dataset.convId;
      clearConversationCache(activeConversationId);
      listEl.querySelectorAll(".chat-conv-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("chat-conv-chips")?.querySelectorAll(".chat-conv-chip").forEach((b) => {
        b.classList.toggle("active", b.dataset.convId === activeConversationId);
      });
      setChatComposerEnabled(true, "Type your message below");
      await loadMessages(activeConversationId, { forceFull: true });
    });
  });
}

async function loadMessages(conversationId, options = {}) {
  const threadEl = document.getElementById("chat-messages");
  const headerEl = document.getElementById("chat-thread-header");
  if (!threadEl) return;

  try {
    if (!options.silent) {
      const convs = orderLinkedConversations(await getConversations());
      const conv = convs.find((c) => c.id === conversationId);
      if (headerEl && conv) {
        headerEl.textContent = conv.orderId
          ? `Order ${conv.orderId} · ${conv.rerollAmount ? conv.rerollAmount + " rerolls" : conv.subject}`
          : conv.subject;
      } else if (!conv && headerEl) {
        headerEl.textContent = "Choose an order";
        await showOrderPickerState();
        return;
      }
    }

    const cached = customerMessageCache.get(conversationId) || [];
    const since = options.forceFull ? null : getLastMessageTimestamp(cached);
    const messages = await getMessages(conversationId, false, since);

    if (since && messages.length) {
      const merged = [...cached, ...messages];
      customerMessageCache.set(conversationId, merged);
      appendMessages(threadEl, messages);
      return;
    }

    const fullMessages = since ? cached : messages;
    customerMessageCache.set(conversationId, fullMessages);
    renderMessageThread(threadEl, fullMessages, {
      forceScroll: options.forceScroll !== false,
    });
  } catch (err) {
    if (!options.silent) {
      threadEl.innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
    }
  }
}

async function refreshCustomerChatLive() {
  if (!activeConversationId || document.getElementById("chat-panel")?.classList.contains("hidden")) {
    return;
  }
  if (document.hidden) return;

  try {
    const convs = orderLinkedConversations(await getConversations());
    applyCustomerUnreadState(convs, { notify: false });

    const fingerprint = convListFingerprint(convs);
    if (fingerprint !== customerConvFingerprint) {
      customerConvFingerprint = fingerprint;
      renderConversationList(convs);
      renderConvChips(convs);
    }
    await loadMessages(activeConversationId, { silent: true, forceScroll: false });
  } catch (_) {}
}

function updateCustomerChatBadges(total) {
  updateChatBadge(document.getElementById("chat-fab-badge"), total);
  updateChatBadge(document.getElementById("header-chat-badge"), total);
  updateChatBadge(document.getElementById("nav-chat-badge"), total);
}

function applyCustomerUnreadState(convs, options = {}) {
  const total = totalUnreadCount(convs);
  updateCustomerChatBadges(total);
  setDocumentTitleBadge(total);

  if (
    options.notify &&
    lastCustomerTotalUnread !== null &&
    total > lastCustomerTotalUnread
  ) {
    const panelClosed = document.getElementById("chat-panel")?.classList.contains("hidden");
    const unreadConv = convs.find((c) => c.unreadCount > 0);
    const viewingUnread =
      !panelClosed && unreadConv && activeConversationId === unreadConv.id;

    if (panelClosed || !viewingUnread) {
      notifyNewMessage({
        title: "Jhul replied",
        body: unreadConv
          ? `New message in ${unreadConv.orderId ? "Order " + unreadConv.orderId : unreadConv.subject}`
          : "You have a new message from Jhul",
        tag: "customer-chat",
      });
    }
  }

  lastCustomerTotalUnread = total;
}

async function refreshCustomerNotifications() {
  if (!document.getElementById("chat-panel")?.classList.contains("hidden")) return;

  try {
    const convs = orderLinkedConversations(await getConversations());
    applyCustomerUnreadState(convs, { notify: true });
    customerConvFingerprint = convListFingerprint(convs);
  } catch (_) {}
}

function startCustomerNotifyPoll() {
  stopCustomerNotifyPoll();
  refreshCustomerNotifications();
  customerNotifyPoller = createChatPoller(refreshCustomerNotifications, CHAT_POLL_CUSTOMER_MS);
  customerNotifyPoller.start();
}

function stopCustomerNotifyPoll() {
  customerNotifyPoller?.stop();
  customerNotifyPoller = null;
}

async function sendCustomerMessage() {
  const input = document.getElementById("chat-input");
  const threadEl = document.getElementById("chat-messages");
  const text = input?.value.trim();
  if (!text || !activeConversationId) return;

  const tempId = `pending-${Date.now()}`;
  const optimistic = {
    id: tempId,
    senderType: "customer",
    body: text,
    createdAtFormatted: "Sending…",
    pending: true,
  };

  appendMessages(threadEl, [optimistic], { forceScroll: true });
  input.value = "";
  autoResizeChatInput();
  input.disabled = true;

  try {
    const sent = await sendChatMessage(activeConversationId, text);
    replacePendingMessage(threadEl, tempId, sent);

    const cached = customerMessageCache.get(activeConversationId) || [];
    customerMessageCache.set(
      activeConversationId,
      [...cached.filter((m) => m.id !== tempId), sent]
    );

    await loadConversations();
  } catch (err) {
    removePendingMessage(threadEl, tempId);
    input.value = text;
    autoResizeChatInput();
    alert(err.message);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

async function openOrderChat(order) {
  try {
    const convs = orderLinkedConversations(await getConversations());
    let conv = convs.find((c) => c.orderId === order.id);
    if (!conv) {
      conv = await createConversation(`Order ${order.id}`, order.id);
    }
    activeConversationId = conv.id;
    clearConversationCache(conv.id);
    setChatComposerEnabled(true, "Type your message below");
    await loadConversations();
    await loadMessages(conv.id, { forceFull: true });

    const input = document.getElementById("chat-input");
    if (input && !input.value) {
      input.placeholder = `Hi Jhul! About order ${order.id} (${order.rerollAmount} rerolls)…`;
    }
    input?.focus();
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
  customerChatPoller = createChatPoller(refreshCustomerChatLive, CHAT_POLL_CUSTOMER_MS);
  customerChatPoller.start();
}

function stopPolling() {
  customerChatPoller?.stop();
  customerChatPoller = null;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

window.openChatPanel = openChatPanel;
window.setPendingOrderForChat = setPendingOrderForChat;
window.showChatFab = showChatFab;
window.startCustomerNotifyPoll = startCustomerNotifyPoll;

document.addEventListener("DOMContentLoaded", initChat);
