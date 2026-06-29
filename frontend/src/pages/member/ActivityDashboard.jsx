import { useOutletContext, useNavigate } from "react-router-dom";
import { CalendarClock, Sparkles, CreditCard } from "lucide-react";
import { formatHumanDate } from "../../utils/date.utils";
import { useMemberActivities } from "../../hooks/useMemberActivities";
import { DAY_NAMES } from "../../constants/days";

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
}

function ActivityDashboard() {
  const { routine, token } = useOutletContext();
  const navigate = useNavigate();
  const { enrollments, loading } = useMemberActivities(token);

  const { member, gym, last_payment } = routine;

  const activeEnrollments = enrollments.filter((e) => e.active !== false);

  const upcomingActivities = (() => {
    if (!activeEnrollments.length) return [];

    const dayIndex = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };

    const now = new Date();
    const today = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const sorted = activeEnrollments
      .map((e) => {
        const targetDay = dayIndex[e.day];
        if (targetDay === undefined) return null;

        const [h, m] = (e.start_time || "00:00").split(":").map(Number);
        const schedMinutes = h * 60 + m;

        let daysUntil = targetDay - today;
        if (daysUntil < 0 || (daysUntil === 0 && schedMinutes <= currentMinutes)) {
          daysUntil += 7;
        }

        return { ...e, daysUntil, totalMinutes: daysUntil * 24 * 60 + (schedMinutes - currentMinutes) };
      })
      .filter(Boolean)
      .sort((a, b) => a.totalMinutes - b.totalMinutes)
      .slice(0, 3);

    return sorted;
  })();

  return (
    <div className="space-y-4">
      {/* SALUDO */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h1 className="text-xl font-bold text-text-primary">
          ¡Hola, {member.first_name}!
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{gym.name}</p>
      </div>

      {/* ACTIVIDADES ACTIVAS */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Mis actividades
          </h2>
          {activeEnrollments.length > 0 && (
            <button
              onClick={() => navigate(`/routine/${token}/activities`)}
              className="text-xs text-info-text dark:text-info transition hover:text-info/80"
            >
              Ver todas
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary">Cargando...</p>
        ) : activeEnrollments.length > 0 ? (
          <div className="space-y-2">
            {activeEnrollments.slice(0, 5).map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center gap-3 rounded-lg bg-surface-input px-4 py-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
                  {enrollment.activity_name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {enrollment.activity_name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {DAY_NAMES[enrollment.day] || enrollment.day} ·{" "}
                    {formatTime(enrollment.start_time)} -{" "}
                    {formatTime(enrollment.end_time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <Sparkles size={32} className="mb-2 text-text-secondary" />
            <p className="text-sm text-text-secondary text-center">
              No estás inscripto en ninguna actividad.
            </p>
            <p className="mt-1 text-xs text-text-secondary text-center">
              Consultá en recepción para inscribirte.
            </p>
          </div>
        )}
      </div>

      {/* PRÓXIMAS ACTIVIDADES */}
      {upcomingActivities.length > 0 && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Próximas actividades
          </h2>
          <div className="space-y-2">
            {upcomingActivities.map((enrollment) => {
              const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
              const dayIndexMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
              const dayLabel = dayNames[dayIndexMap[enrollment.day]] || enrollment.day;

              return (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between rounded-lg bg-surface-input px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {enrollment.activity_name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {dayLabel} · {formatTime(enrollment.start_time)}
                    </p>
                  </div>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    enrollment.daysUntil === 0
                      ? "bg-success-bg dark:bg-success/15 text-success-text dark:text-success"
                      : enrollment.daysUntil === 1
                        ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                        : "bg-muted-bg text-text-primary"
                  }`}>
                    {enrollment.daysUntil === 0
                      ? "Hoy"
                      : enrollment.daysUntil === 1
                        ? "Mañana"
                        : `${enrollment.daysUntil} días`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BOTÓN VER MIS ACTIVIDADES */}
      <button
        onClick={() => navigate(`/routine/${token}/activities`)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary/90"
      >
        <Sparkles size={18} />
        Ver mis actividades
      </button>

      {/* ESTADO DE PAGOS */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Estado de pagos
        </h2>

        {last_payment ? (
          <div className="rounded-lg bg-surface-input border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Último pago</span>
              <span className="text-text-primary">
                {formatHumanDate(last_payment.paid_at)}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-text-secondary">Monto</span>
              <span className="font-semibold text-text-primary">
                ${Number(last_payment.amount).toLocaleString("es-AR")}
              </span>
            </div>

            {last_payment.plan_name && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-text-secondary">Concepto</span>
                <span className="text-text-primary">{last_payment.plan_name}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Sin pagos registrados</p>
        )}

        <button
          onClick={() => navigate(`/routine/${token}/payments`)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm text-primary transition hover:bg-primary/10"
        >
          <CreditCard size={16} />
          Ver historial de pagos
        </button>
      </div>

      {/* CONTACTO */}
      {(gym.whatsapp || gym.phone || gym.email) && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Contacto del gimnasio
          </h2>

          <div className="space-y-3">
            {gym.whatsapp && (
              <a
                href={`https://wa.me/${gym.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl bg-success-bg dark:bg-success/15 px-4 py-3 text-sm font-medium text-success-text dark:text-success transition hover:bg-success/30"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Contactar por WhatsApp
              </a>
            )}

            {gym.phone && (
              <div className="flex items-center justify-between rounded-xl bg-surface-input px-4 py-3">
                <span className="text-sm text-text-secondary">Teléfono</span>
                <span className="text-sm text-text-primary">{gym.phone}</span>
              </div>
            )}

            {gym.email && (
              <div className="flex items-center justify-between rounded-xl bg-surface-input px-4 py-3">
                <span className="text-sm text-text-secondary">Email</span>
                <span className="text-sm text-text-primary">{gym.email}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityDashboard;
