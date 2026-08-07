/**
 * Login / signup page (public entry point).
 */

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect") || "/gakuran";
  if (!redirect.startsWith("/") || redirect.startsWith("//") || redirect.startsWith("/login")) {
    return "/gakuran";
  }
  return redirect;
}

function showError(id, message) {
  ["login-error", "signup-error"].forEach((elId) => {
    const el = document.getElementById(elId);
    if (el) {
      el.classList.add("hidden");
      el.textContent = "";
    }
  });
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.classList.remove("hidden");
  }
}

function switchTab(tab) {
  document.querySelectorAll(".login-page-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.getElementById("login-form").classList.toggle("hidden", tab !== "login");
  document.getElementById("signup-form").classList.toggle("hidden", tab !== "signup");
}

document.addEventListener("DOMContentLoaded", async () => {
  const existing = await getCurrentCustomer();
  if (existing) {
    window.location.replace(getRedirectTarget());
    return;
  }

  document.querySelectorAll(".login-page-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await customerLogin({
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value,
      });
      window.location.replace(getRedirectTarget());
    } catch (err) {
      showError("login-error", err.message);
    }
  });

  document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await customerSignup({
        email: document.getElementById("signup-email").value.trim(),
        password: document.getElementById("signup-password").value,
        robloxUsername: document.getElementById("signup-roblox").value.trim(),
      });
      window.location.replace(getRedirectTarget());
    } catch (err) {
      showError("signup-error", err.message);
    }
  });
});
