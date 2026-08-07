/**
 * Customer login / signup UI
 */

let onAuthChangeCallback = null;

function onAuthChange(cb) {
  onAuthChangeCallback = cb;
}

function notifyAuthChange(customer) {
  if (onAuthChangeCallback) onAuthChangeCallback(customer);
  document.dispatchEvent(new CustomEvent("rbxdisc:auth", { detail: { customer } }));
}

function updateAuthNav(customer) {
  const guestNav = document.getElementById("auth-nav-guest");
  const userNav = document.getElementById("auth-nav-user");
  const userLabel = document.getElementById("auth-user-label");
  const chatBtn = document.getElementById("btn-open-chat");

  if (!guestNav || !userNav) return;

  if (customer) {
    guestNav.classList.add("hidden");
    userNav.classList.remove("hidden");
    if (userLabel) userLabel.textContent = customer.robloxUsername || customer.displayName;
    if (chatBtn) chatBtn.classList.remove("hidden");
  } else {
    guestNav.classList.remove("hidden");
    userNav.classList.add("hidden");
    if (chatBtn) chatBtn.classList.add("hidden");
  }
}

function openAuthModal(mode) {
  const loginModal = document.getElementById("modal-login");
  const signupModal = document.getElementById("modal-signup");
  if (mode === "signup") {
    closeAuthModal("login");
    loginModal?.classList.add("hidden");
    signupModal?.classList.remove("hidden");
  } else {
    closeAuthModal("signup");
    signupModal?.classList.add("hidden");
    loginModal?.classList.remove("hidden");
  }
  document.body.style.overflow = "hidden";
}

function closeAuthModal(which) {
  const id = which === "signup" ? "modal-signup" : "modal-login";
  document.getElementById(id)?.classList.add("hidden");
  if (
    document.getElementById("modal-login")?.classList.contains("hidden") &&
    document.getElementById("modal-signup")?.classList.contains("hidden")
  ) {
    document.body.style.overflow = "";
  }
}

function showAuthError(elId, message) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}

function clearAuthErrors() {
  ["login-error", "signup-error"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "";
      el.classList.add("hidden");
    }
  });
}

async function initAuth() {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const btnLoginOpen = document.getElementById("btn-login-open");
  const btnSignupOpen = document.getElementById("btn-signup-open");
  const btnLogout = document.getElementById("btn-logout-customer");
  const switchToSignup = document.getElementById("switch-to-signup");
  const switchToLogin = document.getElementById("switch-to-login");

  btnLoginOpen?.addEventListener("click", () => {
    clearAuthErrors();
    openAuthModal("login");
  });
  btnSignupOpen?.addEventListener("click", () => {
    clearAuthErrors();
    openAuthModal("signup");
  });

  document.getElementById("link-signup-inline")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearAuthErrors();
    openAuthModal("signup");
  });

  switchToSignup?.addEventListener("click", (e) => {
    e.preventDefault();
    clearAuthErrors();
    openAuthModal("signup");
  });
  switchToLogin?.addEventListener("click", (e) => {
    e.preventDefault();
    clearAuthErrors();
    openAuthModal("login");
  });

  document.querySelectorAll("[data-close-auth]").forEach((btn) => {
    btn.addEventListener("click", () => closeAuthModal(btn.dataset.closeAuth));
  });

  btnLogout?.addEventListener("click", async () => {
    await customerLogout();
    updateAuthNav(null);
    notifyAuthChange(null);
  });

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthErrors();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    try {
      const customer = await customerLogin({ email, password });
      closeAuthModal("login");
      closeAuthModal("signup");
      updateAuthNav(customer);
      notifyAuthChange(customer);
      prefillUsername(customer);
    } catch (err) {
      showAuthError("login-error", err.message);
    }
  });

  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthErrors();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const robloxUsername = document.getElementById("signup-roblox").value.trim();
    try {
      const customer = await customerSignup({ email, password, robloxUsername });
      closeAuthModal("login");
      closeAuthModal("signup");
      updateAuthNav(customer);
      notifyAuthChange(customer);
      prefillUsername(customer);
    } catch (err) {
      showAuthError("signup-error", err.message);
    }
  });

  const customer = await getCurrentCustomer();
  updateAuthNav(customer);
  if (customer) prefillUsername(customer);
  notifyAuthChange(customer);
}

function prefillUsername(customer) {
  const usernameInput = document.getElementById("username");
  if (usernameInput && customer?.robloxUsername && !usernameInput.value.trim()) {
    usernameInput.value = customer.robloxUsername;
  }
}

document.addEventListener("DOMContentLoaded", initAuth);

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.updateAuthNav = updateAuthNav;
