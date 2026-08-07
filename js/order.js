/**
 * Order form, pricing, payment QR flow, invoice generation, and modals.
 */

const REROLL_PACK = 50;
const PRICE_PER_PACK = 54;

function calcPrice(rerolls) {
  return (rerolls / REROLL_PACK) * PRICE_PER_PACK;
}

function formatPrice(amount) {
  return "₱" + amount.toFixed(2);
}

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

  function reviewUnlockKey(customerId) {
    return customerId ? `rbxdisc_review_unlocked_${customerId}` : null;
  }

  async function showReviewSection() {
    const customer = await getCurrentCustomer();
    const key = reviewUnlockKey(customer?.id);
    if (key) sessionStorage.setItem(key, "1");

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

  getCurrentCustomer().then((customer) => {
    const key = reviewUnlockKey(customer?.id);
    if (!key || sessionStorage.getItem(key) !== "1") return;

    const reviewSection = document.getElementById("leave-review");
    const navLink = document.getElementById("nav-leave-review");
    if (reviewSection) reviewSection.classList.remove("hidden");
    if (navLink) navLink.classList.remove("hidden");
  });

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
    confirmBtn.addEventListener("click", () => {
      closeModal("modal-instructions");
      document.getElementById("nav-leave-review")?.classList.remove("hidden");
      if (typeof openChatPanel === "function") {
        openChatPanel(pendingOrderForChatRef || null);
      }
    });
  }

  document.getElementById("btn-chat-required-open")?.addEventListener("click", () => {
    closeModal("modal-chat-required");
    if (typeof openChatPanel === "function" && pendingOrderForChatRef) {
      openChatPanel(pendingOrderForChatRef);
    } else if (typeof openChatPanel === "function") {
      openChatPanel(null);
    }
  });

  document.getElementById("btn-chat-required-instructions")?.addEventListener("click", () => {
    closeModal("modal-chat-required");
    openModal("modal-instructions");
  });

  let pendingOrderForChatRef = null;
  window.setOrderChatRef = (order) => {
    pendingOrderForChatRef = order;
  };

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

function initRerollStepper() {
  const minusBtn = document.getElementById("reroll-minus");
  const plusBtn = document.getElementById("reroll-plus");
  const display = document.getElementById("reroll-amount-display");
  const hiddenInput = document.getElementById("reroll-amount");
  const priceDisplay = document.getElementById("price-display");

  if (!minusBtn || !plusBtn) return;

  let rerolls = 50;

  function updateDisplay() {
    display.textContent = rerolls;
    hiddenInput.value = rerolls;
    priceDisplay.textContent = formatPrice(calcPrice(rerolls));
    minusBtn.disabled = rerolls <= REROLL_PACK;
  }

  minusBtn.addEventListener("click", () => {
    if (rerolls > REROLL_PACK) {
      rerolls -= REROLL_PACK;
      updateDisplay();
    }
  });

  plusBtn.addEventListener("click", () => {
    rerolls += REROLL_PACK;
    updateDisplay();
  });

  updateDisplay();
}

function initPaymentModal(onPaymentDone) {
  const tabGcash = document.getElementById("tab-gcash");
  const tabPaymaya = document.getElementById("tab-paymaya");
  const qrGcash = document.getElementById("payment-qr-gcash");
  const qrPaymaya = document.getElementById("payment-qr-paymaya");
  const btnDone = document.getElementById("btn-payment-done");

  let selectedMethod = "gcash";

  function selectMethod(method) {
    selectedMethod = method;
    tabGcash.classList.toggle("active", method === "gcash");
    tabPaymaya.classList.toggle("active", method === "paymaya");
    qrGcash.classList.toggle("hidden", method !== "gcash");
    qrPaymaya.classList.toggle("hidden", method !== "paymaya");
  }

  tabGcash.addEventListener("click", () => selectMethod("gcash"));
  tabPaymaya.addEventListener("click", () => selectMethod("paymaya"));

  btnDone.addEventListener("click", () => {
    onPaymentDone(selectedMethod);
  });

  return {
    show(order) {
      document.getElementById("payment-amount-display").textContent = formatPrice(order.pricePHP);
      document.getElementById("payment-reroll-detail").textContent =
        order.rerollAmount + " rerolls";
      selectMethod("gcash");
      openModal("modal-payment");
    },
  };
}

function drawInvoice(order) {
  const canvas = document.getElementById("invoice-canvas");
  if (!canvas) return null;

  const W = 600;
  const H = 800;
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
    ["Reroll Amount", order.rerollAmount + " rerolls"],
    ["Total Price", formatPrice(order.pricePHP)],
    ["Payment", order.paymentMethod === "paymaya" ? "Maya (PayMaya)" : "GCash"],
    ["Date", order.date],
    ["Status", orderStatusLabel(order.status) || "Awaiting Payment"],
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

  const previewImg = document.getElementById("invoice-preview-img");
  if (previewImg) {
    previewImg.src = canvas.toDataURL("image/png");
  }

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

function isMobileDevice() {
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 900)
  );
}

function updateDownloadInvoiceButton() {
  const btn = document.getElementById("download-invoice");
  if (!btn) return;
  btn.textContent = isMobileDevice() ? "📤 Save or Share Invoice" : "⬇ Download Invoice";
}

function setInvoiceDownloadStatus(message, type = "info") {
  const el = document.getElementById("invoice-download-status");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.className = `invoice-download-status invoice-download-status-${type}`;
  el.textContent = message;
  el.classList.remove("hidden");
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    if (!canvas || !canvas.toBlob) {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), "image/png", 1);
  });
}

