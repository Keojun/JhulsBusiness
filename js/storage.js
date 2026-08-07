/**
 * Data layer — uses Supabase via Vercel API when available, falls back to localStorage.
 */

const STORAGE_KEYS = {
  orders: "jhul_orders",
  reviews: "jhul_site_reviews",
  reviewCodes: "jhul_review_codes",
};

let customerCache = null;

const FETCH_CREDENTIALS = { credentials: "include" };

const PH_TIMEZONE = "Asia/Manila";

function formatPhilippinesDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    timeZone: PH_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPhilippinesTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    timeZone: PH_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

let adminPassword = "";

function setAdminPassword(pw) {
  adminPassword = pw || "";
}

function adminHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  if (adminPassword) headers["X-Admin-Password"] = adminPassword;
  return headers;
}

function adminFetch(url, options = {}) {
  return fetch(url, {
    ...FETCH_CREDENTIALS,
    ...options,
    headers: adminHeaders(options.headers),
  });
}

function customerHeaders(extra = {}) {
  return { "Content-Type": "application/json", ...extra };
}

function customerFetch(url, options = {}) {
  return fetch(url, {
    ...FETCH_CREDENTIALS,
    ...options,
    headers: customerHeaders(options.headers),
  });
}

/* ── localStorage fallbacks ── */

function getOrdersLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) || "[]");
  } catch {
    return [];
  }
}

function saveOrdersLocal(orders) {
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
}

function getReviewCodesLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.reviewCodes) || "[]");
  } catch {
    return [];
  }
}

function saveReviewCodesLocal(codes) {
  localStorage.setItem(STORAGE_KEYS.reviewCodes, JSON.stringify(codes));
}

function getSiteReviewsLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.reviews) || "[]");
  } catch {
    return [];
  }
}

