import { useState } from "react";
import { CalendarClock, CalendarOff, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
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

function ClosedGroupMessage({ gym, group, entriesByDate, todayStr, tomorrowStr }) {
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
}

export default function ClosedDatesNotice({ gym, closedDates = [], excludeToday = false, compact = false, maxDaysAhead = null, bannerDaysAhead = 14, dropdown = false }) {
  const today = todayMidnight();
  const todayStr = formatDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const entries = toEntries(closedDates)
    .filter((e) => (excludeToday ? e.date > todayStr : e.date >= todayStr))
    .filter((e) => {
      if (maxDaysAhead == null) return true;
      const d = parseDate(e.date);
      if (!d) return true;
      return Math.round((d - today) / 86400000) <= maxDaysAhead;
    });
  const groups = groupConsecutive(entries.map((e) => e.date));
  const entriesByDate = new Map(entries.map((e) => [e.date, e.reason]));

  if (groups.length === 0) return null;

  if (compact) {
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const next = sortedEntries[0];
    const nextDate = parseDate(next.date);
    const daysUntil = Math.round((nextDate - today) / 86400000);

    if (!dropdown && daysUntil > bannerDaysAhead) return null;

    const near = daysUntil <= bannerDaysAhead;
    const reason = next.reason;
    const remaining = entries.length - 1;
    const showDropdown = dropdown && remaining > 0;

    return (
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          near
            ? "border-danger/30 bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger"
            : "border-border/10 bg-surface-elevated text-text-primary"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          {near ? (
            <div className="flex items-start gap-3">
              <CalendarClock size={18} className="mt-0.5 shrink-0 opacity-70" />
              <p>
                Próximo cierre: {formatHumanDate(next.date)}
                {reason ? ` · ${reason}` : "."}
              </p>
            </div>
          ) : null}
          {showDropdown ? (
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-expanded={dropdownOpen}
              className={`flex shrink-0 items-center gap-1 text-sm font-medium transition hover:underline ${
                near ? "text-current" : "text-primary"
              }`}
            >
              <span>{near ? `Fechas (${entries.length})` : "Fechas cerradas"}</span>
              <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
          ) : remaining > 0 ? (
            <Link
              to="/settings?tab=cierres"
              className="shrink-0 text-sm font-medium text-primary transition hover:underline"
            >
              Ver todas ({entries.length})
            </Link>
          ) : null}
        </div>

        {dropdownOpen && (
          <div className="mt-3 space-y-2 border-t border-border/20 pt-3">
            {groups.map((group) => (
              <ClosedGroupMessage
                key={formatDate(group[0])}
                gym={gym}
                group={group}
                entriesByDate={entriesByDate}
                todayStr={todayStr}
                tomorrowStr={tomorrowStr}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <ClosedGroupMessage
          key={formatDate(group[0])}
          gym={gym}
          group={group}
          entriesByDate={entriesByDate}
          todayStr={todayStr}
          tomorrowStr={tomorrowStr}
        />
      ))}
    </div>
  );
}