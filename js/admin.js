/**
 * Admin panel — login, order dashboard, Philippines timezone display.
 */

let allOrders = [];
let currentFilter = "all";
let searchQuery = "";
let clockInterval = null;

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
    } else {
      dbStatus.className = "admin-db-pill admin-db-warn";
      dbStatus.textContent = `⚠️ Database: ${health.database} — check Vercel env vars`;
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("admin-password").value;
    const ok = await verifyAdminPassword(pw);

    if (ok) {
      setAdminPassword(pw);
      sessionStorage.setItem("jhul_admin", "1");
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
      renderOrders().finally(() => {
        refreshBtn.disabled = false;
        showToast("Orders refreshed", "success");
      });
    });
  }

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

  if (sessionStorage.getItem("jhul_admin") === "1" && sessionStorage.getItem("jhul_admin_pw")) {
    showDashboard();
  }
}

function showDashboard() {
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.remove("hidden");
  document.getElementById("btn-logout").classList.remove("hidden");
  renderOrders();
}

function logout() {
  sessionStorage.removeItem("jhul_admin");
  sessionStorage.removeItem("jhul_admin_pw");
  document.getElementById("login-section").classList.remove("hidden");
  document.getElementById("admin-dashboard").classList.add("hidden");
  document.getElementById("btn-logout").classList.add("hidden");
  document.getElementById("admin-password").value = "";
  allOrders = [];
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
  const pending = allOrders.filter((o) => o.status === "pending").length;
  const completed = allOrders.filter((o) => o.status === "completed").length;
  const revenue = allOrders.reduce((sum, o) => sum + (Number(o.pricePHP) || 0), 0);

  document.getElementById("stat-pending").textContent = pending;
  document.getElementById("stat-completed").textContent = completed;
  document.getElementById("stat-total").textContent = allOrders.length;
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
            ? `<button type="button" class="btn btn-green btn-sm btn-complete" data-id="${escapeHtml(o.id)}">✓ Complete & Generate Code</button>`
            : ""
        }
        ${
          o.reviewCode
            ? `<button type="button" class="btn btn-outline btn-sm btn-copy-code" data-code="${escapeHtml(o.reviewCode)}">📋 ${escapeHtml(o.reviewCode)}</button>`
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

document.addEventListener("DOMContentLoaded", initAdmin);
