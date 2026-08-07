/**
 * Review display and verified review submission for Gakuran page.
 */

let selectedStars = 0;
let lockedReviewAuthor = "";

async function getReviewAuthorName() {
  const customer = await getCurrentCustomer();
  if (!customer) return "";
  return customer.robloxUsername || customer.displayName || "Customer";
}

async function applyReviewAuthorField() {
  const input = document.getElementById("review-author");
  if (!input) return false;

  const name = await getReviewAuthorName();
  if (!name) {
    input.value = "";
    input.placeholder = "Log in to leave a review";
    return false;
  }

  lockedReviewAuthor = name;
  input.value = name;
  input.readOnly = true;
  input.classList.add("input-locked");
  return true;
}

function renderStars(count) {
  return "★".repeat(count) + "☆".repeat(5 - count);
}

function createReviewCard(review, showVerified = false) {
  const card = document.createElement("div");
  card.className = "review-card" + (review.verified || showVerified ? " verified" : "");
  card.innerHTML = `
    <div class="review-stars">${renderStars(review.stars || 5)}</div>
    <p class="review-text">"${escapeHtml(review.text)}"</p>
    <div class="review-author">${escapeHtml(review.author)}</div>
    <div class="review-source">${escapeHtml(review.source || "Website")}</div>
  `;
  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadFacebookReviews(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const reviews = await getFacebookReviews();
  if (reviews.length === 0) {
    container.innerHTML =
      '<p class="text-center" style="color:var(--dark-soft);grid-column:1/-1;">Reviews will appear here. Check the Facebook post embed below.</p>';
    return;
  }

  reviews.forEach((r) => container.appendChild(createReviewCard(r)));
}

async function loadSiteReviews(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  const siteReviews = await getSiteReviews();

  if (siteReviews.length === 0) {
    container.innerHTML =
      '<p class="text-center" style="color: var(--dark-soft); grid-column: 1/-1;">No verified website reviews yet. Complete a purchase to leave one!</p>';
    return;
  }

  siteReviews.forEach((r) => container.appendChild(createReviewCard(r, true)));
}

function initStarRating() {
  const stars = document.querySelectorAll(".star-rating button");
  stars.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedStars = parseInt(btn.dataset.star, 10);
      stars.forEach((s) => {
        s.classList.toggle("active", parseInt(s.dataset.star, 10) <= selectedStars);
      });
    });
  });
}

function initReviewForm() {
  const unlockForm = document.getElementById("unlock-review-form");
  const reviewForm = document.getElementById("review-form");
  const lockedSection = document.getElementById("review-locked");
  const unlockedSection = document.getElementById("review-unlocked");

  if (!unlockForm) return;

  let activeCode = null;

  document.getElementById("btn-go-to-review")?.addEventListener("click", () => {
    if (typeof closeModal === "function") closeModal("modal-review-required");
    const section = document.getElementById("leave-review");
    section?.classList.remove("hidden");
    document.getElementById("nav-leave-review")?.classList.remove("hidden");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("review-code")?.focus();
  });

  unlockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = document.getElementById("review-code").value.trim().toUpperCase();
    const entry = await validateReviewCode(code);

    if (!entry) {
      alert("Invalid or already used review code. Contact Jhul if you completed your order.");
      return;
    }

    activeCode = code;
    lockedSection.classList.add("hidden");
    unlockedSection.classList.remove("hidden");
    await applyReviewAuthorField();
  });

  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!activeCode) return;

      const author = lockedReviewAuthor || (await getReviewAuthorName());
      const text = document.getElementById("review-text").value.trim();

      if (!author) {
        alert("Please log in to leave a review.");
        return;
      }

      if (!text) {
        alert("Please write your review.");
        return;
      }

      if (selectedStars < 1) {
        alert("Please select a star rating.");
        return;
      }

      const review = {
        author,
        text,
        stars: selectedStars,
        source: "Verified Purchase",
        verified: true,
        createdAt: new Date().toISOString(),
      };

      await addSiteReview(review, activeCode);

      alert("Thank you for your review! It has been saved.");
      reviewForm.reset();
      selectedStars = 0;
      document.querySelectorAll(".star-rating button").forEach((s) => s.classList.remove("active"));
      unlockedSection.classList.add("hidden");
      lockedSection.classList.remove("hidden");
      document.getElementById("review-code").value = "";
      activeCode = null;
      lockedReviewAuthor = "";

      loadSiteReviews("site-reviews-grid");
    });
  }

  initStarRating();
}

async function showReviewRequiredModal(order) {
  if (!order?.reviewCode) return;

  const key = `rbxdisc_review_modal_${order.id}`;
  if (sessionStorage.getItem(key) === "1") return;
  sessionStorage.setItem(key, "1");

  const codeEl = document.getElementById("modal-review-code-display");
  const codeInput = document.getElementById("review-code");
  if (codeEl) codeEl.textContent = order.reviewCode;
  if (codeInput) codeInput.value = order.reviewCode;

  const section = document.getElementById("leave-review");
  const navLink = document.getElementById("nav-leave-review");
  section?.classList.remove("hidden");
  navLink?.classList.remove("hidden");

  try {
    const c = await getCurrentCustomer();
    if (c) sessionStorage.setItem(`rbxdisc_review_unlocked_${c.id}`, "1");
  } catch (_) {}

  if (typeof openModal === "function") {
    openModal("modal-review-required");
  }
}

window.showReviewRequiredModal = showReviewRequiredModal;

document.addEventListener("DOMContentLoaded", () => {
  loadFacebookReviews("fb-reviews-grid");
  loadSiteReviews("site-reviews-grid");
  initReviewForm();
});

document.addEventListener("rbxdisc:auth", () => {
  applyReviewAuthorField();
});
