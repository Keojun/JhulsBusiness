/**
 * Admin panel — manages orders via Supabase API (or localStorage fallback).
 */

const ADMIN_PASSWORD = "jhul2026";

function initAdmin() {
  const loginForm = document.getElementById("admin-login");
  const loginSection = document.getElementById("login-section");
  const dashboard = document.getElementById("admin-dashboard");

  if (!loginForm) return;

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pw = document.getElementById("admin-password").value;
    if (pw === ADMIN_PASSWORD) {
      setAdminPassword(pw);
      sessionStorage.setItem("jhul_admin", "1");
      loginSection.classList.add("hidden");
      dashboard.classList.remove("hidden");
      renderOrdersTable();
    } else {
      alert("Incorrect password.");
    }
  });

  if (sessionStorage.getItem("jhul_admin") === "1") {
    loginSection.classList.add("hidden");
    dashboard.classList.remove("hidden");
    renderOrdersTable();
  }
}

async function renderOrdersTable() {
  const tbody = document.getElementById("orders-tbody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">Loading orders...</td></tr>';

  const orders = (await getOrders()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  if (orders.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:2rem;">No orders yet. Orders appear here when customers place them on the Gakuran page.</td></tr>';
    return;
  }

  tbody.innerHTML = orders
    .map(
      (o) => `
    <tr>
      <td><code>${o.id}</code></td>
      <td>${escapeHtml(o.username)}</td>
      <td>${o.rerollAmount}</td>
      <td>${o.date || new Date(o.createdAt).toLocaleString("en-PH")}</td>
      <td><span class="status-badge status-${o.status || "pending"}">${o.status || "pending"}</span></td>
      <td class="admin-actions">
        ${
          o.status === "pending"
            ? `<button class="btn-complete" onclick="completeOrder('${o.id}')">Complete & Generate Code</button>`
            : ""
        }
        ${
          o.reviewCode
            ? `<button class="btn-copy" onclick="copyCode('${o.reviewCode}')">Copy: ${o.reviewCode}</button>`
            : ""
        }
      </td>
    </tr>
  `
    )
    .join("");
}

async function completeOrder(orderId) {
  const code = await completeOrderApi(orderId);
  alert(`Order completed!\n\nSend this Review Code to the customer:\n\n${code}\n\nThey can use it on the Gakuran page to leave a verified review.`);
  renderOrdersTable();
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    alert(`Copied: ${code}`);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initAdmin);
