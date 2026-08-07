/**
 * Order lifecycle statuses (shared server + client).
 *
 * awaiting_payment → customer placed order, has not confirmed payment yet
 * pending          → customer says they paid; Jhul must verify
 * processing       → payment verified; Jhul is completing the order
 * completed        → done; review code generated
 * reviewed         → customer submitted a verified review
 * voided           → cancelled / no payment
 */

const ORDER_STATUSES = {
  AWAITING_PAYMENT: "awaiting_payment",
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  REVIEWED: "reviewed",
  VOIDED: "voided",
};

const STATUS_LABELS = {
  awaiting_payment: "Awaiting Payment",
  pending: "Pending Verification",
  processing: "Processing",
  completed: "Completed",
  reviewed: "Reviewed",
  voided: "Voided",
};

const REVENUE_STATUSES = new Set(["processing", "completed", "reviewed"]);

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "Unknown";
}

function countsTowardRevenue(status) {
  return REVENUE_STATUSES.has(status);
}

function isActiveOrderStatus(status) {
  return ["awaiting_payment", "pending", "processing"].includes(status);
}

module.exports = {
  ORDER_STATUSES,
  STATUS_LABELS,
  statusLabel,
  countsTowardRevenue,
  isActiveOrderStatus,
};