function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JHUL-${ts}-${rand}`;
}

function generateReviewCodeLocal() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "JHUL-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/* ── API + fallback ── */

async function addOrder(order) {
  try {
    const res = await customerFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
    const data = await res.json();
    if (res.ok) return { ...data, savedToDb: true };
    return { ...order, savedToDb: false, dbError: data.error || `HTTP ${res.status}` };
  } catch (err) {
    return { ...order, savedToDb: false, dbError: err.message || "Network error" };
  }
}

async function getOrders() {
  try {
    const res = await adminFetch("/api/orders");
    if (res.ok) return await res.json();
    if (res.status === 401) throw new Error("Unauthorized — admin session expired");
  } catch (err) {
    if (err.message.includes("Unauthorized")) throw err;
  }
  return getOrdersLocal();
}

async function getCustomerOrders() {
  try {
    const res = await customerFetch("/api/orders");
    if (res.ok) return await res.json();
  } catch (_) {}
  return [];
}

async function verifyAdminPassword(password) {
  try {
    const res = await fetch("/api/auth?action=admin-login", {
      method: "POST",
      ...FETCH_CREDENTIALS,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    return res.ok && data.ok;
  } catch {
    return password === "jhul2026";
  }
}

async function checkAdminSession() {
  try {
    const res = await fetch("/api/auth?action=admin-me", FETCH_CREDENTIALS);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

async function adminLogout() {
  try {
    await fetch("/api/auth?action=admin-logout", {
      method: "POST",
      ...FETCH_CREDENTIALS,
    });
  } catch (_) {}
  setAdminPassword("");
}

async function completeOrderApi(orderId) {
  try {
    const res = await adminFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ action: "complete", orderId }),
    });
    const data = await res.json();
    if (res.ok) return data.code;
    throw new Error(data.error || "Failed to complete order");
  } catch (err) {
    if (err.message && !err.message.includes("Failed")) throw err;
  }

  const code = generateReviewCodeLocal();
  const codes = getReviewCodesLocal();
  codes.push({ code, orderId, used: false, createdAt: new Date().toISOString() });
  saveReviewCodesLocal(codes);

  const orders = getOrdersLocal();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx !== -1) {
    orders[idx].reviewCode = code;
    orders[idx].status = "completed";
    saveOrdersLocal(orders);
  }
  return code;
}

async function validateReviewCode(code) {
  try {
    const res = await customerFetch("/api/reviews?action=validate", {
      method: "POST",
      body: JSON.stringify({ action: "validate", code }),
    });
    if (res.ok) {
      const data = await res.json();
      return { code: data.code, orderId: data.orderId };
    }
    if (res.status === 404 || res.status === 403) return null;
  } catch (_) {}

  const codes = getReviewCodesLocal();
  const entry = codes.find((c) => c.code === code.toUpperCase() && !c.used);
  return entry || null;
}

async function addSiteReview(review, code) {
  try {
    const res = await customerFetch("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ ...review, code }),
    });
    if (res.ok) return await res.json();
  } catch (_) {}

  const reviews = getSiteReviewsLocal();
  reviews.unshift(review);
  localStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(reviews));

  const codes = getReviewCodesLocal();
  const idx = codes.findIndex((c) => c.code === code.toUpperCase());
  if (idx !== -1) {
    codes[idx].used = true;
    saveReviewCodesLocal(codes);
  }
  return review;
}

async function getSiteReviews() {
  try {
    const res = await customerFetch("/api/reviews?type=site");
    if (res.ok) return await res.json();
  } catch (_) {}
  return getSiteReviewsLocal();
}

async function getFacebookReviews() {
  try {
    const res = await customerFetch("/api/reviews?type=facebook");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (_) {}

  try {
    const res = await fetch("/data/facebook-reviews.json");
    if (res.ok) return await res.json();
  } catch (_) {}

  return [];
}

async function customerLogout() {
  const previousCustomerId = customerCache?.id;
  try {
    await customerFetch("/api/auth?action=logout", { method: "POST" });
  } catch (_) {}
  customerCache = null;
  clearReviewUnlockForCustomer(previousCustomerId);
  sessionStorage.removeItem("rbxdisc_review_unlocked");
  document.dispatchEvent(new CustomEvent("rbxdisc:logout"));
}

function clearReviewUnlockForCustomer(customerId) {
  if (!customerId) return;
  sessionStorage.removeItem(`rbxdisc_review_unlocked_${customerId}`);
}

async function customerLogin({ email, password }) {
  const res = await customerFetch("/api/auth?action=login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  sessionStorage.removeItem("rbxdisc_review_unlocked");
  customerCache = data.customer;
  return data.customer;
}

async function customerSignup({ email, password, robloxUsername, displayName }) {
  const res = await customerFetch("/api/auth?action=signup", {
    method: "POST",
    body: JSON.stringify({ email, password, robloxUsername, displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed");
  sessionStorage.removeItem("rbxdisc_review_unlocked");
  customerCache = data.customer;
  return data.customer;
}

async function getCurrentCustomer(forceRefresh = false) {
  if (customerCache && !forceRefresh) return customerCache;

  try {
    const res = await customerFetch("/api/auth?action=me");
    if (!res.ok) {
      customerCache = null;
      return null;
    }
    const data = await res.json();
    customerCache = data.customer;
    return data.customer;
  } catch (_) {
    customerCache = null;
    return null;
  }
}

async function getConversations(asAdmin = false) {
  if (asAdmin) {
    const res = await adminFetch("/api/chat?resource=conversations");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load conversations");
    return data;
  }

  const res = await customerFetch("/api/chat?resource=conversations");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load conversations");
  return data;
}

async function createConversation(subject, orderId = null) {
  const res = await customerFetch("/api/chat?resource=conversations", {
    method: "POST",
    body: JSON.stringify({ subject, orderId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create conversation");
  return data;
}

async function getMessages(conversationId, asAdmin = false, since = null) {
  let url = `/api/chat?resource=messages&conversationId=${encodeURIComponent(conversationId)}`;
  if (since) url += `&since=${encodeURIComponent(since)}`;

  const res = asAdmin ? await adminFetch(url) : await customerFetch(url);

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load messages");
  return data;
}

async function sendChatMessage(conversationId, body, asAdmin = false) {
  const url = `/api/chat?resource=messages&conversationId=${encodeURIComponent(conversationId)}`;
  const res = asAdmin
    ? await adminFetch(url, {
        method: "POST",
        body: JSON.stringify({ body }),
      })
    : await customerFetch(url, {
        method: "POST",
        body: JSON.stringify({ body }),
      });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send message");
  return data;
}

async function checkDatabaseHealth() {
  try {
    const res = await fetch("/api/health?format=json");
    const report = await res.json();
    const db = report.checks?.database;

    if (db?.connected) {
      return {
        database: "connected",
        status: report.status,
        message: db.message || null,
      };
    }

    return {
      database: db?.status || report.status || "unknown",
      status: report.status,
      message: db?.message || report.error || null,
    };
  } catch (_) {}
  return { database: "unknown" };
}
