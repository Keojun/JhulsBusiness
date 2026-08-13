/**
 * Optional customer auth — pages are public; login required to order or chat.
 */

function authRedirectPath() {
  return window.location.pathname + window.location.search;
}

function buildLoginUrl(redirectPath) {
  const path = redirectPath || authRedirectPath();
  return `/login?redirect=${encodeURIComponent(path)}`;
}

function buildSignupUrl(redirectPath) {
  return `${buildLoginUrl(redirectPath)}&tab=signup`;
}

async function requireLoginForAction(redirectPath) {
  const customer = await getCurrentCustomer(true);
  if (customer) return customer;
  window.location.replace(buildLoginUrl(redirectPath));
  return null;
}

function updateGuestAuthLinks() {
  const redirect = encodeURIComponent(authRedirectPath());
  const loginLink = document.getElementById("nav-login-link");
  const signupLink = document.getElementById("nav-signup-link");
  if (loginLink) loginLink.href = `/login?redirect=${redirect}`;
  if (signupLink) signupLink.href = `/login?redirect=${redirect}&tab=signup`;
}

function applyGuestNav() {
  document.getElementById("auth-user-pill")?.classList.add("hidden");
  document.getElementById("btn-logout-customer")?.classList.add("hidden");
  document.getElementById("btn-open-chat")?.classList.add("hidden");
  document.getElementById("btn-header-chat")?.classList.add("hidden");
  document.getElementById("nav-guest-auth")?.classList.remove("hidden");
  updateGuestAuthLinks();

  if (typeof hideChatFab === "function") hideChatFab();

  document.dispatchEvent(new CustomEvent("rbxdisc:auth", { detail: { customer: null } }));
}

function applyLoggedInNav(customer) {
  const userLabel = document.getElementById("auth-user-label");
  if (userLabel) userLabel.textContent = customer.robloxUsername || customer.displayName;

  document.getElementById("auth-user-pill")?.classList.remove("hidden");
  document.getElementById("btn-logout-customer")?.classList.remove("hidden");
  document.getElementById("nav-guest-auth")?.classList.add("hidden");

  const chatBtn = document.getElementById("btn-open-chat");
  if (chatBtn) chatBtn.classList.remove("hidden");

  const headerChatBtn = document.getElementById("btn-header-chat");
  if (headerChatBtn) headerChatBtn.classList.remove("hidden");

  if (typeof showChatFab === "function") showChatFab(false);

  const usernameInput = document.getElementById("username");
  if (usernameInput && customer.robloxUsername && !usernameInput.value.trim()) {
    usernameInput.value = customer.robloxUsername;
  }

  document.dispatchEvent(new CustomEvent("rbxdisc:auth", { detail: { customer } }));
}

async function initAuthNav() {
  if (document.body.dataset.publicPage === "true") return;

  document.getElementById("btn-logout-customer")?.addEventListener("click", async () => {
    await customerLogout();
    window.location.reload();
  });

  const customer = await getCurrentCustomer(true);
  if (customer) {
    applyLoggedInNav(customer);
  } else {
    applyGuestNav();
  }
}

window.requireLoginForAction = requireLoginForAction;
window.buildLoginUrl = buildLoginUrl;

document.addEventListener("DOMContentLoaded", initAuthNav);
