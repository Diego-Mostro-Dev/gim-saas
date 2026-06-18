import { useEffect, useRef, useState } from "react";
import { Check, X, ArrowLeftRight } from "lucide-react";
import toast from "react-hot-toast";

import {
  getScheduleChangeRequests,
  approveScheduleChangeRequest,
  rejectScheduleChangeRequest,
} from "../services/attendance.service";
import { getScheduleChangesLastRefresh } from "../hooks/useScheduleChangeWatcher";
import { DAY_NAMES } from "../constants/days";
import { formatHumanDate } from "../utils/date.utils";
import MemberAvatar from "../components/common/MemberAvatar";

const STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "approved", label: "Aprobadas" },
  { key: "rejected", label: "Rechazadas" },
];

function ScheduleChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(() => sessionStorage.getItem("change_filter") || "all");

  const [approvalTarget, setApprovalTarget] = useState(null);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const lastFetchTimestamp = useRef(0);

  async function loadRequests() {
    if (Date.now() - Math.max(lastFetchTimestamp.current, getScheduleChangesLastRefresh()) < 60000) {
      setLoading(false);
      return;
    }
    lastFetchTimestamp.current = Date.now();

    try {
      setLoading(true);
      const data = await getScheduleChangeRequests();
      setRequests(data);
      window.dispatchEvent(
        new CustomEvent("schedule-changes-refreshed", { detail: data }),
      );
    } catch {
      toast.error("Error al cargar solicitudes de cambio permanente");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    function onRefreshed(e) {
      setRequests(e.detail);
      setLoading(false);
    }
    window.addEventListener("schedule-changes-refreshed", onRefreshed);
    return () => window.removeEventListener("schedule-changes-refreshed", onRefreshed);
  }, []);

  useEffect(() => {
    if (approvalTarget) {
      const updated = requests.find((r) => r.id === approvalTarget.id);
      if (!updated || updated.status !== "pending") {
        setApprovalTarget(null);
        if (updated?.status === "approved") {
          toast.success("Solicitud aprobada por otro administrador.");
        } else if (updated?.status === "rejected") {
          toast.success("Solicitud rechazada por otro administrador.");
        } else {
          toast.success("La solicitud ya no está pendiente.");
        }
      }
    }

    if (rejectionTarget) {
      const updated = requests.find((r) => r.id === rejectionTarget.id);
      if (!updated || updated.status !== "pending") {
        setRejectionTarget(null);
        setRejectionNotes("");
        if (updated?.status === "approved") {
          toast.success("Solicitud aprobada por otro administrador.");
        } else if (updated?.status === "rejected") {
          toast.success("Solicitud rechazada por otro administrador.");
        } else {
          toast.success("La solicitud ya no está pendiente.");
        }
      }
    }
  }, [requests]);

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  function statusBadge(status) {
    const base =
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
    const colors = {
      pending: "bg-warning-bg dark:bg-warning/15 text-warning-text dark:text-warning",
      approved: "bg-success-bg dark:bg-success/15 text-success-text dark:text-success",
      rejected: "bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger",
      cancelled: "bg-muted-bg text-muted-text",
    };
    return (
      <span className={`${base} ${colors[status] || colors.pending}`}>
        {STATUS_LABELS[status] || status}
      </span>
    );
  }

  function handleOpenApproval(req) {
    setApprovalTarget(req);
  }

  async function handleConfirmApproval() {
    if (!approvalTarget) return;

    const updated = requests.find((r) => r.id === approvalTarget.id);
    if (!updated || updated.status !== "pending") {
      setApprovalTarget(null);
      if (updated?.status === "approved") {
        toast.success("Solicitud aprobada por otro administrador.");
      } else if (updated?.status === "rejected") {
        toast.success("Solicitud rechazada por otro administrador.");
      } else {
        toast.success("La solicitud ya no está pendiente.");
      }
      return;
    }

    try {
      await approveScheduleChangeRequest(approvalTarget.id);
      toast.success("Cambio permanente aprobado");
      setApprovalTarget(null);
      loadRequests();
    } catch (error) {
      toast.error(error.message || "Error al aprobar");
    }
  }

  function handleOpenRejection(req) {
    setRejectionTarget(req);
    setRejectionNotes("");
  }

  async function handleConfirmRejection() {
    if (!rejectionTarget) return;

    const updated = requests.find((r) => r.id === rejectionTarget.id);
    if (!updated || updated.status !== "pending") {
      setRejectionTarget(null);
      setRejectionNotes("");
      if (updated?.status === "approved") {
        toast.success("Solicitud aprobada por otro administrador.");
      } else if (updated?.status === "rejected") {
        toast.success("Solicitud rechazada por otro administrador.");
      } else {
        toast.success("La solicitud ya no está pendiente.");
      }
      return;
    }

    try {
      const data = {};
      if (rejectionNotes.trim()) {
        data.admin_notes = rejectionNotes.trim();
      }
      await rejectScheduleChangeRequest(rejectionTarget.id, data);
      toast.success("Cambio permanente rechazado");
      setRejectionTarget(null);
      setRejectionNotes("");
      loadRequests();
    } catch (error) {
      toast.error(error.message || "Error al rechazar");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando solicitudes...
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-surface pb-28 pt-6 text-text-primary">
        <div className="mb-6 px-4">
          <h1 className="text-3xl font-bold">Cambios permanentes de horario</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Solicitudes de cambio permanente del horario habitual de un socio.
          </p>
        </div>

      <div className="mb-6 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              sessionStorage.setItem("change_filter", f.key);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              filter === f.key
                ? "bg-info text-white"
                : "bg-surface-elevated text-text-secondary hover:bg-surface-input"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4">
        {filteredRequests.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
            {requests.length === 0
              ? "No hay solicitudes de cambio permanente"
              : "No hay solicitudes con este estado"}
          </div>
        ) : (
          filteredRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    photo={req.member_photo}
                    firstName={req.member_name?.split(" ")[0]}
                    lastName={req.member_name?.split(" ").slice(1).join(" ")}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {req.member_name}
                    </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Solicitado el: {formatHumanDate(req.requested_at)}
                  </p>
                  {req.effective_date && (
                    <p className="text-xs text-text-secondary">
                      Vigente desde: {formatHumanDate(req.effective_date)}
                    </p>
                  )}
                </div>
              </div>
                {statusBadge(req.status)}
              </div>

              <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface-input px-3 py-2">
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary">Actual</p>
                  <p className="text-sm text-text-primary">
                    {DAY_NAMES[req.current_day] || req.current_day} {req.current_hour}
                  </p>
                </div>
                <ArrowLeftRight size={16} className="shrink-0 text-text-secondary" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary">Solicitado</p>
                  <p className="text-sm text-text-primary">
                    {DAY_NAMES[req.requested_day] || req.requested_day} {req.requested_hour}
                  </p>
                </div>
              </div>

              {req.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenApproval(req)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-success-bg dark:bg-success/15 py-2 text-sm font-medium text-success-text dark:text-success transition hover:bg-success-bg dark:hover:bg-success/30"
                  >
                    <Check size={16} />
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleOpenRejection(req)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger-bg dark:bg-danger/15 py-2 text-sm font-medium text-danger-text dark:text-danger transition hover:bg-danger-bg dark:hover:bg-danger/30"
                  >
                    <X size={16} />
                    Rechazar
                  </button>
                </div>
              )}

              {req.admin_notes && req.status !== "pending" && (
                <div className="mt-2 rounded-xl bg-surface-input px-3 py-2">
                  <p className="text-xs text-text-secondary">Notas:</p>
                  <p className="text-sm text-text-secondary">{req.admin_notes}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Approval modal */}
      {approvalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface-modal p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Aprobar cambio permanente
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-text-secondary">Socio</p>
                <p className="text-text-primary">{approvalTarget.member_name}</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-input px-3 py-2">
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary">Actual</p>
                  <p className="text-sm text-text-primary">
                    {DAY_NAMES[approvalTarget.current_day] || approvalTarget.current_day} {approvalTarget.current_hour}
                  </p>
                </div>
                <ArrowLeftRight size={16} className="shrink-0 text-text-secondary" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary">Nuevo</p>
                  <p className="text-sm text-success-text dark:text-success">
                    {DAY_NAMES[approvalTarget.requested_day] || approvalTarget.requested_day}{" "}
                    {approvalTarget.requested_hour}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setApprovalTarget(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-input"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmApproval}
                className="rounded-xl bg-success px-4 py-2 text-sm font-medium text-white transition hover:brightness-90"
              >
                Aprobar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection modal */}
      {rejectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface-modal p-6 shadow-2xl">
              {rejectionTarget.effective_date && (
                <div className="mt-3 rounded-xl bg-surface-input px-3 py-2">
                  <p className="text-xs text-text-secondary">Vigente desde</p>
                  <p className="text-sm text-text-primary">
                    {formatHumanDate(rejectionTarget.effective_date)}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-lg font-semibold text-text-primary">
                  Rechazar cambio permanente
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {rejectionTarget.member_name}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">
                Notas (opcional)
              </label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Motivo del rechazo..."
                rows={3}
                className="w-full rounded-xl border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectionTarget(null);
                  setRejectionNotes("");
                }}
                className="rounded-xl border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-input"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRejection}
                className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white transition hover:brightness-90"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleChangeRequests;
