/**
 * Admin panel — login, order dashboard, Philippines timezone display.
 */

let allOrders = [];
let currentFilter = "all";
let searchQuery = "";
let clockInterval = null;
let adminActiveView = "orders";
let adminConversations = [];
let adminActiveConvId = null;
let adminNotifyPoller = null;
let adminConvFingerprint = "";
let lastAdminTotalUnread = null;
const adminMessageCache = new Map();

function initAdmin() {
  const loginForm = document.getElementById("admin-login");
  const loginSection = document.getElementById("login-section");
  const dashboard = document.getElementById("admin-dashboard");
  const dbStatus = document.getElementById("db-status");
  const logoutBtn = document.getElementById("btn-logout");
  const refreshBtn = document.getElementById("btn-refresh");
  const searchInput = document.getElementById("admin-search");

  if (!loginForm) return;

  startManilaClock();

  checkDatabaseHealth().then((health) => {
    if (!dbStatus) return;
    if (health.database === "connected") {
      dbStatus.className = "admin-db-pill admin-db-ok";
      dbStatus.textContent = "✅ Database connected";
    } else if (health.database === "not_configured") {
      dbStatus.className = "admin-db-pill admin-db-warn";
      dbStatus.textContent = "⚠️ Database not configured — add Supabase env vars in Vercel";
    } else {
      dbStatus.className = "admin-db-pill admin-db-warn";
      dbStatus.textContent = health.message
        ? `⚠️ Database: ${health.message}`
        : `⚠️ Database: ${health.database} — check Vercel env vars`;
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("admin-password").value;
    const ok = await verifyAdminPassword(pw);

    if (ok) {
      setAdminPassword("");
      showDashboard();
    } else {
      showToast("Incorrect password. Check ADMIN_PASSWORD in Vercel.", "error");
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.disabled = true;
      const task = adminActiveView === "messages" ? loadAdminConversations() : renderOrders();
      task.finally(() => {
        refreshBtn.disabled = false;
        showToast(adminActiveView === "messages" ? "Messages refreshed" : "Orders refreshed", "success");
      });
    });
  }

  document.querySelectorAll(".admin-main-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchAdminView(tab.dataset.view));
  });

  document.getElementById("admin-chat-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await sendAdminReply();
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.trim().toLowerCase();
      renderOrderCards();
    });
  }

  document.querySelectorAll(".admin-filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-filter-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      renderOrderCards();
    });
  });

  checkAdminSession().then((loggedIn) => {
    if (loggedIn) showDashboard();
  });
}

function showDashboard() {
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.remove("hidden");
  document.getElementById("btn-logout").classList.remove("hidden");
  startAdminNotifyPoll();
  switchAdminView("orders");
}

function switchAdminView(view) {
  adminActiveView = view;
  document.querySelectorAll(".admin-main-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === view);
  });
  document.getElementById("admin-view-orders").classList.toggle("hidden", view !== "orders");
  document.getElementById("admin-view-messages").classList.toggle("hidden", view !== "messages");

  if (view === "orders") {
    renderOrders();
  } else {
    loadAdminConversations();
  }
}

window.openAdminChatForOrder = function (orderId) {
  switchAdminView("messages");
  const conv = adminConversations.find((c) => c.orderId === orderId);
  if (conv) {
    selectAdminConversation(conv.id);
  } else {
    showToast("No chat yet for this order — customer may message you first.", "error");
  }
};

async function logout() {
  await adminLogout();
  stopAdminNotifyPoll();
  setDocumentTitleBadge(0, "Admin — RBXDISC");
  document.getElementById("login-section").classList.remove("hidden");
  document.getElementById("admin-dashboard").classList.add("hidden");
  document.getElementById("btn-logout").classList.add("hidden");
  document.getElementById("admin-password").value = "";
  allOrders = [];
  adminConversations = [];
  adminActiveConvId = null;
  lastAdminTotalUnread = null;
}

function startManilaClock() {
  const clockEl = document.getElementById("admin-clock");
  if (!clockEl) return;

  function tick() {
    clockEl.textContent = "🇵🇭 " + formatPhilippinesTime(new Date());
  }

  tick();
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(tick, 30000);
}

function getOrderDateTime(order) {
  if (order.createdAt) return formatPhilippinesDateTime(order.createdAt);
  if (order.date) return order.date;
  return "—";
}

function formatPrice(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return "₱" + Number(amount).toFixed(2);
}

function paymentLabel(method) {
  if (method === "paymaya") return "Maya";
  if (method === "gcash") return "GCash";
  return "—";
}

