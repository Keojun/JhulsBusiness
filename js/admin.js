/**
 * Admin panel — login validated server-side against Vercel ADMIN_PASSWORD env var.
 */

function initAdmin() {
  const loginForm = document.getElementById("admin-login");
  const loginSection = document.getElementById("login-section");
  const dashboard = document.getElementById("admin-dashboard");
  const dbStatus = document.getElementById("db-status");

  if (!loginForm) return;

  checkDatabaseHealth().then((health) => {
    if (dbStatus) {
      if (health.database === "connected") {
        dbStatus.innerHTML = "✅ Database connected";
        dbStatus.style.color = "#2d5a3d";
      } else {
        dbStatus.innerHTML = `⚠️ Database: ${health.database} — check Vercel env vars & run schema.sql`;
        dbStatus.style.color = "#7c4a1e";
      }
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("admin-password").value;
    const ok = await verifyAdminPassword(pw);

    if (ok) {
      setAdminPassword(pw);
      sessionStorage.setItem("jhul_admin", "1");
      loginSection.classList.add("hidden");
      dashboard.classList.remove("hidden");
      renderOrdersTable();
    } else {
      alert("Incorrect password. Use the ADMIN_PASSWORD you set in Vercel Environment Variables.");
    }
  });

  if (sessionStorage.getItem("jhul_admin") === "1" && sessionStorage.getItem("jhul_admin_pw")) {
    loginSection.classList.add("hidden");
    dashboard.classList.remove("hidden");
    renderOrdersTable();
  }
}

async function renderOrdersTable() {
  const tbody = document.getElementById("orders-tbody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;">Loading orders...</td></tr>';

  try {
    const orders = (await getOrders()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (orders.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;padding:2rem;">No orders yet. Place a test order on the Gakuran page first.</td></tr>';
      return;
    }

    tbody.innerHTML = orders
      .map(
        (o) => `
      <tr>
        <td><code>${o.id}</code></td>
        <td>${escapeHtml(o.username)}</td>
        <td>${o.rerollAmount}</td>
        <td>${o.pricePHP != null ? "₱" + Number(o.pricePHP).toFixed(2) : "—"}</td>
        <td>${o.paymentMethod === "paymaya" ? "Maya" : o.paymentMethod === "gcash" ? "GCash" : "—"}</td>
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
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#c0392b;">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function completeOrder(orderId) {
  try {
    const code = await completeOrderApi(orderId);
    alert(`Order completed!\n\nSend this Review Code to the customer:\n\n${code}\n\nThey can use it on the Gakuran page to leave a verified review.`);
    renderOrdersTable();
  } catch (err) {
    alert("Error: " + err.message);
  }
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
