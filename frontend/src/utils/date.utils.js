function parseDateOnly(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
}

function normalizeDate(date) {
  if (!date) return null;
  const d = parseDateOnly(date) || new Date(date);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatHumanDate(date) {
  const d = normalizeDate(date);
  if (!d) return "-";

  const dateStr = d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const today = normalizeDate(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.getTime() === today.getTime()) {
    return `Hoy · ${dateStr}`;
  }
  if (d.getTime() === tomorrow.getTime()) {
    return `Mañana · ${dateStr}`;
  }

  const weekday = d.toLocaleDateString("es-AR", { weekday: "long" });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dateStr}`;
}