function paymentClass(method) {
  if (method === "paymaya") return "pay-maya";
  if (method === "gcash") return "pay-gcash";
  return "pay-unknown";
}

async function renderOrders() {
  const loading = document.getElementById("orders-loading");
  const grid = document.getElementById("orders-grid");
  const empty = document.getElementById("orders-empty");

  loading.classList.remove("hidden");
  grid.classList.add("hidden");
  empty.classList.add("hidden");

  try {
    allOrders = (await getOrders()).sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    updateStats();
    renderOrderCards();
  } catch (err) {
    loading.classList.add("hidden");
    grid.classList.remove("hidden");
    grid.innerHTML = `<div class="admin-error">${escapeHtml(err.message)}</div>`;
    showToast(err.message, "error");
  }
}

function updateStats() {
  const activeOrders = allOrders.filter((o) => o.status !== "voided");
  const pending = activeOrders.filter((o) => o.status === "pending").length;
  const completed = activeOrders.filter((o) => o.status === "completed").length;
  const revenue = activeOrders.reduce((sum, o) => sum + (Number(o.pricePHP) || 0), 0);

  document.getElementById("stat-pending").textContent = pending;
  document.getElementById("stat-completed").textContent = completed;
  document.getElementById("stat-total").textContent = activeOrders.length;
  document.getElementById("stat-revenue").textContent = formatPrice(revenue);
}

function getFilteredOrders() {
  return allOrders.filter((o) => {
    const status = o.status || "pending";
    if (currentFilter !== "all" && status !== currentFilter) return false;

    if (!searchQuery) return true;
    const haystack = `${o.id} ${o.username}`.toLowerCase();
    return haystack.includes(searchQuery);
  });
}

function renderOrderCards() {
  const loading = document.getElementById("orders-loading");
  const grid = document.getElementById("orders-grid");
  const empty = document.getElementById("orders-empty");
  const orders = getFilteredOrders();

  loading.classList.add("hidden");

  if (allOrders.length === 0) {
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  grid.classList.remove("hidden");

  if (orders.length === 0) {
    grid.innerHTML = `
      <div class="admin-no-results">
        <p>No orders match your filter or search.</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="clearFilters()">Clear filters</button>
      </div>`;
    return;
  }

  grid.innerHTML = orders.map(renderOrderCard).join("");
}

function renderOrderCard(o) {
  const status = o.status || "pending";
  const dateTime = getOrderDateTime(o);

  return `
    <article class="admin-order-card status-border-${status}">
      <div class="admin-order-card-top">
        <code class="admin-order-id">${escapeHtml(o.id)}</code>
        <span class="status-badge status-${status}">${status}</span>
      </div>

      <div class="admin-order-meta">
        <div class="admin-order-field">
          <span class="admin-order-label">Username</span>
          <span class="admin-order-value">${escapeHtml(o.username)}</span>
        </div>
        <div class="admin-order-field">
          <span class="admin-order-label">Rerolls</span>
          <span class="admin-order-value admin-order-rerolls">${o.rerollAmount}</span>
        </div>
        <div class="admin-order-field">
          <span class="admin-order-label">Price</span>
          <span class="admin-order-value admin-order-price">${formatPrice(o.pricePHP)}</span>
        </div>
        <div class="admin-order-field">
          <span class="admin-order-label">Payment</span>
          <span class="payment-badge ${paymentClass(o.paymentMethod)}">${paymentLabel(o.paymentMethod)}</span>
        </div>
      </div>

      <div class="admin-order-datetime">
        <span class="admin-order-label">Ordered (PH Time)</span>
        <time datetime="${escapeHtml(o.createdAt || "")}">${escapeHtml(dateTime)}</time>
      </div>

      <div class="admin-order-actions">
        ${
          status === "pending"
            ? `<button type="button" class="btn btn-outline btn-sm btn-void-order" data-id="${escapeHtml(o.id)}">🗑 Void (no payment)</button>
               <button type="button" class="btn btn-green btn-sm btn-complete" data-id="${escapeHtml(o.id)}">✓ Complete & Generate Code</button>`
            : ""
        }
        ${
          status === "voided"
            ? `<span class="admin-order-voided-note">Voided — excluded from revenue</span>`
            : ""
        }
        ${
          o.reviewCode
            ? `<button type="button" class="btn btn-outline btn-sm btn-copy-code" data-code="${escapeHtml(o.reviewCode)}">📋 ${escapeHtml(o.reviewCode)}</button>`
            : ""
        }
        ${
          o.customerId
            ? `<button type="button" class="btn btn-outline btn-sm btn-order-chat" data-order-id="${escapeHtml(o.id)}">💬 Chat</button>`
            : ""
        }
      </div>
    </article>
  `;
}

function clearFilters() {
  currentFilter = "all";
  searchQuery = "";
  document.getElementById("admin-search").value = "";
  document.querySelectorAll(".admin-filter-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.filter === "all");
  });
  renderOrderCards();
}

