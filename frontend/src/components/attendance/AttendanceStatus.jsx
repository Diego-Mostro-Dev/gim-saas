import { useState } from "react";
import { Search } from "lucide-react";
import { useAttendanceStatus } from "../../hooks/useAttendanceStatus";
import { DAY_NAMES } from "../../constants/days";

function AttendanceStatus() {
  const {
    day,
    setDay,
    hour,
    setHour,
    members,
    loading,
    error,
    markAttendance,
  } = useAttendanceStatus();

  const [searchTerm, setSearchTerm] = useState("");

  const filteredMembers = members.filter((member) =>
    member.member_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-4 rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <h2 className="text-xl font-semibold text-white">Estado de asistencia</h2>

      <div className="flex flex-wrap gap-4 rounded-xl bg-[#2a2a2a] px-4 py-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="text-green-400">●</span> Asistió
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-red-400">○</span> No asistió
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-blue-400">↔</span> Intercambio de día
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="w-full rounded-lg bg-[#2a2a2a] p-2 text-white"
        >
          <option value="monday">Lunes</option>
          <option value="tuesday">Martes</option>
          <option value="wednesday">Miércoles</option>
          <option value="thursday">Jueves</option>
          <option value="friday">Viernes</option>
          <option value="saturday">Sábado</option>
        </select>

        <input
          type="time"
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          className="w-full rounded-lg bg-[#2a2a2a] p-2 text-white"
        />
      </div>

      {loading && (
        <div className="text-sm text-zinc-400">Cargando asistencia...</div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#2a2a2a] px-3 py-2">
        <Search size={16} className="text-zinc-500" />

        <input
          type="text"
          placeholder="Buscar miembro..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </div>

      {!loading && filteredMembers.length === 0 && (
        <div className="rounded-xl bg-[#2a2a2a] p-4 text-sm">
          {searchTerm ? (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-zinc-400">No se encontraron miembros con "{searchTerm}"</p>
              <button
                onClick={() => setSearchTerm("")}
                className="text-blue-400 hover:text-blue-300"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-zinc-400">No hay miembros registrados para este horario</p>
              <p className="text-xs text-zinc-500">
                Probá seleccionar otro día u horario, o agregá un nuevo socio desde Miembros.
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-zinc-400">
        Asistieron {members.filter((member) => member.attended).length}
        {" / "}
        {members.length}
      </p>

      <div className="space-y-2">
        {filteredMembers.map((member) => {
          const statusColor = member.is_swap
            ? "text-blue-400"
            : member.attended
              ? "text-green-400"
              : "text-red-400";

          const statusLabel = member.is_swap
            ? member.attended
              ? "Intercambio utilizado"
              : "Intercambio aprobado"
            : member.attended
              ? "✓ Asistió"
              : "✗ No asistió";

          const statusPrefix = member.is_swap
            ? member.attended
              ? "●"
              : "○"
            : member.attended
              ? "●"
              : "○";

          return (
            <div
              key={member.schedule_id}
              className="flex flex-col gap-2 rounded-lg bg-[#2a2a2a] px-3 py-2 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm text-white">
                  {member.member_name}
                  {member.is_swap && (
                    <span className="ml-2 text-xs text-blue-400">
                      ↔ Intercambio de día
                    </span>
                  )}
                </span>
                {member.is_swap && member.origin_day && (
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {DAY_NAMES[member.origin_day]} {member.origin_hour} → {DAY_NAMES[member.destination_day]} {member.destination_hour}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-medium ${statusColor}`}
                >
                  {statusPrefix} {statusLabel}
                </span>

                {!member.attended && !member.is_swap && (
                  <button
                    onClick={async () => {
                      await markAttendance(member.schedule_id);
                    }}
                    className="rounded-lg bg-green-500 px-3 py-1 text-xs font-medium text-white hover:bg-green-600"
                  >
                    Registrar asistencia
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AttendanceStatus;
