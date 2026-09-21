import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  TrendingUp,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { getPersonalTrainingAttendance } from "../services/personalTraining.service";
import { getCached, isCacheFresh } from "../utils/cache";
import { DAY_NAMES } from "../constants/days";
import MemberIdentity from "../components/common/MemberIdentity";

const TTL = 5 * 60 * 1000;

function analyticsCacheKey(start, end) {
  return `personal-training-attendance-${start}-${end}`;
}

function StatCard({ icon: Icon, label, value, color, caption }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-2 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-secondary">{label}</p>
          <p className="text-xl font-bold text-text-primary">{value}</p>
          {caption && (
            <p className="truncate text-[11px] text-text-secondary">{caption}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-input" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-input" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-xl bg-surface-input" />
      <div className="h-48 animate-pulse rounded-xl bg-surface-input" />
    </div>
  );
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function formatChipDate(iso) {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

function AttendanceChips({ attendance }) {
  if (attendance === null) {
    return (
      <span className="shrink-0 rounded-md border border-border bg-surface-input px-2 py-1 text-[11px] font-medium text-text-secondary">
        Sin seguimiento
      </span>
    );
  }

  if (attendance.length === 0) {
    return (
      <span className="shrink-0 rounded-md border border-border bg-surface-input px-2 py-1 text-[11px] font-medium text-text-secondary">
        Sin sesiones en el período
      </span>
    );
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {attendance.map((entry) => {
        const base =
          "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium";
        if (entry.status === "attended") {
          return (
            <span
              key={entry.date}
              title={`Asistió ${entry.date}`}
              className={`${base} bg-success-bg dark:bg-success/15 text-success-text dark:text-success`}
            >
              <span className="text-[9px] leading-none">●</span>
              {formatChipDate(entry.date)}
            </span>
          );
        }
        if (entry.status === "no_show") {
          return (
            <span
              key={entry.date}
              title={`No asistió ${entry.date}`}
              className={`${base} bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger`}
            >
              <span className="text-[9px] leading-none">✕</span>
              {formatChipDate(entry.date)}
            </span>
          );
        }
        return (
          <span
            key={entry.date}
            title={`Pendiente de registro ${entry.date}`}
            className={`${base} border border-border bg-surface-input text-text-secondary`}
          >
            —
            {formatChipDate(entry.date)}
          </span>
        );
      })}
    </div>
  );
}

function TrainerSection({ trainer }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-text dark:bg-info/15 dark:text-info">
          <User size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">
            {trainer.name || trainer.username}
          </p>
          <p className="flex flex-wrap gap-x-2 truncate text-xs text-text-secondary">
            {trainer.username && <span>@{trainer.username}</span>}
            {trainer.phone && <span>{trainer.phone}</span>}
            {trainer.whatsapp && <span>WhatsApp {trainer.whatsapp}</span>}
            {trainer.email && <span className="truncate">{trainer.email}</span>}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-info-bg px-2 py-1 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info">
          {trainer.assignments.length}{" "}
          {trainer.assignments.length === 1 ? "asignación" : "asignaciones"}
        </span>
      </div>

      <div className="space-y-2">
        {trainer.assignments.map((assignment) => (
          <div
            key={assignment.assignment_id}
            className="flex flex-col gap-2 rounded-lg bg-surface-input px-3 py-2"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                <MemberIdentity
                  identity={assignment.member.identity}
                  avatarSize="sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 rounded-md bg-info-bg px-2 py-1 text-[11px] font-medium text-info-text dark:bg-info/15 dark:text-info">
                  {DAY_NAMES[assignment.day]} {assignment.start_time} -{" "}
                  {assignment.end_time}
                </span>

                {assignment.modality === "package" ? (
                  <span className="shrink-0 rounded-md bg-warning-bg px-2 py-1 text-[11px] font-medium text-warning-text dark:bg-warning/15 dark:text-warning">
                    Paquete · {assignment.sessions_used}/{assignment.sessions_total}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-md bg-surface-elevated px-2 py-1 text-[11px] font-medium text-text-secondary">
                    Mensual
                  </span>
                )}
              </div>
            </div>

            <p className="truncate text-xs text-text-secondary">
              {assignment.service_name}
            </p>

            <AttendanceChips attendance={assignment.attendance} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonalTrainingAttendance() {
  const [startDate, setStartDate] = useState(() => {
    const stored = sessionStorage.getItem("pt_analytics_start");
    if (stored) return stored;
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => {
    const stored = sessionStorage.getItem("pt_analytics_end");
    if (stored) return stored;
    return formatDate(new Date());
  });

  const initialData = getCached(analyticsCacheKey(startDate, endDate));
  const initialFresh = isCacheFresh(analyticsCacheKey(startDate, endDate), TTL);

  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialFresh);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const key = analyticsCacheKey(startDate, endDate);
    if (isCacheFresh(key, TTL)) {
      const cached = getCached(key);
      if (cached) {
        setData(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getPersonalTrainingAttendance({
        start_date: startDate,
        end_date: endDate,
      });
      setData(result);
    } catch (err) {
      setError(err.message || "Error al cargar la asistencia de PT");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;
  const hasPending = (summary?.pending ?? 0) > 0;

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Asistencia del Personal Training</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Sesiones por trainer, socio y horario
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Desde</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              sessionStorage.setItem("pt_analytics_start", e.target.value);
            }}
            className="rounded-lg border border-border bg-surface-input p-2 text-sm text-text-primary [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Hasta</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              sessionStorage.setItem("pt_analytics_end", e.target.value);
            }}
            className="rounded-lg border border-border bg-surface-input p-2 text-sm text-text-primary [color-scheme:dark]"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      {loading && !data ? (
        <LoadingSkeleton />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid max-[340px]:grid-cols-1 grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={CalendarDays}
              label={
                <>
                  <span className="sm:hidden">Programadas</span>
                  <span className="hidden sm:inline">Sesiones programadas</span>
                </>
              }
              value={summary?.total_scheduled ?? 0}
              caption={
                summary?.active_assignments
                  ? `${summary.active_assignments} asignaciones · ${summary.active_trainers} trainers`
                  : undefined
              }
              color="bg-info-bg text-blue-400 dark:bg-info/15"
            />
            <StatCard
              icon={Users}
              label={
                <>
                  <span className="sm:hidden">Asistieron</span>
                  <span className="hidden sm:inline">Asistieron</span>
                </>
              }
              value={summary?.attended ?? 0}
              color="bg-success-bg dark:bg-success/15 text-success-text dark:text-success"
            />
            <StatCard
              icon={XCircle}
              label={
                <>
                  <span className="sm:hidden">No asistieron</span>
                  <span className="hidden sm:inline">No asistieron</span>
                </>
              }
              value={summary?.no_show ?? 0}
              color="bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger"
            />
            <StatCard
              icon={TrendingUp}
              label={
                <>
                  <span className="sm:hidden">Tasa</span>
                  <span className="hidden sm:inline">Tasa de asistencia</span>
                </>
              }
              value={`${summary?.attendance_rate ?? 0}%`}
              color="bg-warning-bg dark:bg-warning/15 text-warning-text dark:text-warning"
            />
          </div>

          {hasPending && (
            <div className="rounded-xl border border-border bg-surface-elevated p-3 text-xs text-text-secondary">
              {summary.pending}{" "}
              {summary.pending === 1
                ? "sesión pendiente de confirmar"
                : "sesiones pendientes de confirmar"}{" "}
              (el registro de no asistencia puede estar aún en proceso)
            </div>
          )}

          {data.trainers.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-4 rounded-xl bg-surface-elevated px-4 py-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="text-success-text dark:text-success">●</span>
                  Asistió
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-danger-text dark:text-danger">✕</span>
                  No asistió
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-text">—</span>
                  Pendiente de registro
                </span>
              </div>

              <div className="space-y-4">
                {data.trainers.map((trainer) => (
                  <TrainerSection key={trainer.trainer_id} trainer={trainer} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-elevated p-6 text-center">
              <p className="text-text-secondary">
                No hay asignaciones de Personal Training en este período
              </p>
              <p className="text-xs text-text-secondary">
                Probá cambiar el rango de fechas o asigná un socio desde
                Personal Training.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default PersonalTrainingAttendance;