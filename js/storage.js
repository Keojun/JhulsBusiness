/**
 * Data layer — uses Supabase via Vercel API when available, falls back to localStorage.
 */

const STORAGE_KEYS = {
  orders: "jhul_orders",
  reviews: "jhul_site_reviews",
  reviewCodes: "jhul_review_codes",
};

const CUSTOMER_TOKEN_KEY = "rbxdisc_customer_token";
let customerCache = null;

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

let adminPassword = sessionStorage.getItem("jhul_admin_pw") || "";

function setAdminPassword(pw) {
  adminPassword = pw;
  sessionStorage.setItem("jhul_admin_pw", pw);
}

function adminHeaders() {
  return { "Content-Type": "application/json", "X-Admin-Password": adminPassword };
}

function getCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
}

function setCustomerToken(token) {
  if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  else localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  customerCache = null;
}

function customerHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  const token = getCustomerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: customerHeaders(),
      body: JSON.stringify(order),
    });
    const data = await res.json();
    if (res.ok) return { ...data, savedToDb: true };
    return { ...order, savedToDb: false, dbError: data.error || `HTTP ${res.status}` };
  } catch (err) {
    const orders = getOrdersLocal();
    orders.push(order);
    saveOrdersLocal(orders);
    return { ...order, savedToDb: false, dbError: err.message || "Network error" };
  }
}

async function getOrders() {
  try {
    const res = await fetch("/api/orders", { headers: adminHeaders() });
    if (res.ok) return await res.json();
    if (res.status === 401) throw new Error("Unauthorized — wrong admin password");
  } catch (err) {
    if (err.message.includes("Unauthorized")) throw err;
  }
  return getOrdersLocal();
}

async function verifyAdminPassword(password) {
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    return res.ok && data.ok;
  } catch {
    return password === "jhul2026";
  }
}

async function completeOrderApi(orderId) {
  try {
    const res = await fetch("/api/orders/complete", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ orderId }),
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
    const res = await fetch("/api/review-codes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      const data = await res.json();
      return { code: data.code, orderId: data.orderId };
    }
    if (res.status === 404) return null;
  } catch (_) {}

  const codes = getReviewCodesLocal();
  const entry = codes.find((c) => c.code === code.toUpperCase() && !c.used);
  return entry || null;
}

async function addSiteReview(review, code) {
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const res = await fetch("/api/reviews?type=site");
    if (res.ok) return await res.json();
  } catch (_) {}
  return getSiteReviewsLocal();
}

async function getFacebookReviews() {
  try {
    const res = await fetch("/api/reviews?type=facebook");
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

async function customerSignup({ email, password, robloxUsername, displayName }) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, robloxUsername, displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed");
  setCustomerToken(data.token);
  customerCache = data.customer;
  return data.customer;
}

async function customerLogin({ email, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  setCustomerToken(data.token);
  customerCache = data.customer;
  return data.customer;
}

async function customerLogout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: customerHeaders(),
    });
  } catch (_) {}
  setCustomerToken("");
}

async function getCurrentCustomer(forceRefresh = false) {
  if (!getCustomerToken()) return null;
  if (customerCache && !forceRefresh) return customerCache;

  try {
    const res = await fetch("/api/auth/me", { headers: customerHeaders() });
    if (!res.ok) {
      setCustomerToken("");
      return null;
    }
    const data = await res.json();
    customerCache = data.customer;
    return data.customer;
  } catch (_) {
    return null;
  }
}

async function getConversations(asAdmin = false) {
  const headers = asAdmin ? adminHeaders() : customerHeaders();
  const res = await fetch("/api/conversations", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load conversations");
  return data;
}

async function createConversation(subject, orderId = null) {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: customerHeaders(),
    body: JSON.stringify({ subject, orderId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create conversation");
  return data;
}

async function getMessages(conversationId, asAdmin = false) {
  const headers = asAdmin ? adminHeaders() : customerHeaders();
  const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`, {
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load messages");
  return data;
}

async function sendChatMessage(conversationId, body, asAdmin = false) {
  const headers = asAdmin ? adminHeaders() : customerHeaders();
  const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send message");
  return data;
}

async function checkDatabaseHealth() {
  try {
    const res = await fetch("/api/health");
    if (res.ok) return await res.json();
  } catch (_) {}
  return { database: "unknown" };
}
