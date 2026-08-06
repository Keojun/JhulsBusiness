/**
 * Review display and verified review submission for Gakuran page.
 */

let selectedStars = 0;

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
  });

  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!activeCode) return;

      const author = document.getElementById("review-author").value.trim();
      const text = document.getElementById("review-text").value.trim();

      if (!author || !text) {
        alert("Please fill in your name and review.");
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

      loadSiteReviews("site-reviews-grid");
    });
  }

  initStarRating();
}

document.addEventListener("DOMContentLoaded", () => {
  loadSiteReviews("site-reviews-grid");
  initReviewForm();
});
