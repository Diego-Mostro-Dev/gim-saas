import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, UserPlus, Check, RefreshCcw, Minus, Plus, X } from "lucide-react";
import toast from "react-hot-toast";

import ConfirmModal from "../components/ui/ConfirmModal";
import EnrollMemberModal from "../components/activities/EnrollMemberModal";
import { DAY_NAMES } from "../constants/days";
import { useScheduleEnrollments } from "../hooks/useScheduleEnrollments";
import {
  recordSession,
  removeSession,
  renewEnrollment,
  paySellado,
  recordEnrollmentPayment,
} from "../services/scheduleEnrollments.service";

function money(n) {
  if (n == null) return null;
  const num = Number(n);
  if (Number.isNaN(num)) return null;
  return `$${num.toLocaleString("es-AR")}`;
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
}

function ScheduleEnrollments() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const scheduleState = location.state?.schedule;
  const activityId = scheduleState?.activity;

  const {
    enrollments,
    loading,
    error,
    activity,
    activityName,
    handleUnenroll,
    reload,
  } = useScheduleEnrollments(scheduleId, activityId);

  const [searchTerm, setSearchTerm] = useState("");

  const [showUnenrollModal, setShowUnenrollModal] = useState(false);
  const [memberToUnenroll, setMemberToUnenroll] = useState(null);

  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const [renewId, setRenewId] = useState(null);
  const [renewCount, setRenewCount] = useState("10");
  const [actionLoading, setActionLoading] = useState(false);

  const [payTarget, setPayTarget] = useState(null);
  const [payConcept, setPayConcept] = useState("coseguro");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const dayLabel = scheduleState
    ? DAY_NAMES[scheduleState.day] || scheduleState.day
    : "";

  const timeRange = scheduleState
    ? `${formatTime(scheduleState.start_time)} - ${formatTime(scheduleState.end_time)}`
    : "";

  const capacity = scheduleState?.capacity;

  const activeEnrollments = enrollments.filter((e) => e.active !== false);
  const enrolledCount = activeEnrollments.length;

  const monthlyCount = activeEnrollments.filter(
    (e) => e.modality !== "package"
  ).length;
  const packageCount = activeEnrollments.filter(
    (e) => e.modality === "package"
  ).length;
  const exhaustedCount = activeEnrollments.filter((e) => e.exhausted).length;

  const filteredEnrollments = activeEnrollments.filter((e) => {
    if (!searchTerm) return true;
    const fullName =
      `${e.member.first_name} ${e.member.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  function handleOpenUnenrollModal(memberId) {
    setMemberToUnenroll(memberId);
    setShowUnenrollModal(true);
  }

  async function handleConfirmUnenroll() {
    try {
      await handleUnenroll(memberToUnenroll);
      toast.success("Miembro desinscripto");
      setShowUnenrollModal(false);
      setMemberToUnenroll(null);
    } catch (err) {
      toast.error(err.message || "Error al desinscribir");
    }
  }

  async function runAction(action, successMsg) {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await action();
      toast.success(successMsg);
      reload();
    } catch (err) {
      toast.error(err.message || "Error al ejecutar la acción");
    } finally {
      setActionLoading(false);
    }
  }

function handleOpenSellado(enrollment) {
  setPayTarget(enrollment);
  setPayConcept("sellado");
  setPayAmount(
    enrollment.sellado_amount != null
      ? String(enrollment.sellado_amount)
      : ""
  );
  setPayMethod("cash");
}

  async function handleAddSession(enrollment) {
    await runAction(() => recordSession(enrollment.id), "Sesión sumada");
  }

  async function handleRemoveSession(enrollment) {
    if (!enrollment.last_session_date) {
      toast.error("No hay sesiones registradas para quitar");
      return;
    }
    await runAction(
      () => removeSession(enrollment.id, enrollment.last_session_date),
      "Sesión quitada"
    );
  }

  async function handleRenew(enrollment) {
    const amount = parseInt(renewCount, 10);
    if (!amount || amount <= 0) {
      toast.error("Ingresá una cantidad de sesiones válida");
      return;
    }
    await runAction(
      () => renewEnrollment(enrollment.id, amount),
      "Paquete renovado correctamente"
    );
    setRenewId(null);
    setRenewCount("10");
  }

  function handleOpenPayment(enrollment) {
    setPayTarget(enrollment);
    setPayConcept("coseguro");
    setPayAmount(enrollment.remaining_amount ?? "");
    setPayMethod("cash");
  }

  async function handleConfirmPayment() {
    if (!payTarget) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    const action =
      payConcept === "sellado"
        ? () => paySellado(payTarget.id, amount, payMethod)
        : () => recordEnrollmentPayment(payTarget.id, amount, payMethod);
    await runAction(
      action,
      payConcept === "sellado"
        ? "Sellado cobrado correctamente"
        : "Pago registrado correctamente"
    );
    setPayTarget(null);
    setPayAmount("");
    setPayMethod("cash");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando inscriptos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* HEADER */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(`/activities/${activityId}/schedules`)}
          className="rounded-lg bg-surface-elevated p-2 text-text-secondary transition hover:bg-surface-hover"
          aria-label="Volver a horarios"
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-2xl font-bold">Inscriptos</h1>
      </div>

      {/* SCHEDULE INFO */}
      <div className="mb-4 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-text-secondary">Actividad</p>
            <p className="text-sm font-medium text-text-primary">
              {activityName || `Actividad #${activityId}`}
            </p>
          </div>

          <div>
            <p className="text-xs text-text-secondary">Horario</p>
            <p className="text-sm font-medium text-text-primary">
              {dayLabel}
              {dayLabel && timeRange ? " · " : ""}
              {timeRange}
            </p>
          </div>

          <div>
            <p className="text-xs text-text-secondary">Capacidad</p>
            <p className="text-sm font-medium text-text-primary">
              {capacity != null
                ? `${enrolledCount} / ${capacity}`
                : enrolledCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-text-secondary">Disponibles</p>
            <p
              className={`text-sm font-medium ${
                capacity != null && capacity - enrolledCount < Math.max(1, Math.round(capacity * 0.2))
                  ? "text-warning-text"
                  : "text-text-primary"
              }`}
            >
              {capacity != null ? capacity - enrolledCount : "—"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          <span className="rounded-full bg-surface-input px-3 py-1 font-medium text-text-secondary">
            {monthlyCount} {monthlyCount === 1 ? "mensual" : "mensuales"}
          </span>
          <span className="rounded-full bg-surface-input px-3 py-1 font-medium text-text-secondary">
            {packageCount} {packageCount === 1 ? "paquete" : "paquetes"}
          </span>
          {exhaustedCount > 0 && (
            <span className="rounded-full bg-danger-bg px-3 py-1 font-medium text-danger-text dark:bg-danger/15 dark:text-danger">
              {exhaustedCount} {exhaustedCount === 1 ? "agotado" : "agotados"}
            </span>
          )}
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger-text dark:bg-danger/10 dark:text-danger">
          {error}
        </div>
      )}

      {/* SEARCH + ENROLL BUTTON */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3">
        <Search size={18} className="text-text-secondary" />

        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
        />

        <button
          onClick={() => setShowEnrollModal(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600"
          aria-label="Inscribir miembro"
        >
          <UserPlus size={14} />
          <span className="hidden sm:inline">Inscribir</span>
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-2">
        {filteredEnrollments.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center shadow-sm">
            <p className="text-sm text-text-primary">
              {searchTerm
                ? "No se encontraron miembros con ese nombre."
                : "No hay miembros inscriptos todavía."}
            </p>

            {!searchTerm && (
              <button
                onClick={() => setShowEnrollModal(true)}
                className="mt-4 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600"
              >
                <UserPlus size={16} className="mr-1.5 inline" />
                Inscribir miembro
              </button>
            )}
          </div>
        ) : (
          filteredEnrollments.map((enrollment) => {
            const initial = (
              enrollment.member.first_name?.[0] || ""
            ).toUpperCase();

            const isPackage = enrollment.modality === "package";
            const selladoLabel = money(enrollment.sellado_amount);
            const noCharge =
              isPackage &&
              enrollment.session_price != null &&
              Number(enrollment.session_price) === 0;

            return (
              <div
                key={enrollment.id}
                className={`rounded-xl border border-border bg-surface-elevated p-4 shadow-sm ${
                  isPackage && enrollment.exhausted
                    ? "border-danger/40"
                    : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-sm font-bold text-info-text dark:bg-info/15 dark:text-info">
                    {initial}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">
                      {enrollment.member.first_name}{" "}
                      {enrollment.member.last_name}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {isPackage ? (
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            enrollment.exhausted
                              ? "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger"
                              : "bg-success-bg text-success-text dark:bg-success/15 dark:text-success"
                          }`}
                        >
                          {enrollment.exhausted
                            ? "Sesiones agotadas"
                            : `Sesiones ${enrollment.sessions_used}/${enrollment.sessions_total}`}
                        </span>
                      ) : (
                        <span className="rounded-md bg-info-bg px-2 py-0.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info">
                          Mensual
                        </span>
                      )}

                      {isPackage && enrollment.session_price != null && !noCharge && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-muted-bg px-2 py-0.5 text-xs font-medium text-text-primary">
                            Coseguro {money(enrollment.session_price)}/sesión
                          </span>
                          {enrollment.total_amount != null && (
                            <span className="rounded-md bg-muted-bg px-2 py-0.5 text-xs font-medium text-text-primary">
                              Total {money(enrollment.total_amount)}
                            </span>
                          )}
                          {Number(enrollment.remaining_amount) > 0 && (
                            <span className="rounded-md bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text dark:bg-warning/15 dark:text-warning">
                              Adeuda {money(enrollment.remaining_amount)}
                            </span>
                          )}
                        </div>
                      )}

                      {noCharge && (
                        <span className="mt-1 inline-block rounded-md bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text dark:bg-success/15 dark:text-success">
                          Sin cargo
                        </span>
                      )}

                      {isPackage && selladoLabel && (
                        enrollment.sellado_paid ? (
                          <span className="mt-1 inline-block rounded-md bg-muted-bg px-2 py-0.5 text-xs font-medium text-muted-text">
                            Sellado {selladoLabel} · Cobrado
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenSellado(enrollment)}
                            disabled={actionLoading}
                            title="Cobrar sellado"
                            className="mt-1 rounded-md bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text transition hover:brightness-95 disabled:opacity-50 dark:bg-warning/15 dark:text-warning"
                          >
                            Sellado {selladoLabel} · Pendiente
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isPackage && (
                      <>
                        <button
                          onClick={() => handleAddSession(enrollment)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 rounded-lg bg-success-bg px-2.5 py-2 text-xs font-medium text-success-text transition hover:brightness-95 disabled:opacity-50 dark:bg-success/15 dark:text-success"
                          title="Sumar sesión asistida"
                        >
                          <Plus size={14} />
                          <span className="hidden sm:inline">1</span>
                        </button>

                        <button
                          onClick={() =>
                            setRenewId((id) =>
                              id === enrollment.id ? null : enrollment.id
                            )
                          }
                          disabled={actionLoading}
                          className="flex items-center gap-1 rounded-lg bg-info-bg px-2.5 py-2 text-xs font-medium text-info-text transition hover:bg-info/20 disabled:opacity-50 dark:bg-info/15 dark:text-info"
                          title="Renovar paquete"
                        >
                          <RefreshCcw size={14} />
                          <span className="hidden sm:inline">Renovar</span>
                        </button>

                        <button
                          onClick={() => handleRemoveSession(enrollment)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 rounded-lg bg-muted-bg px-2.5 py-2 text-xs font-medium text-muted-text transition hover:bg-surface-input disabled:opacity-50"
                          title="Quitar última sesión (corrección)"
                        >
                          <Minus size={14} />
                          <span className="hidden sm:inline">1</span>
                        </button>
                      </>
                    )}

                      {isPackage && Number(enrollment.remaining_amount) > 0 && (
                        <button
                          onClick={() => handleOpenPayment(enrollment)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-2 text-xs font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                          title="Cobrar sesiones"
                        >
                          <Check size={14} />
                          Cobrar {money(enrollment.remaining_amount)}
                        </button>
                      )}

                      <button
                        onClick={() =>
                          handleOpenUnenrollModal(enrollment.member.id)
                        }
                      className="shrink-0 rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-text transition hover:bg-danger-bg dark:bg-danger/15 dark:text-danger"
                      aria-label="Desinscribir miembro"
                    >
                      Desinscribir
                    </button>
                  </div>
                </div>

                {isPackage && renewId === enrollment.id && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-input px-3 py-2">
                    <label
                      htmlFor="renew-count"
                      className="text-xs font-medium text-text-primary"
                    >
                      Agregar
                    </label>
                    <input
                      id="renew-count"
                      type="number"
                      min="1"
                      step="1"
                      value={renewCount}
                      onChange={(e) => setRenewCount(e.target.value)}
                      className="w-20 rounded-lg border border-border bg-surface-input px-3 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
                    />
                    <span className="text-xs text-text-secondary">sesiones</span>

                    <button
                      onClick={() => handleRenew(enrollment)}
                      disabled={actionLoading}
                      className="ml-auto flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-60"
                    >
                      <Check size={14} />
                      Confirmar
                    </button>
                    <button
                      onClick={() => setRenewId(null)}
                      disabled={actionLoading}
                      className="rounded-lg p-1.5 text-text-secondary transition hover:bg-surface-hover"
                      aria-label="Cancelar renovación"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ENROLL MEMBER MODAL */}
      {showEnrollModal && (
        <EnrollMemberModal
          scheduleId={scheduleId}
          enrollments={enrollments}
          activity={activity}
          onClose={() => setShowEnrollModal(false)}
          onSuccess={reload}
        />
      )}

      {/* CONFIRM UNENROLL MODAL */}
      <ConfirmModal
        isOpen={showUnenrollModal}
        title="Desinscribir miembro"
        message="El miembro será removido de este horario."
        confirmText="Desinscribir"
        cancelText="Cancelar"
        onClose={() => {
          setShowUnenrollModal(false);
          setMemberToUnenroll(null);
        }}
        onConfirm={handleConfirmUnenroll}
      />

      {/* PAYMENT MODAL */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-border/10 bg-surface-modal p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">
                {payConcept === "sellado" ? "Cobrar sellado" : "Cobrar sesiones"}
              </h2>
              <button
                onClick={() => setPayTarget(null)}
                className="text-text-secondary transition hover:text-text-primary"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-text-secondary">
              {payTarget.member.first_name} {payTarget.member.last_name} ·{" "}
              {payTarget.activity_name || payTarget.schedule?.activity || "Actividad"}
            </p>

            <div className="mt-3 rounded-xl border border-border bg-surface-input p-3 text-sm">
              {payConcept === "sellado" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Sellado</span>
                    <span className="text-text-primary">
                      {money(payTarget.sellado_amount)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-text-secondary">Coseguro por sesión</span>
                    <span className="text-text-primary">
                      {money(payTarget.session_price)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between font-semibold">
                    <span className="text-text-secondary">Estado</span>
                    <span className="text-warning bg-transparent dark:text-warning">
                      Pendiente
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Precio por sesión</span>
                    <span className="text-text-primary">
                      {money(payTarget.session_price)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-text-secondary">Total del paquete</span>
                    <span className="text-text-primary">{money(payTarget.total_amount)}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-text-secondary">Pagado</span>
                    <span className="text-success-text dark:text-success">
                      {money(payTarget.amount_paid)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between font-semibold">
                    <span className="text-text-secondary">Pendiente</span>
                    <span className="text-danger-text dark:text-danger">
                      {money(payTarget.remaining_amount)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <label
              htmlFor="pay-method"
              className="mt-4 mb-1 block text-xs font-medium text-text-primary"
            >
              Método de pago
            </label>
            <select
              id="pay-method"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
            </select>

            <label
              htmlFor="pay-amount"
              className="mt-4 mb-1 block text-xs font-medium text-text-primary"
            >
              Monto a cobrar $
            </label>
            <input
              id="pay-amount"
              type="number"
              min="1"
              step="100"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPayTarget(null)}
                className="rounded-xl border border-border bg-surface-input px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={actionLoading}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {actionLoading ? "Registrando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleEnrollments;