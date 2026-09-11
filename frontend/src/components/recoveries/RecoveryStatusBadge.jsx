import {
  RECOVERY_STATUS_LABELS,
  RECOVERY_STATUS_CLASS,
} from "./recoveries.utils";

function RecoveryStatusBadge({ status, className = "" }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
        RECOVERY_STATUS_CLASS[status] || "bg-surface-input text-text-secondary"
      } ${className}`}
    >
      {RECOVERY_STATUS_LABELS[status] || status}
    </span>
  );
}

export default RecoveryStatusBadge;