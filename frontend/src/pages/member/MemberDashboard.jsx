import { useState } from "react";
import { useOutletContext } from "react-router-dom";

function formatDate(date) {
  return new Date(date).toLocaleDateString("es-AR");
}

function getNextTraining(schedules) {
  if (!schedules?.length) return null;

  const dayIndex = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };

  const dayNames = [
    "Domingo", "Lunes", "Martes", "Miércoles",
    "Jueves", "Viernes", "Sábado",
  ];

  const now = new Date();
  const today = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let best = null;
  let bestDiff = Infinity;

  for (const sched of schedules) {
    const targetDay = dayIndex[sched.day];
    if (targetDay === undefined) continue;

    const [h, m] = sched.hour.split(":").map(Number);
    const schedMinutes = h * 60 + m;

    let daysUntil = targetDay - today;
    if (daysUntil < 0 || (daysUntil === 0 && schedMinutes <= currentMinutes)) {
      daysUntil += 7;
    }

    const totalMinutes = daysUntil * 24 * 60 + (schedMinutes - currentMinutes);

    if (totalMinutes < bestDiff) {
      bestDiff = totalMinutes;
      best = {
        dayLabel: dayNames[targetDay],
        hour: sched.hour,
        daysUntil,
      };
    }
  }

  return best;
}

function MemberDashboard() {
  const { routine } = useOutletContext();
  const [showAllAttendance, setShowAllAttendance] = useState(false);
  const nextTraining = getNextTraining(routine.schedules);

  const { member, gym, subscription, attendance_history, last_payment } =
    routine;

  return (
    <div className="space-y-4">
      {/* SUSCRIPCIÓN */}
      <div className="rounded-2xl bg-[#201f1f] p-4">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Suscripción
        </h2>

        {subscription ? (
          <>
            <div className="mb-4">
              {subscription.paid ? (
                <span className="rounded-xl bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-400">
                  ✓ Cuota al día
                </span>
              ) : (
                <span className="rounded-xl bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-300">
                  ⚠ Pendiente de pago
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Plan</span>
                <span className="text-white">{subscription.plan}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Inicio</span>
                <span className="text-white">
                  {formatDate(subscription.start_date)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Vencimiento</span>
                <span className="text-white">
                  {formatDate(subscription.end_date)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Estado</span>
                <span
                  className={`font-semibold ${
                    subscription.days_remaining > 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {subscription.days_remaining > 0
                    ? `${subscription.days_remaining} días restantes`
                    : subscription.days_remaining === 0
                      ? "Vence hoy"
                      : "Vencido"}
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Sin suscripción activa</p>
        )}
      </div>

      {/* PRÓXIMO ENTRENAMIENTO */}
      <div className="rounded-2xl bg-[#201f1f] p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Próximo entrenamiento
        </h2>

        {nextTraining ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-white">
                {nextTraining.dayLabel} {nextTraining.hour}
              </p>
              <p className="text-sm text-zinc-400">
                {nextTraining.daysUntil === 0
                  ? "Hoy"
                  : nextTraining.daysUntil === 1
                    ? "Mañana"
                    : `En ${nextTraining.daysUntil} días`}
              </p>
            </div>
            <span className={`rounded-lg px-3 py-1 text-xs font-medium ${
              nextTraining.daysUntil === 0
                ? "bg-green-500/15 text-green-400"
                : nextTraining.daysUntil <= 2
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-zinc-500/15 text-zinc-300"
            }`}>
              {nextTraining.daysUntil === 0
                ? "Hoy"
                : nextTraining.daysUntil === 1
                  ? "Mañana"
                  : `${nextTraining.daysUntil} días`}
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Sin horarios asignados</p>
        )}
      </div>

      {/* ASISTENCIAS */}
      <div className="rounded-2xl bg-[#201f1f] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Asistencias recientes
          </h2>

          {attendance_history?.length > 3 && (
            <button
              onClick={() => setShowAllAttendance(!showAllAttendance)}
              className="text-xs text-blue-400 transition hover:text-blue-300"
            >
              {showAllAttendance
                ? "Mostrar menos"
                : `Ver todas (${attendance_history.length})`}
            </button>
          )}
        </div>

        {attendance_history?.length > 0 ? (
          <div className="mt-3 space-y-2">
            {(showAllAttendance
              ? attendance_history
              : attendance_history.slice(0, 3)
            ).map((attendance, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3"
              >
                <span className="font-medium text-green-400">
                  ✓ Asistencia
                </span>
                <span className="text-zinc-300">
                  {formatDate(attendance.date)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Todavía no hay asistencias registradas.
          </p>
        )}
      </div>

      {/* ÚLTIMO PAGO */}
      {last_payment ? (
        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Último pago
          </h2>

          <div className="rounded-xl bg-[#2a2a2a] p-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Fecha</span>
              <span className="text-white">
                {formatDate(last_payment.paid_at)}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-zinc-400">Monto</span>
              <span className="font-semibold text-white">
                ${Number(last_payment.amount).toLocaleString("es-AR")}
              </span>
            </div>

            {last_payment.payment_method && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-zinc-400">Método</span>
                <span className="text-white">
                  {last_payment.payment_method === "cash"
                    ? "Efectivo"
                    : last_payment.payment_method === "transfer"
                      ? "Transferencia"
                      : "Tarjeta"}
                </span>
              </div>
            )}

            {last_payment.plan_name && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-zinc-400">Plan</span>
                <span className="text-white">
                  {last_payment.plan_name}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* CONTACTO */}
      {(gym.whatsapp || gym.phone || gym.email) && (
        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Contacto del gimnasio
          </h2>

          <div className="space-y-3">
            {gym.whatsapp && (
              <a
                href={`https://wa.me/${gym.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl bg-green-600/20 px-4 py-3 text-sm font-medium text-green-400 transition hover:bg-green-600/30"
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
              <div className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3">
                <span className="text-sm text-zinc-400">Teléfono</span>
                <span className="text-sm text-white">{gym.phone}</span>
              </div>
            )}

            {gym.email && (
              <div className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3">
                <span className="text-sm text-zinc-400">Email</span>
                <span className="text-sm text-white">{gym.email}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberDashboard;
