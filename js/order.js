/**
 * Order form, invoice generation, and modal flow.
 */

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

window.openModal = openModal;
window.closeModal = closeModal;

function initModals() {
  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(btn.dataset.close);
    });
  });

  document.querySelectorAll(".modal-overlay:not(.modal-no-close)").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  const continueBtn = document.getElementById("btn-understand");
  const goBackBtn = document.getElementById("btn-go-back");
  const confirmBtn = document.getElementById("btn-confirm-sure");
  const step1 = document.getElementById("instructions-step-1");
  const step2 = document.getElementById("instructions-step-2");

  function showReviewSection() {
    sessionStorage.setItem("rbxdisc_review_unlocked", "1");
    const reviewSection = document.getElementById("leave-review");
    const navLink = document.getElementById("nav-leave-review");
    if (reviewSection) {
      reviewSection.classList.remove("hidden");
      closeModal("modal-instructions");
      setTimeout(() => {
        reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
        reviewSection.classList.add("highlight-section");
        setTimeout(() => reviewSection.classList.remove("highlight-section"), 2000);
      }, 300);
    }
    if (navLink) navLink.classList.remove("hidden");
  }

  if (sessionStorage.getItem("rbxdisc_review_unlocked") === "1") {
    const reviewSection = document.getElementById("leave-review");
    const navLink = document.getElementById("nav-leave-review");
    if (reviewSection) reviewSection.classList.remove("hidden");
    if (navLink) navLink.classList.remove("hidden");
  }

  if (continueBtn && step1 && step2) {
    continueBtn.addEventListener("click", () => {
      step1.classList.add("hidden");
      step2.classList.remove("hidden");
    });
  }

  if (goBackBtn && step1 && step2) {
    goBackBtn.addEventListener("click", () => {
      step2.classList.add("hidden");
      step1.classList.remove("hidden");
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener("click", showReviewSection);
  }

  /* Reset instruction steps when instructions modal opens */
  const instructionsModal = document.getElementById("modal-instructions");
  if (instructionsModal) {
    const observer = new MutationObserver(() => {
      if (!instructionsModal.classList.contains("hidden") && step1 && step2) {
        step1.classList.remove("hidden");
        step2.classList.add("hidden");
      }
    });
    observer.observe(instructionsModal, { attributes: true, attributeFilter: ["class"] });
  }
}

function drawInvoice(order) {
  const canvas = document.getElementById("invoice-canvas");
  if (!canvas) return null;

  const W = 600;
  const H = 720;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#fffaf5");
  bg.addColorStop(0.5, "#e8f5e9");
  bg.addColorStop(1, "#ffe8d6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#6bc48a";
  ctx.fillRect(0, 0, W, 80);
  ctx.fillStyle = "#ff9a5c";
  ctx.fillRect(0, 76, W, 4);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RBXDISC ORDER", W / 2, 38);
  ctx.font = "14px Segoe UI, sans-serif";
  ctx.fillText("by Jhul Cammayo — Gakuran Rerolls", W / 2, 62);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  roundRect(ctx, 30, 100, W - 60, 50, 10);
  ctx.fill();
  ctx.fillStyle = "#2d3436";
  ctx.font = "bold 13px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ORDER ID", 50, 122);
  ctx.font = "bold 18px Segoe UI, sans-serif";
  ctx.fillStyle = "#ff9a5c";
  ctx.fillText(order.id, 50, 145);

  const details = [
    ["Username", order.username],
    ["Reroll Amount", order.rerollAmount],
    ["Date", order.date],
    ["Status", "Pending Verification"],
  ];

  let y = 175;
  details.forEach(([label, value]) => {
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 30, y, W - 60, 52, 10);
    ctx.fill();
    ctx.strokeStyle = "#b8e6c1";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 30, y, W - 60, 52, 10);
    ctx.stroke();

    ctx.fillStyle = "#4a5568";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label.toUpperCase(), 50, y + 20);
    ctx.fillStyle = "#2d3436";
    ctx.font = "bold 16px Segoe UI, sans-serif";
    ctx.fillText(String(value), 50, y + 42);
    y += 62;
  });

  y += 10;
  ctx.fillStyle = "#fff3e0";
  roundRect(ctx, 30, y, W - 60, 70, 10);
  ctx.fill();
  ctx.strokeStyle = "#ff9a5c";
  ctx.lineWidth = 2;
  roundRect(ctx, 30, y, W - 60, 70, 10);
  ctx.stroke();

  ctx.fillStyle = "#7c4a1e";
  ctx.font = "bold 12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("⚠ DO NOT SEND RECEIPTS UNEXPECTEDLY", W / 2, y + 22);
  ctx.font = "11px Segoe UI, sans-serif";
  ctx.fillText("Owner must verify your order & payment first.", W / 2, y + 40);
  ctx.fillText("No refunds — ensure details are final & accurate.", W / 2, y + 56);

  ctx.fillStyle = "#6bc48a";
  ctx.fillRect(0, H - 60, W, 60);
  ctx.fillStyle = "#ffffff";
  ctx.font = "13px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Message Jhul on Facebook Messenger with this image", W / 2, H - 35);
  ctx.font = "11px Segoe UI, sans-serif";
  ctx.fillText("facebook.com/jhulcammayo", W / 2, H - 16);

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function downloadInvoice(order) {
  const canvas = drawInvoice(order);
  if (!canvas) return;

  const link = document.createElement("a");
  link.download = `rbxdisc-order-${order.id}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function initOrderForm() {
  const form = document.getElementById("order-form");
  const downloadBtn = document.getElementById("download-invoice");
  const orderImgBtn = document.getElementById("order-img-btn");

  if (!form) return;

  let currentOrder = null;

  async function submitOrder(e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const rerollAmount = document.getElementById("reroll-amount").value.trim();

    if (!username || !rerollAmount) {
      alert("Please fill in all fields.");
      return;
    }

    if (isNaN(Number(rerollAmount)) || Number(rerollAmount) < 1) {
      alert("Reroll amount must be a valid number (at least 1).");
      return;
    }

    const orderData = {
      id: generateOrderId(),
      username,
      rerollAmount: Number(rerollAmount),
      date: new Date().toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    currentOrder = await addOrder(orderData);
    drawInvoice(currentOrder);

    const statusEl = document.getElementById("order-save-status");
    if (statusEl) {
      if (currentOrder.savedToDb) {
        statusEl.className = "notice notice-info";
        statusEl.innerHTML = '<span class="notice-icon">✅</span><div><strong>Order saved!</strong> Jhul can see it in admin.</div>';
      } else {
        statusEl.className = "notice notice-warning";
        statusEl.innerHTML = `<span class="notice-icon">⚠️</span><div><strong>Order saved locally.</strong> ${currentOrder.dbError || ""} Still send invoice to Jhul on Facebook.</div>`;
      }
      statusEl.classList.remove("hidden");
    }

    openModal("modal-invoice");
  }

  form.addEventListener("submit", submitOrder);

  if (orderImgBtn) {
    orderImgBtn.addEventListener("click", () => {
      form.requestSubmit();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (!currentOrder) return;

      downloadInvoice(currentOrder);
      closeModal("modal-invoice");
      openModal("modal-instructions");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initModals();
  initOrderForm();
});
