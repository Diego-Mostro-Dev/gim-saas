import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import toast from "react-hot-toast";
import { X, Clock, CheckCircle, RotateCcw } from "lucide-react";

import CurrentPlanCard from "../../components/plans/CurrentPlanCard";
import PlanChangeModal from "../../components/plans/PlanChangeModal";
import {
  createPublicPlanChangeRequest,
  cancelPublicPlanChangeRequest,
  cancelAutoRenewal,
  enableAutoRenewal,
} from "../../services/routines.service";

function formatDate(date) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("es-AR");
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

const dayNameMap = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
  thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

function MemberDashboard() {
  const { routine, token, slots, planChangeRequests, refreshRoutine } = useOutletContext();
  const [showAllAttendance, setShowAllAttendance] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const nextTraining = getNextTraining(routine.schedules);

  const { gym, subscription, attendance_history, last_payment } =
    routine;

  const activePlans = routine.active_plans || [];

  const pendingRequest = (planChangeRequests || []).find(
    (r) => r.status === "pending"
  );

  const approvedFutureRequest = (planChangeRequests || []).find(
    (r) => r.status === "approved" && r.effective_date
  );

  const [togglingRenewal, setTogglingRenewal] = useState(false);

  async function handleCancelRenewal() {
    setTogglingRenewal(true);
    try {
      await cancelAutoRenewal(token);
      toast.success("Renovación automática cancelada.");
      refreshRoutine();
    } catch (err) {
      toast.error(err?.message || "Error al cancelar renovación.");
    } finally {
      setTogglingRenewal(false);
    }
  }

  async function handleEnableRenewal() {
    setTogglingRenewal(true);
    try {
      await enableAutoRenewal(token);
      toast.success("Renovación automática reactivada.");
      refreshRoutine();
    } catch (err) {
      toast.error(err?.message || "Error al reactivar renovación.");
    } finally {
      setTogglingRenewal(false);
    }
  }

  async function handleCreateRequest(data) {
    try {
      await createPublicPlanChangeRequest(token, data);
      toast.success("Solicitud enviada correctamente.");
      refreshRoutine();
    } catch (err) {
      toast.error(err?.message || "Error al enviar la solicitud.");
      throw err;
    }
  }

  async function handleCancelRequest(id) {
    setCancellingId(id);
    try {
      await cancelPublicPlanChangeRequest(token, id);
      toast.success("Solicitud cancelada.");
      refreshRoutine();
    } catch (err) {
      toast.error(err?.message || "Error al cancelar la solicitud.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* SUSCRIPCIÓN */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Suscripción
        </h2>

        {subscription?.renewal_reminder && (
          <div className="mb-4 rounded-xl bg-primary-bg/20 dark:bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-primary-text dark:text-primary">
            <p className="font-medium">
              Tu suscripción se renovará automáticamente el{" "}
              {formatDate(subscription.renewal_date)}.
            </p>
          </div>
        )}

        {subscription ? (
          <>
            <div className="mb-4">
              {subscription.payment_status === "paid" ? (
                <span className="rounded-xl bg-success-bg dark:bg-success/15 px-3 py-1 text-sm font-semibold text-success-text dark:text-success">
                  ✓ Al día
                </span>
              ) : subscription.payment_status === "pending" ? (
                <span className="rounded-xl bg-warning-bg dark:bg-warning/15 px-3 py-1 text-sm font-semibold text-warning-text dark:text-warning">
                  ⚠ Pendiente de pago
                </span>
              ) : (
                <span className="rounded-xl bg-danger-bg dark:bg-danger/15 px-3 py-1 text-sm font-semibold text-danger-text dark:text-danger">
                  ❌ Pago vencido
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Plan</span>
                <span className="text-text-primary">{subscription.plan}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Inicio</span>
                <span className="text-text-primary">
                  {formatDate(subscription.start_date)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Vencimiento</span>
                <span className="text-text-primary">
                  {formatDate(subscription.end_date)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Estado</span>
                <span
                  className={`font-semibold ${
                    subscription.days_remaining > 0
                      ? "text-success-text dark:text-success"
                      : "text-danger-text dark:text-danger"
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

            {subscription.days_remaining > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-secondary">
                    Renovación automática
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      subscription.auto_renew
                        ? "text-success-text dark:text-success"
                        : "text-danger-text dark:text-danger"
                    }`}
                  >
                    {subscription.auto_renew ? "Activada" : "Cancelada"}
                  </span>
                </div>
                {subscription.auto_renew ? (
                  <button
                    onClick={handleCancelRenewal}
                    disabled={togglingRenewal}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 px-4 py-2 text-sm text-danger-text dark:text-danger transition hover:bg-danger/10 disabled:opacity-50"
                  >
                    <X size={16} />
                    {togglingRenewal
                      ? "Cancelando..."
                      : "Cancelar renovación automática"}
                  </button>
                ) : (
                  <button
                    onClick={handleEnableRenewal}
                    disabled={togglingRenewal}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm text-primary transition hover:bg-primary/10 disabled:opacity-50"
                  >
                    <RotateCcw size={16} />
                    {togglingRenewal
                      ? "Reactivando..."
                      : "Reactivar renovación automática"}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-text-secondary">Sin suscripción activa</p>
        )}
      </div>

      {/* MI PLAN */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Mi Plan
        </h2>

        <CurrentPlanCard subscription={subscription} />

        {pendingRequest ? (
          <div className="mt-4 rounded-xl border border-warning/20 bg-warning-bg dark:bg-warning/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-warning-text dark:text-warning" />
              <p className="text-sm font-medium text-warning-text dark:text-warning">
                Ya tenés una solicitud pendiente.
              </p>
            </div>
            <div className="space-y-2 text-sm text-text-primary">
              <div className="flex justify-between">
                <span className="text-text-secondary">Plan solicitado</span>
                <span>{pendingRequest.plan_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Fecha</span>
                <span>{formatDate(pendingRequest.requested_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Estado</span>
                <span className="rounded-full bg-warning-bg dark:bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-text dark:text-warning">
                  Pendiente
                </span>
              </div>
            </div>
            <button
              onClick={() => handleCancelRequest(pendingRequest.id)}
              disabled={cancellingId === pendingRequest.id}
              className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 px-4 py-2 text-sm text-danger-text dark:text-danger transition hover:bg-danger/10 disabled:opacity-50"
            >
              <X size={16} />
              {cancellingId === pendingRequest.id
                ? "Cancelando..."
                : "Cancelar solicitud"}
            </button>
          </div>
        ) : (
          subscription && activePlans.length > 0 && (
            <button
              onClick={() => setShowPlanModal(true)}
              className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary/90"
            >
              Solicitar cambio de plan
            </button>
          )
        )}

        {approvedFutureRequest && !pendingRequest && (
          <div className="mt-4 rounded-xl border border-info/20 bg-info-bg dark:bg-info/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-info-text dark:text-info" />
              <p className="text-sm font-medium text-info-text dark:text-info">
                Cambio de plan aprobado
              </p>
            </div>
            <div className="space-y-2 text-sm text-text-primary">
              <div className="flex justify-between">
                <span className="text-text-secondary">Nuevo plan</span>
                <span className="font-medium">{approvedFutureRequest.plan_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Activación</span>
                <span>{formatDate(approvedFutureRequest.effective_date)}</span>
              </div>
            </div>
            {approvedFutureRequest.planned_schedules?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-secondary mb-2">
                  Horarios reservados
                </p>
                <div className="space-y-1">
                  {approvedFutureRequest.planned_schedules.map((ps, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-text-primary">
                      <Clock size={14} className="text-info-text dark:text-info" />
                      <span>{dayNameMap[ps.day] || ps.day} {ps.hour}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => handleCancelRequest(approvedFutureRequest.id)}
              disabled={cancellingId === approvedFutureRequest.id}
              className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 px-4 py-2 text-sm text-danger-text dark:text-danger transition hover:bg-danger/10 disabled:opacity-50"
            >
              <X size={16} />
              {cancellingId === approvedFutureRequest.id
                ? "Cancelando..."
                : "Cancelar cambio aprobado"}
            </button>
          </div>
        )}
      </div>

      {/* PRÓXIMO ENTRENAMIENTO */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Próximo entrenamiento
        </h2>

        {nextTraining ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-text-primary">
                {nextTraining.dayLabel} {nextTraining.hour}
              </p>
              <p className="text-sm text-text-secondary">
                {nextTraining.daysUntil === 0
                  ? "Hoy"
                  : nextTraining.daysUntil === 1
                    ? "Mañana"
                    : `En ${nextTraining.daysUntil} días`}
              </p>
            </div>
            <span className={`rounded-lg px-3 py-1 text-xs font-medium ${
              nextTraining.daysUntil === 0
                ? "bg-success-bg dark:bg-success/15 text-success-text dark:text-success"
                : nextTraining.daysUntil <= 2
                  ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                  : "bg-muted-bg text-text-primary"
            }`}>
              {nextTraining.daysUntil === 0
                ? "Hoy"
                : nextTraining.daysUntil === 1
                  ? "Mañana"
                  : `${nextTraining.daysUntil} días`}
            </span>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Sin horarios asignados</p>
        )}
      </div>

      {/* ASISTENCIAS */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Asistencias recientes
          </h2>

          {attendance_history?.length > 3 && (
            <button
              onClick={() => setShowAllAttendance(!showAllAttendance)}
              className="text-xs text-info-text dark:text-info transition hover:text-info/80"
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
                className="flex items-center justify-between rounded-xl bg-surface-input px-4 py-3"
              >
                <span className="font-medium text-success-text dark:text-success">
                  ✓ Asistencia
                </span>
                <span className="text-text-primary">
                  {formatDate(attendance.date)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">
            Todavía no hay asistencias registradas.
          </p>
        )}
      </div>

      {/* ÚLTIMO PAGO */}
      {last_payment ? (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Último pago
          </h2>

          <div className="rounded-lg bg-surface-input border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Fecha</span>
              <span className="text-text-primary">
                {formatDate(last_payment.paid_at)}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-text-secondary">Monto</span>
              <span className="font-semibold text-text-primary">
                ${Number(last_payment.amount).toLocaleString("es-AR")}
              </span>
            </div>

            {last_payment.payment_method && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-text-secondary">Método</span>
                <span className="text-text-primary">
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
                <span className="text-text-secondary">Plan</span>
                <span className="text-text-primary">
                  {last_payment.plan_name}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}

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

      {showPlanModal && (
        <PlanChangeModal
          onClose={() => setShowPlanModal(false)}
          currentSubscription={subscription}
          currentSchedules={routine.schedules || []}
          availablePlans={activePlans}
          allSlots={slots}
          onCreateRequest={handleCreateRequest}
        />
      )}
    </div>
  );
}

export default MemberDashboard;