window.clearFilters = clearFilters;

document.addEventListener("click", (e) => {
  const completeBtn = e.target.closest(".btn-complete");
  if (completeBtn) {
    completeOrder(completeBtn.dataset.id);
    return;
  }

  const copyBtn = e.target.closest(".btn-copy-code");
  if (copyBtn) {
    copyCode(copyBtn.dataset.code);
    return;
  }

  const chatBtn = e.target.closest(".btn-order-chat");
  if (chatBtn) {
    openAdminChatForOrder(chatBtn.dataset.orderId);
    return;
  }

  const voidBtn = e.target.closest(".btn-void-order");
  if (voidBtn) {
    voidOrder(voidBtn.dataset.id);
  }
});

async function completeOrder(orderId) {
  const btn = document.querySelector(`.btn-complete[data-id="${orderId}"]`);
  if (btn) btn.disabled = true;

  try {
    const code = await completeOrderApi(orderId);
    showToast(`Order completed! Code: ${code}`, "success", 6000);
    await renderOrders();
  } catch (err) {
    showToast("Error: " + err.message, "error");
    if (btn) btn.disabled = false;
  }
}

async function voidOrder(orderId) {
  const order = allOrders.find((o) => o.id === orderId);
  const priceLabel = order ? formatPrice(order.pricePHP) : "";

  const confirmed = window.confirm(
    `Void order ${orderId}?${priceLabel ? `\n\nThis removes ${priceLabel} from your revenue total.` : ""}\n\nThe customer will see: "Order has been voided due to no payment."`
  );
  if (!confirmed) return;

  const btn = document.querySelector(`.btn-void-order[data-id="${orderId}"]`);
  if (btn) btn.disabled = true;

  try {
    await voidOrderApi(orderId);
    showToast("Order voided — revenue updated", "success");
    await renderOrders();
  } catch (err) {
    showToast("Error: " + err.message, "error");
    if (btn) btn.disabled = false;
  }
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast(`Copied: ${code}`, "success");
  }).catch(() => {
    showToast("Could not copy — select and copy manually", "error");
  });
}

