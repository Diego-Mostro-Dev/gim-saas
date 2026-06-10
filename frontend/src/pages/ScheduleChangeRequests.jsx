import { useEffect, useState } from "react";
import { Check, X, ArrowLeftRight } from "lucide-react";
import toast from "react-hot-toast";

import {
  getScheduleChangeRequests,
  approveScheduleChangeRequest,
  rejectScheduleChangeRequest,
} from "../services/attendance.service";
import { DAY_NAMES } from "../constants/days";

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
  const [filter, setFilter] = useState("all");

  const [approvalTarget, setApprovalTarget] = useState(null);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await getScheduleChangeRequests();
      setRequests(data);
    } catch {
      toast.error("Error al cargar solicitudes de cambio");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusBadge(status) {
    const base =
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
    const colors = {
      pending: "bg-yellow-500/20 text-yellow-300",
      approved: "bg-green-500/20 text-green-300",
      rejected: "bg-red-500/20 text-red-300",
      cancelled: "bg-zinc-500/20 text-zinc-400",
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
    try {
      await approveScheduleChangeRequest(approvalTarget.id);
      toast.success("Cambio de horario aprobado");
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
    try {
      const data = {};
      if (rejectionNotes.trim()) {
        data.admin_notes = rejectionNotes.trim();
      }
      await rejectScheduleChangeRequest(rejectionTarget.id, data);
      toast.success("Cambio de horario rechazado");
      setRejectionTarget(null);
      setRejectionNotes("");
      loadRequests();
    } catch (error) {
      toast.error(error.message || "Error al rechazar");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#131313] text-white">
        Cargando solicitudes...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131313] pb-28 pt-6 text-white">
      <div className="mb-6 px-4">
        <h1 className="text-3xl font-bold">Solicitudes de cambio</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Revisá y gestioná los cambios de horario solicitados por los socios.
        </p>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              filter === f.key
                ? "bg-blue-500 text-white"
                : "bg-[#201f1f] text-zinc-400 hover:bg-[#2a2a2a]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4">
        {filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4 text-sm text-zinc-400">
            {requests.length === 0
              ? "No hay solicitudes de cambio"
              : "No hay solicitudes con este estado"}
          </div>
        ) : (
          filteredRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border border-white/5 bg-[#201f1f] p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {req.member_name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Solicitado: {formatDate(req.requested_at)}
                  </p>
                  {req.effective_date && (
                    <p className="text-xs text-zinc-500">
                      Vigente desde: {formatDate(req.effective_date)}
                    </p>
                  )}
                </div>
                {statusBadge(req.status)}
              </div>

              <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#2a2a2a] px-3 py-2">
                <div className="flex-1 text-center">
                  <p className="text-xs text-zinc-500">Actual</p>
                  <p className="text-sm text-white">
                    {DAY_NAMES[req.current_day] || req.current_day} {req.current_hour}
                  </p>
                </div>
                <ArrowLeftRight size={16} className="shrink-0 text-zinc-500" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-zinc-500">Solicitado</p>
                  <p className="text-sm text-white">
                    {DAY_NAMES[req.requested_day] || req.requested_day} {req.requested_hour}
                  </p>
                </div>
              </div>

              {req.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenApproval(req)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-500/20 py-2 text-sm font-medium text-green-300 transition hover:bg-green-500/30"
                  >
                    <Check size={16} />
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleOpenRejection(req)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500/20 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/30"
                  >
                    <X size={16} />
                    Rechazar
                  </button>
                </div>
              )}

              {req.admin_notes && req.status !== "pending" && (
                <div className="mt-2 rounded-xl bg-[#2a2a2a] px-3 py-2">
                  <p className="text-xs text-zinc-500">Notas:</p>
                  <p className="text-sm text-zinc-300">{req.admin_notes}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Approval modal */}
      {approvalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1b1b1b] p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">
                Aprobar cambio de horario
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-zinc-400">Socio</p>
                <p className="text-white">{approvalTarget.member_name}</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-[#2a2a2a] px-3 py-2">
                <div className="flex-1 text-center">
                  <p className="text-xs text-zinc-500">Actual</p>
                  <p className="text-sm text-white">
                    {DAY_NAMES[approvalTarget.current_day] || approvalTarget.current_day} {approvalTarget.current_hour}
                  </p>
                </div>
                <ArrowLeftRight size={16} className="shrink-0 text-zinc-500" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-zinc-500">Nuevo</p>
                  <p className="text-sm text-green-300">
                    {DAY_NAMES[approvalTarget.requested_day] || approvalTarget.requested_day}{" "}
                    {approvalTarget.requested_hour}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setApprovalTarget(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmApproval}
                className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600"
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
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1b1b1b] p-6 shadow-2xl">
              {rejectionTarget.effective_date && (
                <div className="mt-3 rounded-xl bg-[#2a2a2a] px-3 py-2">
                  <p className="text-xs text-zinc-500">Vigente desde</p>
                  <p className="text-sm text-white">
                    {formatDate(rejectionTarget.effective_date)}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Rechazar cambio de horario
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {rejectionTarget.member_name}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Notas (opcional)
              </label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Motivo del rechazo..."
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectionTarget(null);
                  setRejectionNotes("");
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRejection}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
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