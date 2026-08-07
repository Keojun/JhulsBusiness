/**
 * Order lifecycle labels — browser copy of lib/order-status.js
 */

const ORDER_STATUS_LABELS = {
  awaiting_payment: "Awaiting Payment",
  pending: "Pending Verification",
  processing: "Processing",
  completed: "Completed",
  reviewed: "Reviewed",
  voided: "Voided",
};

function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status || "Unknown";
}

function orderCountsTowardRevenue(status) {
  return ["processing", "completed", "reviewed"].includes(status);
}

function orderFilterMatchesTab(order, tab) {
  const status = order.status || "pending";
  if (tab === "all") return true;
  if (tab === "voided") return status === "voided";
  if (tab === "completed") return status === "completed" || status === "reviewed";
  return status === tab;
}

function orderStatusBadgeClass(status) {
  const map = {
    awaiting_payment: "status-awaiting_payment",
    pending: "status-pending",
    processing: "status-processing",
    completed: "status-completed",
    reviewed: "status-reviewed",
    voided: "status-voided",
  };
  return map[status] || "status-pending";
}
