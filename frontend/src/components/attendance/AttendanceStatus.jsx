import { useState } from "react";
import { Search } from "lucide-react";
import { useAttendanceStatus } from "../../hooks/useAttendanceStatus";
import { DAY_NAMES } from "../../constants/days";
import { txt } from "../../utils/labels";
import MemberIdentity from "../common/MemberIdentity";

function AttendanceStatus({ gym, openDays = [], closedDates = [] }) {
  const {
    day,
    setDay,
    hour,
    setHour,
    members,
    loading,
    error,
    markAttendance,
    canRegister,
    isTodayClosed,
  } = useAttendanceStatus(openDays, closedDates);

  const [searchTerm, setSearchTerm] = useState("");
  const [registeringId, setRegisteringId] = useState(null);

  const filteredMembers = members.filter((member) => {
    const term = searchTerm.toLowerCase();
    const identity = member.member_identity || {};
    const haystack = [
      member.member_name,
      identity.document_number,
      identity.phone,
      identity.insurance_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <h2 className="text-xl font-semibold text-text-primary">Estado de asistencia</h2>

      <div className="flex flex-wrap gap-4 rounded-xl bg-surface-input px-4 py-3 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="text-success-text dark:text-success">●</span> Asistió
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-danger-text dark:text-danger">○</span> No asistió
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-blue-400">↔</span> Intercambio
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-input p-2 text-text-primary"
        >
          {(openDays.length > 0 ? openDays : [
            "monday","tuesday","wednesday","thursday","friday","saturday"
          ]).map((d) => (
            <option key={d} value={d}>{DAY_NAMES[d]}</option>
          ))}
        </select>

        <input
          type="time"
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-input p-2 text-text-primary"
        />
      </div>

      {isTodayClosed && (
        <div className="rounded-lg border border-danger/30 bg-danger-bg dark:bg-danger/15 p-3 text-xs text-danger-text dark:text-danger">
          {txt(gym, "attendance.closed_today")}
        </div>
      )}

      {!canRegister && !isTodayClosed && (
        <div className="rounded-lg border border-border bg-surface-input p-3 text-xs text-text-secondary">
          Solo podés registrar asistencia para el día de hoy. La planilla de {DAY_NAMES[day]} está en modo lectura.
        </div>
      )}

      {loading && (
        <div className="text-sm text-text-secondary">Cargando asistencia...</div>
      )}

      {error && (
        <div className="rounded-lg bg-danger-bg dark:bg-danger/15 p-3 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-input px-3 py-2">
        <Search size={16} className="text-text-secondary" />

        <input
          type="text"
          placeholder="Buscar miembro..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
        />
      </div>

      {!loading && filteredMembers.length === 0 && (
        <div className="rounded-lg bg-surface-input border border-border p-4 text-sm">
          {searchTerm ? (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-text-secondary">No se encontraron miembros con "{searchTerm}"</p>
              <button
                onClick={() => setSearchTerm("")}
                className="text-info-text dark:text-info hover:text-info/80"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-text-secondary">No hay miembros registrados para este horario</p>
              <p className="text-xs text-text-secondary">
                Probá seleccionar otro día u horario, o agregá un nuevo socio desde Miembros.
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-text-secondary">
        Asistieron {members.filter((member) => !member.is_class && member.attended).length}
        {" / "}
        {members.filter((member) => !member.is_class).length}
      </p>

      <div className="space-y-2">
        {filteredMembers.map((member) => {
          if (member.is_class) {
            return (
              <div
                key={`class-${member.schedule_id}`}
                className="flex flex-col gap-2 rounded-lg bg-surface-input px-3 py-2 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-text-primary">
                    {member.member_name}
                  </span>
                  {member.service_name && (
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      {member.service_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 rounded-md bg-info-bg px-2 py-1 text-[11px] font-medium text-info-text dark:bg-info/15 dark:text-info">
                    Clase · {member.class_name} · {member.start_time} - {member.end_time}
                  </span>
                </div>
              </div>
            );
          }

          const statusColor = member.is_swap
            ? "text-blue-400"
            : member.attended
              ? "text-success-text dark:text-success"
              : "text-danger-text dark:text-danger";

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
              key={`att-${member.schedule_id}`}
              className="flex flex-col gap-2 rounded-lg bg-surface-input px-3 py-2 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm text-text-primary">
                  {member.member_name}
                  {member.is_swap && (
                    <span className="ml-2 text-xs text-blue-400">
                      ↔ Intercambio
                    </span>
                  )}
                </span>
                {(member.member_identity?.document_number ||
                  member.member_identity?.phone ||
                  member.member_identity?.insurance_name) && (
                  <MemberIdentity
                    member={member.member_identity}
                    showAvatar={false}
                    showName={false}
                    dense
                    className="mt-0.5"
                  />
                )}
                {member.service_name && (
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {member.service_name}
                  </p>
                )}
                {member.is_swap && member.origin_day && (
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {DAY_NAMES[member.origin_day]} {member.origin_hour} → {DAY_NAMES[member.destination_day]} {member.destination_hour}
                  </p>
                )}
                {!member.is_swap && member.schedule_id < 0 && (
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    Asistió (sin horario asignado)
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
                      if (registeringId === member.schedule_id) return;
                      setRegisteringId(member.schedule_id);
                      try {
                        await markAttendance(member.schedule_id);
                      } finally {
                        setRegisteringId(null);
                      }
                    }}
                    disabled={registeringId === member.schedule_id || !canRegister}
                    title={!canRegister ? "Solo podés registrar asistencia para el día de hoy" : undefined}
                    className="rounded-lg bg-success px-3 py-1 text-xs font-medium text-white hover:bg-success disabled:opacity-50"
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
