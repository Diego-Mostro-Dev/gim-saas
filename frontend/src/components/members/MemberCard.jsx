import { Pencil, Trash2 } from "lucide-react";

function MemberCard({ member, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2a2a2a] font-bold text-blue-300">
          {member.first_name[0]}
          {member.last_name[0]}
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
  );
}

export default MemberCard;