function showToast(message, type = "success", duration = 3500) {
  const toast = document.getElementById("admin-toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `admin-toast admin-toast-${type}`;
  toast.classList.remove("hidden");

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, duration);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadAdminConversations(silent = false) {
  const listEl = document.getElementById("admin-conv-list");
  if (!listEl) return;

  if (!silent) {
    listEl.innerHTML = '<p class="chat-loading">Loading conversations…</p>';
  }

  try {
    adminConversations = await getConversations(true);
    adminConvFingerprint = convListFingerprint(adminConversations);
    lastAdminTotalUnread = totalUnreadCount(adminConversations);
    updateChatBadge(document.getElementById("admin-messages-badge"), lastAdminTotalUnread);
    renderAdminConvList();
    if (adminActiveConvId) {
      await loadAdminMessages(adminActiveConvId, { forceFull: !silent });
    }
  } catch (err) {
    if (!silent) {
      listEl.innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
    }
  }
}

function renderAdminConvList() {
  const listEl = document.getElementById("admin-conv-list");
  if (!listEl) return;

  if (!adminConversations.length) {
    listEl.innerHTML = '<p class="chat-empty">No customer messages yet.</p>';
    return;
  }

  listEl.innerHTML = adminConversations
    .map(
      (c) => `
    <button type="button" class="admin-conv-item ${c.id === adminActiveConvId ? "active" : ""} ${c.unreadCount ? "has-unread" : ""}" data-conv-id="${c.id}">
      <span class="admin-conv-name">${escapeHtml(c.customerName)}${unreadBadgeHtml(c.unreadCount)}</span>
      <span class="admin-conv-meta">${escapeHtml(c.customerRoblox || c.customerEmail || "")}</span>
      <span class="admin-conv-subject">${escapeHtml(c.subject)}${c.orderId ? ` · ${escapeHtml(c.orderId)}` : ""}</span>
      <span class="admin-conv-time">${escapeHtml(c.updatedAtFormatted || "")}</span>
    </button>`
    )
    .join("");

  listEl.querySelectorAll(".admin-conv-item").forEach((btn) => {
    btn.addEventListener("click", () => selectAdminConversation(btn.dataset.convId));
  });
}

async function selectAdminConversation(convId) {
  adminActiveConvId = convId;
  adminMessageCache.delete(convId);
  renderAdminConvList();
  await loadAdminMessages(convId, { forceFull: true });
  document.getElementById("admin-chat-form")?.classList.remove("hidden");
}

async function loadAdminMessages(convId, options = {}) {
  const threadEl = document.getElementById("admin-chat-messages");
  const headerEl = document.getElementById("admin-chat-header");
  const conv = adminConversations.find((c) => c.id === convId);

  if (headerEl && conv) {
    headerEl.innerHTML = `
      <strong>${escapeHtml(conv.customerName)}</strong>
      <span>${escapeHtml(conv.customerRoblox || "")} · ${escapeHtml(conv.subject)}</span>
      ${conv.orderId ? `<span class="admin-chat-order-tag">Order: ${escapeHtml(conv.orderId)}</span>` : ""}`;
  }

  if (!threadEl) return;

  try {
    const cached = adminMessageCache.get(convId) || [];
    const since = options.forceFull ? null : getLastMessageTimestamp(cached);
    const messages = await getMessages(convId, true, since);

    if (since && messages.length) {
      const merged = [...cached, ...messages];
      adminMessageCache.set(convId, merged);
      appendMessages(threadEl, messages);
      return;
    }

    const fullMessages = since ? cached : messages;
    adminMessageCache.set(convId, fullMessages);
    renderMessageThread(threadEl, fullMessages, { forceScroll: options.forceFull !== false });
  } catch (err) {
    if (!options.silent) {
      threadEl.innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
    }
  }
}

async function refreshAdminNotifications() {
  try {
    const convs = await getConversations(true);
    adminConversations = convs;
    const total = totalUnreadCount(convs);

    updateChatBadge(document.getElementById("admin-messages-badge"), total);
    setDocumentTitleBadge(total, "Admin — RBXDISC");

    if (lastAdminTotalUnread !== null && total > lastAdminTotalUnread) {
      const newestUnread = convs.find((c) => c.unreadCount > 0);
      if (newestUnread && shouldNotifyAdmin(newestUnread)) {
        notifyNewMessage({
          title: "New customer message",
          body: `${newestUnread.customerName} sent a message`,
          tag: `admin-${newestUnread.id}`,
        });
      }
    }
    lastAdminTotalUnread = total;

    if (document.hidden || adminActiveView !== "messages") return;

    const fingerprint = convListFingerprint(convs);
    if (fingerprint !== adminConvFingerprint) {
      adminConvFingerprint = fingerprint;
    }
    renderAdminConvList();

    if (adminActiveConvId) {
      await loadAdminMessages(adminActiveConvId, { silent: true });
    }
  } catch (_) {}
}

function shouldNotifyAdmin(conv) {
  if (adminActiveView !== "messages") return true;
  return adminActiveConvId !== conv.id;
}

async function sendAdminReply() {
  const input = document.getElementById("admin-chat-input");
  const threadEl = document.getElementById("admin-chat-messages");
  const text = input?.value.trim();
  if (!text || !adminActiveConvId) return;

  const tempId = `pending-${Date.now()}`;
  const optimistic = {
    id: tempId,
    senderType: "admin",
    body: text,
    createdAtFormatted: "Sending…",
    pending: true,
  };

  appendMessages(threadEl, [optimistic], { forceScroll: true });
  input.value = "";
  input.disabled = true;

  try {
    const sent = await sendChatMessage(adminActiveConvId, text, true);
    replacePendingMessage(threadEl, tempId, sent);

    const cached = adminMessageCache.get(adminActiveConvId) || [];
    const withoutPending = cached.filter((m) => m.id !== tempId);
    adminMessageCache.set(adminActiveConvId, [...withoutPending, sent]);

    await loadAdminConversations(true);
  } catch (err) {
    removePendingMessage(threadEl, tempId);
    input.value = text;
    showToast(err.message, "error");
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function startAdminNotifyPoll() {
  stopAdminNotifyPoll();
  setLiveBadge(document.getElementById("admin-chat-live"), true);
  adminNotifyPoller = createChatPoller(refreshAdminNotifications, CHAT_POLL_ADMIN_MS);
  adminNotifyPoller.start();
}

function stopAdminNotifyPoll() {
  adminNotifyPoller?.stop();
  adminNotifyPoller = null;
  setLiveBadge(document.getElementById("admin-chat-live"), false);
}

document.addEventListener("DOMContentLoaded", initAdmin);
