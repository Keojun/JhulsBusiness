/**
 * Client-side auth guard (backup to server middleware).
 */

async function requireAuth() {
  if (document.body.dataset.publicPage === "true") return null;

  const customer = await getCurrentCustomer(true);
  if (!customer) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login?redirect=${redirect}`);
    return null;
  }

  return customer;
}

async function initAuthNav() {
  const customer = await requireAuth();
  if (!customer) return;

  const userLabel = document.getElementById("auth-user-label");
  if (userLabel) userLabel.textContent = customer.robloxUsername || customer.displayName;

  const chatBtn = document.getElementById("btn-open-chat");
  if (chatBtn) chatBtn.classList.remove("hidden");

  const usernameInput = document.getElementById("username");
  if (usernameInput && customer.robloxUsername && !usernameInput.value.trim()) {
    usernameInput.value = customer.robloxUsername;
  }

  document.getElementById("btn-logout-customer")?.addEventListener("click", async () => {
    await customerLogout();
    window.location.replace("/login");
  });

  document.dispatchEvent(new CustomEvent("rbxdisc:auth", { detail: { customer } }));
}

document.addEventListener("DOMContentLoaded", initAuthNav);
