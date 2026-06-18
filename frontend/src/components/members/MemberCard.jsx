import { Pencil, Trash2, Share2, Link } from "lucide-react";
import { formatHumanDate } from "../../utils/date.utils";

function MemberCard({
  member,
  onEdit,
  onDelete,
  onSharePortal,
  onCopyPortalLink,
  onViewPayments,
}) {
  const dayLabels = {
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mié",
    thursday: "Jue",
    friday: "Vie",
    saturday: "Sáb",
  };

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-input font-bold text-info-text dark:text-info">
            {member.photo ? (
              <img
                src={member.photo}
                alt={`${member.first_name} ${member.last_name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                {member.first_name[0]}
                {member.last_name[0]}
              </>
            )}
          </div>

          <div>
            <p className="font-medium text-text-primary">
              {member.first_name} {member.last_name}
            </p>

            <p className="text-sm text-text-secondary">{member.phone}</p>

            <p className="text-xs text-text-secondary">{member.email}</p>

            {member.plan_name && (
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-md bg-success-bg dark:bg-success/15 px-2 py-0.5 text-xs text-success-text dark:text-success">
                  {member.plan_name}
                </span>

                {member.subscription_end_date && (
                    <span className="text-xs text-text-secondary">
                    {member.subscription_days_remaining != null
                      ? `${
                          member.subscription_days_remaining === 1
                            ? "1 día restante"
                            : `${member.subscription_days_remaining} días restantes`
                        }`
                      : `hasta ${formatHumanDate(member.subscription_end_date)}`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(member)}
            className="rounded-lg bg-info-bg p-2 text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/20"
          >
            <Pencil size={16} />
          </button>

          <button
            onClick={() => onDelete(member.id)}
            className="rounded-lg bg-danger-bg dark:bg-danger/15 p-2 text-danger-text dark:text-danger transition hover:bg-danger-bg dark:hover:bg-danger/20"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {member.schedules?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {member.schedules.map((schedule) => (
            <span
              key={`${schedule.day}-${schedule.hour}`}
              className="rounded-md bg-info-bg px-2 py-1 text-xs text-info-text dark:bg-info/15 dark:text-info"
            >
              {dayLabels[schedule.day]} {schedule.hour}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onViewPayments(member)}
          className="flex items-center gap-1.5 rounded-lg bg-info-bg px-3 py-1.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/30"
        >
          Historial
        </button>

        <button
          onClick={() => onSharePortal(member.id)}
          className="flex items-center gap-1.5 rounded-lg bg-success-bg dark:bg-success/15 px-3 py-1.5 text-xs font-medium text-success-text dark:text-success transition hover:bg-success-bg dark:hover:bg-success/30"
        >
          <Share2 size={14} />
          Compartir acceso
        </button>

        <button
          onClick={() => onCopyPortalLink(member.id)}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-600/20 px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-zinc-600/30"
        >
          <Link size={14} />
          Copiar enlace
        </button>
      </div>
    </div>
  );
}

export default MemberCard;
