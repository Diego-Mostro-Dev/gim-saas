import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Users, CalendarDays, Repeat } from "lucide-react";
import { getAttendanceAnalytics } from "../services/attendance.service";
import { getCached, isCacheFresh } from "../utils/cache";

const TTL = 5 * 60 * 1000;

function analyticsCacheKey(start, end) {
  return `attendance-analytics-${start}-${end}`;
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-2 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-secondary">{label}</p>
          <p className="text-xl font-bold text-text-primary">{value}</p>
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

function AttendanceAnalytics() {
  const [startDate, setStartDate] = useState(() => {
    const stored = sessionStorage.getItem("analytics_start");
    if (stored) return stored;
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => {
    const stored = sessionStorage.getItem("analytics_end");
    if (stored) return stored;
    return formatDate(new Date());
  });

  const initialData = getCached(analyticsCacheKey(startDate, endDate));
  const initialFresh = isCacheFresh(analyticsCacheKey(startDate, endDate), TTL);

  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialFresh);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const key = analyticsCacheKey(startDate, endDate);
    if (isCacheFresh(key, TTL)) {
      setData(getCached(key));
      setLoading(false);
      setError(null);
      setRefreshing(true);
      try {
        const result = await getAttendanceAnalytics({ start_date: startDate, end_date: endDate });
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setRefreshing(false);
      }
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getAttendanceAnalytics({ start_date: startDate, end_date: endDate });
      setData(result);
    } catch (err) {
      setError(err.message || "Error al cargar métricas");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Métricas de asistencia</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Indicadores y estadísticas de asistencia
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
              sessionStorage.setItem("analytics_start", e.target.value);
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
              sessionStorage.setItem("analytics_end", e.target.value);
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
        <div className="mb-4 rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-sm text-danger-text dark:text-danger">{error}</div>
      )}

      {loading && !data ? (
        <LoadingSkeleton />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={CalendarDays} label="Asistencias totales" value={data.summary.total_attendances} color="bg-info-bg text-blue-400 dark:bg-info/15" />
            <StatCard icon={Users} label="Asistencias regulares" value={data.summary.regular_attendances} color="bg-success-bg dark:bg-success/15 text-success-text dark:text-success" />
            <StatCard icon={Repeat} label="Asistencias por intercambio de día" value={data.summary.swap_attendances} color="bg-info-bg text-blue-400 dark:bg-info/15" />
            <StatCard icon={TrendingUp} label="Asistencias por QR" value={data.summary.walkin_attendances} color="bg-warning-bg dark:bg-warning/15 text-warning-text dark:text-warning" />
          </div>

          {data.occupancy && (
            <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Ocupación
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-surface-input p-3">
                  <p className="text-xs text-text-secondary">Ocupación promedio</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {data.occupancy.average_occupancy_percent}%
                  </p>
                </div>
                <div className="rounded-xl bg-surface-input p-3">
                  <p className="text-xs text-text-secondary">Horario más concurrido</p>
                  {data.occupancy.highest_occupancy_slot ? (
                    <p className="text-lg font-semibold text-text-primary">
                      {data.occupancy.highest_occupancy_slot.day === "monday" ? "Lunes" :
                       data.occupancy.highest_occupancy_slot.day === "tuesday" ? "Martes" :
                       data.occupancy.highest_occupancy_slot.day === "wednesday" ? "Miércoles" :
                       data.occupancy.highest_occupancy_slot.day === "thursday" ? "Jueves" :
                       data.occupancy.highest_occupancy_slot.day === "friday" ? "Viernes" :
                       data.occupancy.highest_occupancy_slot.day === "saturday" ? "Sábado" :
                       data.occupancy.highest_occupancy_slot.day}{" "}
                      {data.occupancy.highest_occupancy_slot.hour}
                    </p>
                  ) : (
                    <p className="text-sm text-text-secondary">Sin datos</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Intercambios de día
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Solicitados", value: data.swaps.requested, color: "text-warning-text dark:text-warning" },
                { label: "Aprobados", value: data.swaps.approved, color: "text-success-text dark:text-success", autoValue: data.swaps.auto_approved },
                { label: "Rechazados", value: data.swaps.rejected, color: "text-danger-text dark:text-danger" },
                { label: "Cancelados", value: data.swaps.cancelled, color: "text-muted-text" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-surface-input p-3 text-center">
                  <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-text-secondary">{item.label}</p>
                  {item.autoValue > 0 && (
                    <p className="mt-0.5 text-[10px] text-blue-400">
                      {item.autoValue} aprobados sin revisión (había lugar disponible)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Horarios más concurridos
              </h2>
              {data.top_slots.length > 0 ? (
                <div className="space-y-2">
                  {data.top_slots.map((slot, i) => (
                    <div
                      key={`${slot.day}-${slot.hour}`}
                      className="flex items-center justify-between rounded-xl bg-surface-input px-3 py-2"
                    >
                      <span className="text-sm text-text-primary">
                        {slot.day === "monday" ? "Lunes" :
                         slot.day === "tuesday" ? "Martes" :
                         slot.day === "wednesday" ? "Miércoles" :
                         slot.day === "thursday" ? "Jueves" :
                         slot.day === "friday" ? "Viernes" :
                         slot.day === "saturday" ? "Sábado" :
                         slot.day}{" "}
                        {slot.hour}
                      </span>
                      <span className="rounded-md bg-info-bg px-2 py-0.5 text-xs text-info-text dark:bg-info/15 dark:text-info">
                        {slot.attendances}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Sin datos en este período</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Miembros con más asistencias
              </h2>
              {data.top_members.length > 0 ? (
                <div className="space-y-2">
                  {data.top_members.map((member) => (
                    <div
                      key={member.member_id}
                      className="flex items-center justify-between rounded-xl bg-surface-input px-3 py-2"
                    >
                      <span className="text-sm text-text-primary">{member.member_name}</span>
                      <span className="rounded-md bg-success-bg dark:bg-success/15 px-2 py-0.5 text-xs text-success-text dark:text-success">
                        {member.attendances}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Sin datos en este período</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AttendanceAnalytics;