async function downloadInvoice(order) {
  const canvas = drawInvoice(order);
  if (!canvas) return { ok: false, method: "none" };

  const filename = `rbxdisc-order-${order.id}.png`;
  const blob = await canvasToBlob(canvas);

  if (blob && navigator.share) {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "RBXDISC Order Invoice",
          text: `Order ${order.id} — send this to Jhul on Messenger`,
        });
        return { ok: true, method: "share" };
      } catch (err) {
        if (err && err.name === "AbortError") {
          return { ok: false, method: "cancelled" };
        }
      }
    }
  }

  if (blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);

    if (isMobileDevice()) {
      return { ok: true, method: "mobile-fallback" };
    }
    return { ok: true, method: "download" };
  }

  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { ok: true, method: isMobileDevice() ? "mobile-fallback" : "download" };
}

function initOrderForm() {
  const form = document.getElementById("order-form");
  const downloadBtn = document.getElementById("download-invoice");
  const orderImgBtn = document.getElementById("order-img-btn");

  if (!form) return;

  let currentOrder = null;
  let pendingOrder = null;

  const paymentModal = initPaymentModal(async (paymentMethod) => {
    if (!pendingOrder) return;

    try {
      pendingOrder.paymentMethod = paymentMethod;
      currentOrder = await confirmPaymentApi(pendingOrder.id, paymentMethod);
      drawInvoice(currentOrder);

      const statusEl = document.getElementById("order-save-status");
      if (statusEl) {
        statusEl.className = "notice notice-info";
        statusEl.innerHTML =
          '<span class="notice-icon">✅</span><div><strong>Payment recorded!</strong> Jhul will verify your payment. Use the chat button to message him about your order.</div>';
        statusEl.classList.remove("hidden");
      }

      closeModal("modal-payment");
      setInvoiceDownloadStatus("");
      openModal("modal-invoice");

      if (typeof setPendingOrderForChat === "function") {
        setPendingOrderForChat(currentOrder);
      }
    } catch (err) {
      alert(err.message || "Could not confirm payment. Please try again.");
    } finally {
      pendingOrder = null;
    }
  });

  async function submitOrder(e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const rerollAmount = Number(document.getElementById("reroll-amount").value);

    if (!username) {
      alert("Please enter your username.");
      return;
    }

    if (!rerollAmount || rerollAmount % REROLL_PACK !== 0) {
      alert("Reroll amount must be in packs of 50.");
      return;
    }

    const orderDraft = {
      id: generateOrderId(),
      username,
      rerollAmount,
      pricePHP: calcPrice(rerollAmount),
      paymentMethod: null,
      date: formatPhilippinesDateTime(new Date()),
      status: "awaiting_payment",
      createdAt: new Date().toISOString(),
    };

    try {
      const saved = await addOrder(orderDraft);
      if (!saved.savedToDb) {
        alert(saved.dbError || "Could not save order online. Check your connection and log in.");
        return;
      }
      pendingOrder = saved;
      paymentModal.show(pendingOrder);
    } catch (err) {
      if (err.status === 409) {
        const resume = window.confirm(
          `${err.message}\n\nOpen your existing order instead?`
        );
        if (resume && err.existingOrderId) {
          const orders = await getCustomerOrders();
          const existing = orders.find((o) => o.id === err.existingOrderId);
          if (existing) {
            pendingOrder = existing;
            if (existing.status === "awaiting_payment") {
              paymentModal.show(existing);
            } else {
              currentOrder = existing;
              drawInvoice(existing);
              openModal("modal-invoice");
              if (typeof setPendingOrderForChat === "function") {
                setPendingOrderForChat(existing);
              }
            }
          }
        }
        return;
      }
      alert(err.message || "Could not create order. Please try again.");
    }
  }

  form.addEventListener("submit", submitOrder);

  if (orderImgBtn) {
    orderImgBtn.addEventListener("click", () => {
      form.requestSubmit();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", async () => {
      if (!currentOrder) return;

      setInvoiceDownloadStatus("Preparing invoice…", "info");
      downloadBtn.disabled = true;

      try {
        const result = await downloadInvoice(currentOrder);

        if (result.method === "cancelled") {
          setInvoiceDownloadStatus("Share cancelled — long-press the image above to save it.", "warn");
          return;
        }

        if (result.method === "mobile-fallback") {
          setInvoiceDownloadStatus(
            "If nothing saved, long-press the invoice image above → Save to Photos or Download image.",
            "warn"
          );
          return;
        }

        setInvoiceDownloadStatus("");
        closeModal("modal-invoice");
        openModal("modal-chat-required");
      } finally {
        downloadBtn.disabled = false;
      }
    });
  }

  updateDownloadInvoiceButton();
  window.addEventListener("resize", updateDownloadInvoiceButton);
}

document.addEventListener("DOMContentLoaded", () => {
  initModals();
  initRerollStepper();
  initOrderForm();
  initOrderStatusWatcher();
});

function initOrderStatusWatcher() {
  let pollTimer = null;

  async function checkOrders() {
    const customer = await getCurrentCustomer();
    if (!customer) return;

    let orders;
    try {
      orders = await getCustomerOrders();
    } catch (_) {
      return;
    }

    const processing = orders.find((o) => o.status === "processing");
    if (processing && typeof showProcessingPrompt === "function") {
      showProcessingPrompt(processing);
    }

    const completed = orders.find(
      (o) => o.status === "completed" && o.reviewCode
    );
    if (completed && typeof showReviewRequiredModal === "function") {
      showReviewRequiredModal(completed);
    }
  }

  document.addEventListener("rbxdisc:auth", (e) => {
    if (e.detail.customer) {
      checkOrders();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(checkOrders, 45000);
    } else if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  getCurrentCustomer().then((c) => {
    if (c) {
      checkOrders();
      pollTimer = setInterval(checkOrders, 45000);
    }
  });
}
