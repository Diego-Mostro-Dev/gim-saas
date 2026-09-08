import { CalendarOff } from "lucide-react";
import { formatHumanDate } from "../../utils/date.utils";
import { txt } from "../../utils/labels";

function parseDate(d) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function todayMidnight() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function plainDate(d) {
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function groupConsecutive(dates) {
  const sorted = dates.map(parseDate).filter(Boolean).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const groups = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    if (sorted[i].getTime() - prev.getTime() === 86400000) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);
  return groups;
}

function toEntries(closedDates) {
  return (closedDates || []).map((item) => {
    if (typeof item === "string") {
      return { date: item, reason: "" };
    }
    return { date: item?.date || "", reason: item?.reason || "" };
  });
}

export default function ClosedDatesNotice({ gym, closedDates = [], excludeToday = false }) {
  const today = todayMidnight();
  const todayStr = formatDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const entries = toEntries(closedDates)
    .filter((e) => (excludeToday ? e.date > todayStr : e.date >= todayStr));
  const groups = groupConsecutive(entries.map((e) => e.date));
  const entriesByDate = new Map(entries.map((e) => [e.date, e.reason]));

  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const startStr = formatDate(group[0]);
        const includesToday = group.some((d) => formatDate(d) === todayStr);
        const isSingle = group.length === 1;
        const reason = isSingle ? entriesByDate.get(startStr) : "";

        let message;
        if (includesToday) {
          message = isSingle
            ? txt(gym, "portal.closed_today")
            : group.length === 2
              ? txt(gym, "portal.closed_today_tomorrow")
              : txt(gym, "portal.closed_today_until", { fecha: plainDate(group[group.length - 1]) });
        } else if (isSingle && startStr === tomorrowStr) {
          message = txt(gym, "portal.closed_tomorrow");
        } else if (isSingle) {
          message = txt(gym, "portal.closed_single", { fecha: formatHumanDate(startStr) });
        } else {
          message = txt(gym, "portal.closed_range", {
            fecha1: plainDate(group[0]),
            fecha2: plainDate(group[group.length - 1]),
          });
        }

        if (reason) {
          message = `${message} Motivo: ${reason}.`;
        }

        return (
          <div
            key={startStr}
            className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-bg dark:bg-danger/15 px-4 py-3 text-sm text-danger-text dark:text-danger"
          >
            <CalendarOff size={18} className="mt-0.5 shrink-0" />
            <p>{message}</p>
          </div>
        );
      })}
    </div>
  );
}