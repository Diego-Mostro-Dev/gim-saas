import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Inbox, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  approveOutingEnrollmentRequest,
  getOutingEnrollmentRequests,
  rejectOutingEnrollmentRequest,
} from "../../services/outingsRequests.service";
import { DAY_NAMES } from "../../constants/days";
import { formatHumanDate } from "../../utils/date.utils";
import MemberIdentity from "../common/MemberIdentity";

function OutingEnrollmentRequests({ onChanged }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState(null);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [acting, setActing] = useState(false);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOutingEnrollmentRequests("status=pending");
      if (!cancelledRef.current) setRequests(data || []);
    } catch {
      if (!cancelledRef.current) {
        toast.error("Error al cargar las solicitudes de salidas");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  async function handleConfirmApproval() {
    if (!approvalTarget) return;
    setActing(true);
    try {
      const data = {};
      if (approvalTarget.notes?.trim()) {
        data.admin_notes = approvalTarget.notes.trim();
      }
      await approveOutingEnrollmentRequest(approvalTarget.id, data);
      toast.success("Solicitud aprobada");
      setApprovalTarget(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message || "Error al aprobar la solicitud");
    } finally {
      setActing(false);
    }
  }

  async function handleConfirmRejection() {
    if (!rejectionTarget) return;
    setActing(true);
    try {
      const data = {};
      if (rejectionNotes.trim()) {
        data.admin_notes = rejectionNotes.trim();
      }
      await rejectOutingEnrollmentRequest(rejectionTarget.id, data);
      toast.success("Solicitud rechazada");
      setRejectionTarget(null);
      setRejectionNotes("");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message || "Error al rechazar la solicitud");
    } finally {
      setActing(false);
    }
  }

  function typeBadge(type) {
    return (
      <span
        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
          type === "enroll"
            ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
            : "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger"
        }`}
      >
        {type === "enroll" ? "Inscripción" : "Baja"}
      </span>
    );
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-warning/25 bg-warning-bg p-4 shadow-sm transition hover:brightness-105 dark:bg-warning/10"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Inbox size={18} className="text-warning-text dark:text-warning" />
          Solicitudes de socios
          {loading ? (
            <span className="text-xs font-normal text-text-secondary">
              cargando…
            </span>
          ) : (
            <span className="rounded-full bg-warning-text px-2 py-0.5 text-xs font-bold text-white dark:bg-warning dark:text-black">
              {requests.length}
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp size={18} className="text-text-secondary" />
        ) : (
          <ChevronDown size={18} className="text-text-secondary" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {requests.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
              No hay solicitudes pendientes.
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <MemberIdentity identity={req.member_identity} />
                  <div className="flex items-center gap-2">
                    {typeBadge(req.request_type)}
                    <span className="text-xs text-text-secondary">
                      {formatHumanDate(req.requested_at)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">
                      {req.outing_name || "Salida"}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {DAY_NAMES[req.day] || req.day} ·{" "}
                      {String(req.start_time).slice(0, 5)}–
                      {String(req.end_time).slice(0, 5)}
                      {req.trainer_name ? ` · ${req.trainer_name}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      setApprovalTarget({
                        ...req,
                        notes: "",
                      })
                    }
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-success-bg py-2 text-sm font-medium text-success-text transition hover:brightness-95 dark:bg-success/15 dark:text-success dark:hover:bg-success/30"
                  >
                    <Check size={16} />
                    Aprobar
                  </button>
                  <button
                    onClick={() => {
                      setRejectionTarget(req);
                      setRejectionNotes("");
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger-bg py-2 text-sm font-medium text-danger-text transition hover:brightness-95 dark:bg-danger/15 dark:text-danger dark:hover:bg-danger/30"
                  >
                    <X size={16} />
                    Rechazar
                  </button>
                </div>

                {req.admin_notes && (
                  <div className="mt-2 rounded-xl bg-surface-input px-3 py-2">
                    <p className="text-xs text-text-secondary">Notas:</p>
                    <p className="text-sm text-text-secondary">
                      {req.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {approvalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface-modal p-4 shadow-2xl sm:p-6">
            <div className="mb-4">
              <h2 className="break-words text-base font-semibold text-text-primary sm:text-lg">
                Aprobar {approvalTarget.request_type === "enroll" ? "inscripción" : "baja"}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {approvalTarget.member_name} · {approvalTarget.outing_name} ·{" "}
                {DAY_NAMES[approvalTarget.day]} {String(approvalTarget.start_time).slice(0, 5)}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">
                Notas (opcional)
              </label>
              <textarea
                value={approvalTarget.notes || ""}
                onChange={(e) =>
                  setApprovalTarget((t) => ({ ...t, notes: e.target.value }))
                }
                placeholder="Comentario para el socio..."
                rows={3}
                className="w-full rounded-xl border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setApprovalTarget(null)}
                disabled={acting}
                className="rounded-xl border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-input disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={acting}
                className="rounded-xl bg-success px-4 py-2 text-sm font-medium text-white transition hover:brightness-90 disabled:opacity-50"
              >
                {acting ? "Aprobando…" : "Aprobar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface-modal p-4 shadow-2xl sm:p-6">
            <div className="mb-4">
              <h2 className="break-words text-base font-semibold text-text-primary sm:text-lg">
                Rechazar {rejectionTarget.request_type === "enroll" ? "inscripción" : "baja"}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {rejectionTarget.member_name} · {rejectionTarget.outing_name}
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
                disabled={acting}
                className="rounded-xl border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-input disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRejection}
                disabled={acting}
                className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white transition hover:brightness-90 disabled:opacity-50"
              >
                {acting ? "Rechazando…" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OutingEnrollmentRequests;