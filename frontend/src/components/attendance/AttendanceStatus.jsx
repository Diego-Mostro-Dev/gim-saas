import { useState } from "react";
import { Search } from "lucide-react";
import { useAttendanceStatus } from "../../hooks/useAttendanceStatus";

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
        <div className="rounded-lg bg-[#2a2a2a] p-3 text-sm text-zinc-500">
          {searchTerm
            ? "No se encontraron miembros con ese nombre."
            : "No hay miembros registrados para este horario."}
        </div>
      )}

      <p className="text-sm text-zinc-400">
        Asistieron {members.filter((member) => member.attended).length}
        {" / "}
        {members.length}
      </p>

      <div className="space-y-2">
        {filteredMembers.map((member) => (
          <div
            key={member.schedule_id}
            className="flex flex-col gap-2 rounded-lg bg-[#2a2a2a] px-3 py-2 md:flex-row md:items-center md:justify-between"
          >
            <span className="text-sm text-white">{member.member_name}</span>

            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-medium ${
                  member.attended ? "text-green-400" : "text-red-400"
                }`}
              >
                {member.attended ? "✓ Asistió" : "✗ No asistió"}
              </span>

              {!member.attended && (
                <button
                  onClick={async () => {
                    await markAttendance(member.schedule_id);
                  }}
                  className="rounded-lg bg-green-500 px-3 py-1 text-xs font-medium text-white hover:bg-green-600"
                >
                  Registrar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AttendanceStatus;
