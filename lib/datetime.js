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

module.exports = {
  PH_TIMEZONE,
  formatPhilippinesDateTime,
  formatPhilippinesTime,
};
