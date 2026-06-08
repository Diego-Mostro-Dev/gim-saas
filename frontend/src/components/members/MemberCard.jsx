import { Pencil, Trash2, Share2, Link } from "lucide-react";

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
    <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#2a2a2a] font-bold text-blue-300">
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
            <p className="font-medium text-white">
              {member.first_name} {member.last_name}
            </p>

            <p className="text-sm text-zinc-400">{member.phone}</p>

            <p className="text-xs text-zinc-500">{member.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(member)}
            className="rounded-lg bg-blue-500/10 p-2 text-blue-300 transition hover:bg-blue-500/20"
          >
            <Pencil size={16} />
          </button>

          <div
            className={`rounded-md px-2 py-1 text-xs ${
              member.active
                ? "bg-blue-500/10 text-blue-300"
                : "bg-red-500/10 text-red-300"
            }`}
          >
            {member.active ? "Activo" : "Inactivo"}
          </div>

          <button
            onClick={() => onDelete(member.id)}
            className="rounded-lg bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
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
              className="rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-300"
            >
              {dayLabels[schedule.day]} {schedule.hour}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onViewPayments(member)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-600/30"
        >
          Historial
        </button>

        <button
          onClick={() => onSharePortal(member.id)}
          className="flex items-center gap-1.5 rounded-lg bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 transition hover:bg-green-600/30"
        >
          <Share2 size={14} />
          Compartir acceso
        </button>

        <button
          onClick={() => onCopyPortalLink(member.id)}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-600/20 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-600/30"
        >
          <Link size={14} />
          Copiar enlace
        </button>
      </div>
    </div>
  );
}

export default MemberCard;
