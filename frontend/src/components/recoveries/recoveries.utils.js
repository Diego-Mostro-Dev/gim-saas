import { formatLongDate } from "../../utils/date.utils";

export const RECOVERY_STATUS_LABELS = {
  scheduled: "Programada",
  used: "Usada",
  cancelled: "Cancelada",
  expired: "Vencida",
};

export const RECOVERY_STATUS_CLASS = {
  scheduled: "bg-info-bg dark:bg-info/15 text-info-text dark:text-info",
  used: "bg-info-bg dark:bg-info/15 text-info-text dark:text-info",
  cancelled: "bg-surface-input text-text-secondary",
  expired: "bg-surface-input text-text-secondary",
};

export function recoveryTitle(recovery) {
  if (!recovery) return "";
  return recovery.activity_name
    ? `${recovery.kind_label} · ${recovery.activity_name}`
    : recovery.kind_label || "Recuperación";
}

export function formatRecoveryPlanned(recovery) {
  const { status, used_date: usedDate, used_hour: usedHour } = recovery || {};
  if (!usedDate || !["scheduled", "used", "expired"].includes(status)) {
    return null;
  }
  const hour = usedHour ? ` a las ${usedHour}` : "";
  if (status === "scheduled") {
    return `Programada para el ${formatLongDate(usedDate)}${hour}`;
  }
  if (status === "used") {
    return `Usada el ${formatLongDate(usedDate)}${hour}`;
  }
  return `Era para el ${formatLongDate(usedDate)}${hour}. No se usó.`;
}