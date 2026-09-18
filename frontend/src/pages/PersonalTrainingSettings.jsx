import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Dumbbell,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { DAY_NAMES, DAY_ORDER } from "../constants/days";
import { formatCurrency } from "../utils/currency.utils";
import { getMembers } from "../services/members.service";
import MemberIdentity from "../components/common/MemberIdentity";
import {
  approvePersonalTrainingChangeRequest,
  createPersonalTrainingAssignment,
  createPersonalTrainingService,
  deletePersonalTrainingService,
  getPersonalTrainers,
  getPersonalTrainingAssignments,
  getPersonalTrainingAvailableSlots,
  getPersonalTrainingChangeRequests,
  getPersonalTrainingServices,
  reactivatePersonalTrainingService,
  recordPersonalTrainingSession,
  removePersonalTrainingSession,
  renewPersonalTrainingPackage,
  rejectPersonalTrainingChangeRequest,
  unassignPersonalTraining,
  updatePersonalTrainingService,
} from "../services/personalTraining.service";
import {
  dayIntervals,
  endHoursFor,
  isFree,
  reconcileSlot,
  startHoursFor,
} from "../utils/ptAvailability";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring";

const STATUS_LABELS = {
  pending: "Pendiente",
  executed: "Aprobada",
  rejected: "Rechazada",
  cancelled_by_member: "Cancelada",
  cancelled_by_staff: "Cancelada",
};

function PersonalTrainingSettings() {
  const [activeTab, setActiveTab] = useState("services");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-surface-input px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <Dumbbell size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-text-primary">
            Entrenamiento personal
          </h2>
          <p className="text-xs text-text-secondary">
            Servicios de entrenamiento, asignaciones de socios y solicitudes de
            cambio de horario.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-elevated p-1">
        {[
          { id: "services", label: "Servicios", icon: Dumbbell },
          { id: "assignments", label: "Asignaciones", icon: Users },
          { id: "requests", label: "Solicitudes", icon: CalendarDays },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-primary text-white"
                : "text-text-secondary hover:bg-surface-input hover:text-text-primary"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "services" && <ServicesPanel />}
      {activeTab === "assignments" && <AssignmentsPanel />}
      {activeTab === "requests" && <ChangeRequestsPanel />}
    </div>
  );
}

/* ---------------- Servicios ---------------- */

const EMPTY_SERVICE = {
  name: "",
  description: "",
  monthly_price: "",
  billing_mode: "monthly",
  duration_minutes: "60",
  trainer_gender: "any",
};

