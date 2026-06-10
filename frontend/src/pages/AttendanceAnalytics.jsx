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
    <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-2 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-zinc-400">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#201f1f]" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-[#201f1f]" />
      <div className="h-48 animate-pulse rounded-2xl bg-[#201f1f]" />
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
    <div className="min-h-screen bg-[#131313] px-4 pb-28 pt-6 text-white">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Métricas de asistencia</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Indicadores y estadísticas de asistencia
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Desde</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              sessionStorage.setItem("analytics_start", e.target.value);
            }}
            className="rounded-lg bg-[#2a2a2a] p-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Hasta</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              sessionStorage.setItem("analytics_end", e.target.value);
            }}
            className="rounded-lg bg-[#2a2a2a] p-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {loading && !data ? (
        <LoadingSkeleton />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={CalendarDays} label="Asistencias totales" value={data.summary.total_attendances} color="bg-purple-500/10 text-purple-400" />
            <StatCard icon={Users} label="Asistencias regulares" value={data.summary.regular_attendances} color="bg-green-500/10 text-green-400" />
            <StatCard icon={Repeat} label="Asistencias por intercambio de día" value={data.summary.swap_attendances} color="bg-blue-500/10 text-blue-400" />
            <StatCard icon={TrendingUp} label="Asistencias por QR" value={data.summary.walkin_attendances} color="bg-yellow-500/10 text-yellow-400" />
          </div>

          {data.occupancy && (
            <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Ocupación
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-[#2a2a2a] p-3">
                  <p className="text-xs text-zinc-400">Ocupación promedio</p>
                  <p className="text-2xl font-bold text-white">
                    {data.occupancy.average_occupancy_percent}%
                  </p>
                </div>
                <div className="rounded-xl bg-[#2a2a2a] p-3">
                  <p className="text-xs text-zinc-400">Horario más concurrido</p>
                  {data.occupancy.highest_occupancy_slot ? (
                    <p className="text-lg font-semibold text-white">
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
                    <p className="text-sm text-zinc-500">Sin datos</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Intercambios de día
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Solicitados", value: data.swaps.requested, color: "text-yellow-400" },
                { label: "Aprobados", value: data.swaps.approved, color: "text-green-400", autoValue: data.swaps.auto_approved },
                { label: "Rechazados", value: data.swaps.rejected, color: "text-red-400" },
                { label: "Cancelados", value: data.swaps.cancelled, color: "text-zinc-400" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[#2a2a2a] p-3 text-center">
                  <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-zinc-400">{item.label}</p>
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
            <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Horarios más concurridos
              </h2>
              {data.top_slots.length > 0 ? (
                <div className="space-y-2">
                  {data.top_slots.map((slot, i) => (
                    <div
                      key={`${slot.day}-${slot.hour}`}
                      className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-3 py-2"
                    >
                      <span className="text-sm text-white">
                        {slot.day === "monday" ? "Lunes" :
                         slot.day === "tuesday" ? "Martes" :
                         slot.day === "wednesday" ? "Miércoles" :
                         slot.day === "thursday" ? "Jueves" :
                         slot.day === "friday" ? "Viernes" :
                         slot.day === "saturday" ? "Sábado" :
                         slot.day}{" "}
                        {slot.hour}
                      </span>
                      <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300">
                        {slot.attendances}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Sin datos en este período</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Miembros con más asistencias
              </h2>
              {data.top_members.length > 0 ? (
                <div className="space-y-2">
                  {data.top_members.map((member) => (
                    <div
                      key={member.member_id}
                      className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-3 py-2"
                    >
                      <span className="text-sm text-white">{member.member_name}</span>
                      <span className="rounded-md bg-green-500/10 px-2 py-0.5 text-xs text-green-300">
                        {member.attendances}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Sin datos en este período</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AttendanceAnalytics;
