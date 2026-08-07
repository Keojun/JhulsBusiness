/**
 * Mobile header navigation — hamburger menu + drawer
 */

function initMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  const backdrop = document.getElementById("nav-backdrop");
  const drawerClose = document.getElementById("nav-drawer-close");
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    toggle.classList.toggle("is-active", open);
    backdrop?.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
  }

  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  drawerClose?.addEventListener("click", () => setOpen(false));
  backdrop?.addEventListener("click", () => setOpen(false));

  nav.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("click", () => {
      if (window.innerWidth <= 900) setOpen(false);
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) setOpen(false);
  });
}

document.addEventListener("DOMContentLoaded", initMobileNav);