function ServicesPanel() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setServices(await getPersonalTrainingServices());
    } catch (err) {
      toast.error(err.message || "Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleCreate() {
    setEditing(null);
    setForm(EMPTY_SERVICE);
    setShowForm(true);
  }

  function handleEdit(service) {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description || "",
      monthly_price: service.monthly_price ?? "",
      billing_mode: service.billing_mode,
      duration_minutes: String(service.duration_minutes || 60),
      trainer_gender: service.trainer_gender,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Ingresá el nombre del servicio");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updatePersonalTrainingService(editing.id, form);
        toast.success("Servicio actualizado");
      } else {
        await createPersonalTrainingService(form);
        toast.success("Servicio creado");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Error al guardar el servicio");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(service) {
    try {
      if (service.active) {
        await deletePersonalTrainingService(service.id);
        toast.success("Servicio dado de baja");
      } else {
        await reactivatePersonalTrainingService(service.id);
        toast.success("Servicio reactivado");
      }
      await load();
    } catch (err) {
      toast.error(err.message || "Error al actualizar el servicio");
    }
  }

  const activeCount = services.filter((s) => s.active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          {activeCount} servicio{activeCount === 1 ? "" : "s"} activo
          {activeCount === 1 ? "" : "s"}
        </p>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 rounded-xl bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600"
        >
          <Plus size={14} />
          Nuevo servicio
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-text-secondary">
          Cargando servicios…
        </p>
      ) : services.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center">
          <p className="text-sm text-text-primary">
            Todavía no hay ofertas de entrenamiento personal.
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Creá un servicio para poder asignar socios.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface-elevated p-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-bold text-primary">
                {service.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-text-primary">
                    {service.name}
                  </p>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      service.active
                        ? "bg-success-bg text-success-text dark:bg-success/15 dark:text-success"
                        : "bg-muted-bg text-muted-text"
                    }`}
                  >
                    {service.active ? "Activo" : "Dado de baja"}
                  </span>
                </div>
                {service.description && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {service.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                  <span>
                    {service.billing_mode === "monthly"
                      ? `Mensual · ${formatCurrency(service.monthly_price)}`
                      : "Por sesión"}
                  </span>
                  <span>· {service.duration_minutes} min</span>
                  {service.trainer_gender !== "any" && (
                    <span>
                      · Trainer{" "}
                      {service.trainer_gender === "male"
                        ? "hombre"
                        : "mujer"}
                    </span>
                  )}
                  <span className="text-info-text dark:text-info">
                    · {service.assignment_count} asignació
                    {service.assignment_count === 1 ? "n" : "nes"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => handleEdit(service)}
                  className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-input hover:text-text-primary"
                  aria-label="Editar servicio"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleToggleActive(service)}
                  className={`rounded-lg p-2 transition ${
                    service.active
                      ? "text-danger-text dark:text-danger hover:bg-danger/10"
                      : "text-success-text dark:text-success hover:bg-success/10"
                  }`}
                  aria-label={service.active ? "Dar de baja" : "Reactivar"}
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-surface-elevated p-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">
                {editing ? "Editar servicio" : "Nuevo servicio"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-input"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <input
                type="text"
                placeholder="Nombre del servicio (ej: Plancha personalizada)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
              <textarea
                placeholder="Descripción (opcional)"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={`${inputClass} resize-none`}
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Modalidad de cobro
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "monthly", label: "Mensual" },
                    { id: "sessions", label: "Por sesión" },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                        form.billing_mode === opt.id
                          ? "border-blue-500 bg-blue-500/10 text-text-primary"
                          : "border-border bg-surface-input text-text-secondary"
                      }`}
                    >
                      <input
                        type="radio"
                        name="billing_mode"
                        checked={form.billing_mode === opt.id}
                        onChange={() =>
                          setForm({ ...form, billing_mode: opt.id })
                        }
                        className="hidden"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {form.billing_mode === "monthly" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Precio mensual
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Precio mensual"
                    value={form.monthly_price}
                    onChange={(e) =>
                      setForm({ ...form, monthly_price: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Duración (min)
                  </label>
                  <select
                    value={form.duration_minutes}
                    onChange={(e) =>
                      setForm({ ...form, duration_minutes: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                    <option value="75">75 min</option>
                    <option value="90">90 min</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Género del trainer
                  </label>
                  <select
                    value={form.trainer_gender}
                    onChange={(e) =>
                      setForm({ ...form, trainer_gender: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="any">Indistinto</option>
                    <option value="male">Hombre</option>
                    <option value="female">Mujer</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-text-primary transition hover:bg-surface-input"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting
                    ? "Guardando…"
                    : editing
                      ? "Guardar cambios"
                      : "Crear servicio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Asignaciones ---------------- */

const EMPTY_ASSIGNMENT = {
  member_id: null,
  trainer_id: "",
  service: "",
  day: "monday",
  start_time: "08:00",
  end_time: "09:00",
  modality: "monthly",
  package_total_sessions: "10",
  session_price: "",
  sellado_amount: "",
};

function AssignmentsPanel() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getPersonalTrainingAssignments({
        active: !showInactive,
      });
      setAssignments(data);
    } catch (err) {
      toast.error(err.message || "Error al cargar asignaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [showInactive]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border border-border bg-surface-input text-blue-500"
          />
          Incluir desvinculadas
        </label>
        <button
          onClick={() => setShowAssign(true)}
          className="flex items-center gap-1 rounded-xl bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600"
        >
          <Plus size={14} />
          Asignar socio
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-text-secondary">
          Cargando asignaciones…
        </p>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center">
          <p className="text-sm text-text-primary">
            No hay asignaciones
            {showInactive ? "" : " activas"}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onChanged={load}
            />
          ))}
        </div>
      )}

      {showAssign && (
        <AssignModal
          existingMembers={assignments
            .filter((a) => a.active)
            .map((a) => a.member.id)}
          onClose={() => setShowAssign(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

function AssignmentCard({ assignment, onChanged }) {
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [action, setAction] = useState(null);
  const [additional, setAdditional] = useState("5");
  const [busy, setBusy] = useState(false);

  const isPackage = assignment.modality === "package";

  async function run(fn, label, successMsg) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      setAction(null);
      onChanged();
    } catch (err) {
      toast.error(err.message || `Error al ${label}`);
    } finally {
      setBusy(false);
    }
  }

  const start = String(assignment.start_time).slice(0, 5);
  const end = String(assignment.end_time).slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MemberIdentity
              identity={assignment.member}
              showAvatar
              avatarSize="md"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <ShieldCheck size={13} />
              {assignment.trainer_name}
            </span>
            <span className="flex items-center gap-1">
              <Dumbbell size={13} />
              {assignment.service_name}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays size={13} /> {DAY_NAMES[assignment.day]} {start}–
              {end}
            </span>
            {!assignment.active && (
              <span className="rounded-md bg-muted-bg px-2 py-0.5 font-medium text-muted-text">
                Desvinculada
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                isPackage
                  ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                  : "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning"
              }`}
            >
              {isPackage ? "Paquete" : "Mensual"}
            </span>

            {isPackage && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-input">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${Math.min(
                        100,
                        ((assignment.sessions_used || 0) /
                          (assignment.sessions_total || 1)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-text-secondary">
                  {assignment.sessions_used}/{assignment.sessions_total}{" "}
                  sesiones
                </span>
              </div>
            )}

            {assignment.exhausted && (
              <span className="rounded-md bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text dark:bg-danger/15 dark:text-danger">
                Agotado
              </span>
            )}

            {assignment.sellado_amount > 0 && (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                  assignment.sellado_paid
                    ? "bg-success-bg text-success-text dark:bg-success/15 dark:text-success"
                    : "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning"
                }`}
              >
                Sellado{" "}
                {assignment.sellado_paid
                  ? "pagado"
                  : `${formatCurrency(assignment.sellado_amount)}`}
              </span>
            )}

            {Number(assignment.remaining_amount) > 0 && (
              <span className="text-xs font-medium text-warning-text dark:text-warning">
                Saldo {formatCurrency(assignment.remaining_amount)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          {isPackage && (
            <button
              onClick={() =>
                run(
                  () => recordPersonalTrainingSession(assignment.id, sessionDate),
                  "registrar la sesión",
                  "Sesión registrada",
                )
              }
              disabled={busy}
              className="rounded-lg bg-blue-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              Registrar sesión
            </button>
          )}
          {isPackage && (
            <button
              onClick={() => {
                setAction("remove_session");
              }}
              disabled={busy}
              className="rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-xs text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
            >
              Quitar
            </button>
          )}
          {isPackage && (
            <button
              onClick={() => setAction("renew")}
              disabled={busy}
              className="rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-xs text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
            >
              Renovar
            </button>
          )}
          {isPackage && !assignment.is_comp && (
            <button
              onClick={() => setAction("renew")}
              disabled={busy}
              className="rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-xs text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
            >
              Renovar
            </button>
          )}
          {assignment.active && (
            <button
              onClick={() => {
                if (!window.confirm("¿Desvincular este socio?")) return;
                run(
                  () => unassignPersonalTraining(assignment.id),
                  "desvincular al socio",
                  "Socio desvinculado",
                );
              }}
              disabled={busy}
              className="rounded-lg bg-danger-bg px-2.5 py-1.5 text-xs font-medium text-danger-text transition hover:bg-danger/10 disabled:opacity-50 dark:text-danger"
            >
              Desvincular
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          className="rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-xs text-text-primary outline-none"
        />
        <p className="text-[11px] text-text-secondary">
          Fecha para registrar/quitar sesión
        </p>
      </div>

      {action === "remove_session" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-input p-3">
          <CalendarDays size={14} className="text-danger-text dark:text-danger" />
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-xs text-text-primary outline-none"
          />
          <button
            onClick={() =>
              run(
                () => removePersonalTrainingSession(assignment.id, sessionDate),
                "quitar la sesión",
                "Sesión eliminada",
              )
            }
            disabled={busy}
            className="rounded-lg bg-danger-bg px-3 py-1.5 text-xs font-medium text-danger-text transition hover:bg-danger/10 disabled:opacity-50 dark:text-danger"
          >
            Quitar sesión
          </button>
          <button
            onClick={() => setAction(null)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition hover:bg-surface-hover"
          >
            Cancelar
          </button>
        </div>
      )}

      {action === "renew" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-input p-3">
          <RefreshCw size={14} className="text-info-text dark:text-info" />
          <input
            type="number"
            min="1"
            value={additional}
            onChange={(e) => setAdditional(e.target.value)}
            className="w-20 rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-xs text-text-primary outline-none"
            placeholder="Sesiones"
          />
          <button
            onClick={() =>
              run(
                () =>
                  renewPersonalTrainingPackage(
                    assignment.id,
                    Number(additional),
                  ),
                "renovar el paquete",
                "Paquete renovado",
              )
            }
            disabled={busy || !additional || Number(additional) <= 0}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            Añadir sesiones
          </button>
          <button
            onClick={() => setAction(null)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition hover:bg-surface-hover"
          >
            Cancelar
          </button>
        </div>
      )}

      {(Number(assignment.remaining_amount) > 0 ||
        (assignment.sellado_amount > 0 && !assignment.sellado_paid)) && (
        <p className="mt-2 text-[11px] text-text-secondary">
          {Number(assignment.remaining_amount) > 0 &&
            `Debe ${formatCurrency(assignment.remaining_amount)}. `}
          {assignment.sellado_amount > 0 &&
            !assignment.sellado_paid &&
            `Sellado pendiente (${formatCurrency(assignment.sellado_amount)}).`}
        </p>
      )}
    </div>
  );
}

function AssignModal({ existingMembers, onClose, onCreated }) {
  const [trainers, setTrainers] = useState([]);
  const [services, setServices] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [form, setForm] = useState(EMPTY_ASSIGNMENT);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState("member");
  const [selectedService, setSelectedService] = useState(null);
  const [freeData, setFreeData] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const fetchSeq = useRef(0);

  function fetchFreeSlots(member, serviceId, trainerId) {
    if (!member || !serviceId || !trainerId) {
      setFreeData(null);
      setSlotsLoading(false);
      return;
    }
    const seq = ++fetchSeq.current;
    setFreeData(null);
    setSlotsLoading(true);
    getPersonalTrainingAvailableSlots({
      member_id: member.id,
      trainer_id: Number(trainerId),
      service_id: Number(serviceId),
    })
      .then((res) => {
        if (seq !== fetchSeq.current) return;
        setFreeData(res);
        setForm((prev) => {
          const fixed = reconcileSlot(
            res,
            prev.day,
            prev.start_time,
            prev.end_time,
          );
          if (
            fixed.start === prev.start_time &&
            fixed.end === prev.end_time
          ) {
            return prev;
          }
          return {
            ...prev,
            start_time: fixed.start,
            end_time: fixed.end,
          };
        });
      })
      .catch((err) => {
        if (seq !== fetchSeq.current) return;
        toast.error(err.message || "Error al cargar horarios disponibles");
        setFreeData({ days: {}, closed_days: [] });
      })
      .finally(() => {
        if (seq === fetchSeq.current) setSlotsLoading(false);
      });
  }

  function dayUnavailable(day) {
    if (!freeData) return false;
    return (
      freeData.closed_days?.includes(day) ||
      dayIntervals(freeData, day).length === 0
    );
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [trainerData, serviceData, memberData] = await Promise.all([
          getPersonalTrainers(),
          getPersonalTrainingServices(),
          getMembers(),
        ]);
        setTrainers(trainerData.filter((t) => t.role === "trainer"));
        setServices(serviceData.filter((s) => s.active));
        setMembers(memberData);
      } catch (err) {
        toast.error(err.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredMembers = members.filter((m) => {
    if (existingMembers.includes(m.id)) return false;
    if (!m.subscription_active) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const haystack = [
      `${m.first_name} ${m.last_name}`,
      m.document_number,
      m.phone,
      m.affiliate_number,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  function pickMember(member) {
    setSelectedMember(member);
    setForm(function (prev) {
      if (member.insurance_sellado_amount == null) return prev;
      return {
        ...prev,
        sellado_amount: String(member.insurance_sellado_amount),
      };
    });
    fetchFreeSlots(member, form.service, form.trainer_id);
    setStep("details");
  }

  function handleServiceChange(value) {
    const service = services.find((s) => String(s.id) === value) || null;
    setSelectedService(service);
    setForm({
      ...form,
      service: value,
      modality: service ? service.billing_mode : "monthly",
    });
    fetchFreeSlots(selectedMember, value, form.trainer_id);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMember) return;
    if (!selectedMember.address) {
      toast.error(
        `${selectedMember.first_name} no tiene dirección cargada. Ingresá la dirección del socio para asignarlo.`,
      );
      return;
    }
    if (!form.trainer_id || !form.service) {
      toast.error("Completá el trainer y el servicio");
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.error("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    const intervals = dayIntervals(freeData, form.day);
    if (
      !intervals.length ||
      !isFree(intervals, form.start_time, form.end_time)
    ) {
      toast.error(
        "Ese horario ya no está disponible. Elegí otro de la lista.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await createPersonalTrainingAssignment({
        member_id: selectedMember.id,
        trainer_id: Number(form.trainer_id),
        service: Number(form.service),
        day: form.day,
        start_time: form.start_time,
        end_time: form.end_time,
        modality: form.modality,
        package_total_sessions:
          form.modality === "package"
            ? Number(form.package_total_sessions)
            : null,
        session_price:
          form.modality === "package" && form.session_price !== ""
            ? Number(form.session_price)
            : null,
        sellado_amount: form.sellado_amount !== "" ? Number(form.sellado_amount) : null,
      });
      toast.success("Socio asignado");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message || "Error al asignar el socio");
    } finally {
      setSubmitting(false);
    }
  }

  const isPackage = form.modality === "package";
  const dayIv = dayIntervals(freeData, form.day);
  const sessionDuration = freeData?.duration_minutes || 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-surface-elevated p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-primary">
            {step === "member"
              ? "Asignar socio"
              : selectedMember?.first_name
                ? `Asignar a ${selectedMember.first_name} ${selectedMember.last_name}`
                : "Detalles de la asignación"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-input"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {step === "member" && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-input px-4 py-3">
              <Search size={16} className="text-text-secondary" />
              <input
                type="text"
                placeholder="Buscar por nombre, DNI o teléfono…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-text-primary outline-none"
              />
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {loading ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  Cargando…
                </p>
              ) : filteredMembers.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  No hay socios disponibles para asignar.
                </p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => pickMember(m)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-input p-3 text-left transition hover:bg-surface-hover"
                  >
                    <MemberIdentity identity={m} dense />
                    {!m.address && (
                      <span className="ml-auto shrink-0 rounded-md bg-warning-bg px-2 py-0.5 text-[10px] font-medium text-warning-text dark:bg-warning/15 dark:text-warning">
                        Sin dirección
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === "details" && (
          <>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="flex items-center gap-2 rounded-xl bg-surface-input px-3 py-2.5 text-sm text-text-secondary">
                <button
                  type="button"
                  onClick={() => setStep("member")}
                  className="rounded-lg p-1 text-text-secondary transition hover:bg-surface-hover"
                  aria-label="Volver"
                >
                  <ArrowLeft size={16} />
                </button>
                <MemberIdentity identity={selectedMember} dense />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Servicio
                </label>
                <select
                  value={form.service}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">
                    {services.length
                      ? "Seleccioná un servicio…"
                      : "No hay servicios activos"}
                  </option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ·{" "}
                      {s.billing_mode === "monthly"
                        ? formatCurrency(s.monthly_price)
                        : "por sesión"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Trainer
                </label>
                <select
                  value={form.trainer_id}
                  onChange={(e) => {
                    const trainerId = e.target.value;
                    setForm({ ...form, trainer_id: trainerId });
                    fetchFreeSlots(selectedMember, form.service, trainerId);
                  }}
                  className={inputClass}
                >
                  <option value="">
                    {trainers.length
                      ? "Seleccioná un trainer…"
                      : "No hay trainers creados"}
                  </option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.first_name || t.username}
                      {selectedService &&
                      selectedService.trainer_gender !== "any"
                        ? ` (${t.gender === "male" ? "hombre" : "mujer"})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {slotsLoading ? (
                <p className="rounded-xl bg-surface-input px-4 py-3 text-xs text-text-secondary">
                  Cargando horarios disponibles…
                </p>
              ) : freeData ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Día
                      </label>
                      <select
                        value={form.day}
                        onChange={(e) => {
                          const day = e.target.value;
                          setForm((prev) => {
                            const fixed = reconcileSlot(
                              freeData,
                              day,
                              prev.start_time,
                              prev.end_time,
                            );
                            return {
                              ...prev,
                              day,
                              start_time: fixed.start,
                              end_time: fixed.end,
                            };
                          });
                        }}
                        className={inputClass}
                      >
                        {DAY_ORDER.map((day) => (
                          <option
                            key={day}
                            value={day}
                            disabled={dayUnavailable(day)}
                          >
                            {DAY_NAMES[day]}
                            {dayUnavailable(day)
                              ? freeData.closed_days?.includes(day)
                                ? " · cerrado"
                                : " · sin horarios"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Inicio
                      </label>
                      <select
                        value={form.start_time}
                        onChange={(e) => {
                          const nextStart = e.target.value;
                          const ends = endHoursFor(dayIv, nextStart, sessionDuration);
                          if (ends.includes(form.end_time)) {
                            setForm({ ...form, start_time: nextStart });
                          } else {
                            setForm({
                              ...form,
                              start_time: nextStart,
                              end_time: ends[0] || "",
                            });
                          }
                        }}
                        className={inputClass}
                      >
                        {form.end_time &&
                        dayIv.length > 0 ? (
                          startHoursFor(dayIv, sessionDuration)
                            .filter((h) => h < form.end_time)
                            .map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))
                        ) : (
                          <option value="" disabled>
                            Sin horarios
                          </option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Fin
                      </label>
                      <select
                        value={form.end_time}
                        onChange={(e) =>
                          setForm({ ...form, end_time: e.target.value })
                        }
                        className={inputClass}
                      >
                        {form.start_time && dayIv.length > 0 ? (
                          endHoursFor(dayIv, form.start_time, sessionDuration).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            Sin horarios
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                  {dayIv.length === 0 ? (
                    <p className="text-xs text-danger-text dark:text-danger">
                      No hay horarios libres este día. Elegí otro día de la
                      lista.
                    </p>
                  ) : (
                    <p className="text-xs text-text-secondary">
                      Solo se muestran horarios que no chocan con el gim común,
                      las actividades ni la agenda de los trainers.
                    </p>
                  )}
                </>
              ) : (
                <p className="rounded-xl bg-surface-input px-4 py-3 text-xs text-text-secondary">
                  Seleccioná servicio y trainer para ver los horarios
                  disponibles.
                </p>
              )}

              {isPackage && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Total de sesiones del paquete
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.package_total_sessions}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          package_total_sessions: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Precio por sesión
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Precio por sesión"
                        value={form.session_price}
                        onChange={(e) =>
                          setForm({ ...form, session_price: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Sellado (opcional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Sellado"
                        value={form.sellado_amount}
                        onChange={(e) =>
                          setForm({ ...form, sellado_amount: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-text-primary transition hover:bg-surface-input"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !selectedMember ||
                    !form.trainer_id ||
                    !form.service
                  }
                  className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting ? "Asignando…" : "Confirmar asignación"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Solicitudes ---------------- */

function ChangeRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getPersonalTrainingChangeRequests({
        status: showAll ? "" : "pending",
      });
      setRequests(data);
    } catch (err) {
      toast.error(err.message || "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [showAll]);

  async function handleReview(id, approve) {
    if (busyId) return;
    setBusyId(id);
    try {
      if (approve) {
        await approvePersonalTrainingChangeRequest(id, notes[id] || "");
        toast.success("Cambio aprobado");
      } else {
        await rejectPersonalTrainingChangeRequest(id, notes[id] || "");
        toast.success("Cambio rechazado");
      }
      setNotes((n) => ({ ...n, [id]: "" }));
      await load();
    } catch (err) {
      toast.error(err.message || "Error al revisar la solicitud");
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          {showAll
            ? `${requests.length} solicitudes`
            : pendingCount
              ? `${pendingCount} solicitud${pendingCount === 1 ? "" : "es"} pendiente${pendingCount === 1 ? "" : "s"}`
              : "Sin solicitudes pendientes"}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-4 w-4 rounded border border-border bg-surface-input text-blue-500"
          />
          Ver historial
        </label>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-text-secondary">
          Cargando solicitudes…
        </p>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center">
          <p className="text-sm text-text-primary">
            No hay solicitudes {showAll ? "" : "pendientes"}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => {
            const pending = request.status === "pending";
            const nextDay = dayAndTime(request);
            return (
              <div
                key={request.id}
                className="rounded-xl border border-border bg-surface-elevated p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MemberIdentity identity={request.member} dense />
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          pending
                            ? "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning"
                            : request.status === "executed"
                              ? "bg-success-bg text-success-text dark:bg-success/15 dark:text-success"
                              : "bg-muted-bg text-muted-text"
                        }`}
                      >
                        {STATUS_LABELS[request.status] || request.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-text-secondary">
                      De{" "}
                      <strong className="text-text-primary">
                        {DAY_NAMES[request.assignment_day]} ·{" "}
                        {String(request.assignment_start_time).slice(0, 5)}–
                        {String(request.assignment_end_time).slice(0, 5)}
                      </strong>{" "}
                      a{" "}
                      <strong className="text-text-primary">
                        {nextDay}
                      </strong>
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {request.service_name} · {request.trainer_name}
                    </p>
                    {request.admin_notes && (
                      <p className="mt-1 text-xs italic text-text-secondary">
                        “{request.admin_notes}”
                      </p>
                    )}
                  </div>

                  {pending && (
                    <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        placeholder="Nota (opcional)"
                        value={notes[request.id] || ""}
                        onChange={(e) =>
                          setNotes({
                            ...notes,
                            [request.id]: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-border bg-surface-input px-2.5 py-1.5 text-xs text-text-primary outline-none sm:w-40"
                      />
                      <button
                        onClick={() => handleReview(request.id, true)}
                        disabled={busyId === request.id}
                        className="rounded-lg bg-success-bg px-2.5 py-1.5 text-xs font-medium text-success-text transition hover:bg-success/10 disabled:opacity-50 dark:text-success"
                      >
                        <span className="flex items-center gap-1">
                          <Check size={13} /> Aprobar
                        </span>
                      </button>
                      <button
                        onClick={() => handleReview(request.id, false)}
                        disabled={busyId === request.id}
                        className="rounded-lg bg-danger-bg px-2.5 py-1.5 text-xs font-medium text-danger-text transition hover:bg-danger/10 disabled:opacity-50 dark:text-danger"
                      >
                        <span className="flex items-center gap-1">
                          <X size={13} /> Rechazar
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function dayAndTime(request) {
  return `${DAY_NAMES[request.requested_day]} · ${String(request.requested_start_time).slice(0, 5)}–${String(request.requested_end_time).slice(0, 5)}`;
}

export default PersonalTrainingSettings;