import { formatLongDate } from "../../utils/date.utils";
import RecoveryStatusBadge from "./RecoveryStatusBadge";
import { formatRecoveryPlanned, recoveryTitle } from "./recoveries.utils";

function RecoveryCard({
  recovery,
  emphasize = false,
  showGrantedMeta = false,
  showPlan = true,
  helper = null,
  actions = null,
  className = "",
}) {
  const planned = showPlan ? formatRecoveryPlanned(recovery) : null;

  return (
    <div
      className={`rounded-xl border p-3 ${
        emphasize
          ? "border-info/50 bg-info-bg dark:bg-info/10"
          : "border-border bg-surface-input"
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          {emphasize && (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-info-text dark:text-info">
              Próxima recuperación
            </p>
          )}

          <p className="text-sm font-medium text-text-primary">
            {recoveryTitle(recovery)}
          </p>

          {showGrantedMeta && recovery.granted_by_name && (
            <p className="mt-0.5 text-xs text-text-secondary">
              Otorgada por {recovery.granted_by_name}
              {recovery.created_at
                ? ` · ${formatLongDate(recovery.created_at)}`
                : ""}
            </p>
          )}

          {showGrantedMeta && !recovery.granted_by_name && recovery.created_at && (
            <p className="mt-0.5 text-xs text-text-secondary">
              Otorgada el {formatLongDate(recovery.created_at)}
            </p>
          )}

          {planned && (
            <p className="mt-0.5 text-xs text-text-secondary">{planned}</p>
          )}

          {helper && (
            <p className="mt-1 text-xs text-info-text dark:text-info">
              {helper}
            </p>
          )}

          {recovery.note && (
            <p className="mt-0.5 text-xs text-text-secondary">
              {recovery.note}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <RecoveryStatusBadge status={recovery.status} />
          {actions}
        </div>
      </div>
    </div>
  );
}

export default RecoveryCard;