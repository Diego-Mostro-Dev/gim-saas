import { useEffect, useRef, useState } from "react";
import { Check, X, ArrowLeftRight, Search } from "lucide-react";
import toast from "react-hot-toast";

import {
  getScheduleSwapRequests,
  approveScheduleSwapRequest,
  rejectScheduleSwapRequest,
} from "../services/attendance.service";
import { getScheduleSwapsLastRefresh } from "../hooks/useScheduleSwapWatcher";
import { DAY_NAMES } from "../constants/days";
import { formatHumanDate } from "../utils/date.utils";
import MemberAvatar from "../components/common/MemberAvatar";

const STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

const STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "approved", label: "Aprobadas" },
  { key: "rejected", label: "Rechazadas" },
];

const TIME_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "today", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
];

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function isThisWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const sw = startOfWeek();
  const ew = new Date(sw);
  ew.setDate(sw.getDate() + 6);
  ew.setHours(23, 59, 59, 999);
  return d >= sw && d <= ew;
}

function isThisMonth(dateStr) {
  const now = new Date();
  const d = new Date(dateStr + "T12:00:00");
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function shortDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ScheduleSwapRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem("swap_status") || "all");
  const [timeFilter, setTimeFilter] = useState(() => sessionStorage.getItem("swap_time") || "all");
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem("swap_search") || "");

  const [approvalTarget, setApprovalTarget] = useState(null);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const lastFetchTimestamp = useRef(0);

  async function loadRequests(skipCooldown = false) {
    if (
      !skipCooldown &&
      Date.now() - Math.max(lastFetchTimestamp.current, getScheduleSwapsLastRefresh()) < 60000
    ) {
      setLoading(false);
      return;
    }
    lastFetchTimestamp.current = Date.now();

    try {
      setLoading(true);
      const data = await getScheduleSwapRequests();
      setRequests(data);
      window.dispatchEvent(
        new CustomEvent("schedule-swaps-refreshed", { detail: data }),
      );
    } catch {
      toast.error("Error al cargar solicitudes de intercambio");
    } finally {
      setLoading(false);
    }
  }

  function forceRefresh() {
    lastFetchTimestamp.current = 0;
    loadRequests(true);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    function onRefreshed(e) {
      setRequests(e.detail);
      setLoading(false);
    }
    window.addEventListener("schedule-swaps-refreshed", onRefreshed);
    return () => window.removeEventListener("schedule-swaps-refreshed", onRefreshed);
  }, []);

  useEffect(() => {
    if (approvalTarget) {
      const updated = requests.find((r) => r.id === approvalTarget.id);
      if (!updated || updated.status !== "pending") {
        setApprovalTarget(null);
        if (updated?.status === "approved") {
          toast.success("Intercambio aprobado por otro administrador.");
        } else if (updated?.status === "rejected") {
          toast.success("Intercambio rechazado por otro administrador.");
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
          toast.success("Intercambio aprobado por otro administrador.");
        } else if (updated?.status === "rejected") {
          toast.success("Intercambio rechazado por otro administrador.");
        } else {
          toast.success("La solicitud ya no está pendiente.");
        }
      }
    }
  }, [requests]);

  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    cancelled: requests.filter((r) => r.status === "cancelled").length,
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (timeFilter === "today" && !isToday(r.swap_date)) return false;
    if (timeFilter === "week" && !isThisWeek(r.swap_date)) return false;
    if (timeFilter === "month" && !isThisMonth(r.swap_date)) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nameMatch = r.member_name?.toLowerCase().includes(term);
      const destDay = DAY_NAMES[r.destination_day] || r.destination_day || "";
      const slotMatch = destDay.toLowerCase().includes(term);
      if (!nameMatch && !slotMatch) return false;
    }
    return true;
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
        toast.success("Intercambio aprobado por otro administrador.");
      } else if (updated?.status === "rejected") {
        toast.success("Intercambio rechazado por otro administrador.");
      } else {
        toast.success("La solicitud ya no está pendiente.");
      }
      return;
    }

    try {
      await approveScheduleSwapRequest(approvalTarget.id);
      toast.success("Intercambio aprobado");
      setApprovalTarget(null);
      forceRefresh();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
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
        toast.success("Intercambio aprobado por otro administrador.");
      } else if (updated?.status === "rejected") {
        toast.success("Intercambio rechazado por otro administrador.");
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
      await rejectScheduleSwapRequest(rejectionTarget.id, data);
      toast.success("Intercambio rechazado");
      setRejectionTarget(null);
      setRejectionNotes("");
      forceRefresh();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (error) {
      toast.error(error.message || "Error al rechazar");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando solicitudes de intercambio...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-28 pt-6 text-text-primary">
      <div className="mb-6 px-4">
        <h1 className="text-3xl font-bold">Intercambios por única vez</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Solicitudes de intercambio por única vez entre días disponibles.
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 px-4 sm:grid-cols-4">
        <div className="rounded-xl border border-warning/20 bg-warning-bg dark:bg-warning/5 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-warning-text dark:text-warning">{stats.pending}</p>
          <p className="text-xs text-text-secondary">Pendientes</p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success-bg dark:bg-success/5 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-success-text dark:text-success">{stats.approved}</p>
          <p className="text-xs text-text-secondary">Aprobadas</p>
        </div>
        <div className="rounded-xl border border-danger/20 bg-danger-bg dark:bg-danger/5 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-danger-text dark:text-danger">{stats.rejected}</p>
          <p className="text-xs text-text-secondary">Rechazadas</p>
        </div>
        <div className="rounded-xl border border-muted/20 bg-muted-bg p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-muted-text">{stats.cancelled}</p>
          <p className="text-xs text-text-secondary">Canceladas</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 px-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2">
          <Search size={16} className="shrink-0 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar por socio o destino..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              sessionStorage.setItem("swap_search", e.target.value);
            }}
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
          />
        </div>
      </div>

      {/* Status filters */}
      <div className="mb-3 flex gap-2 overflow-x-auto px-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setStatusFilter(f.key);
              sessionStorage.setItem("swap_status", f.key);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              statusFilter === f.key
                ? "bg-info text-white"
                : "bg-surface-elevated text-text-secondary hover:bg-surface-input"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Time filters */}
      <div className="mb-6 flex gap-2 overflow-x-auto px-4">
        {TIME_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setTimeFilter(f.key);
              sessionStorage.setItem("swap_time", f.key);
            }}
            className={`rounded-xl px-4 py-1.5 text-xs font-medium transition ${
              timeFilter === f.key
                ? "bg-surface-input text-text-primary"
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
              ? "No hay solicitudes de intercambio"
              : "No hay solicitudes con este filtro"}
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
                      Solicitado:{" "}
                      <span className="hidden sm:inline">{formatHumanDate(req.requested_at)}</span>
                      <span className="sm:hidden">{shortDate(req.requested_at)}</span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      Vigente:{" "}
                      <span className="hidden sm:inline">{formatHumanDate(req.swap_date)}</span>
                      <span className="sm:hidden">{shortDate(req.swap_date)}</span>
                    </p>
                  </div>
                </div>
                {statusBadge(req.status)}
              </div>

              <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface-input px-3 py-2">
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary">Origen</p>
                  <p className="text-sm text-text-primary">
                    {DAY_NAMES[req.origin_day] || req.origin_day} {req.origin_hour}
                  </p>
                </div>
                <ArrowLeftRight size={16} className="shrink-0 text-text-secondary" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary">Destino</p>
                  <p className="text-sm text-text-primary">
                    {DAY_NAMES[req.destination_day] || req.destination_day} {req.destination_hour}
                  </p>
                </div>
              </div>

              {req.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenApproval(req)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-success-bg dark:bg-success/15 py-2 text-sm font-medium text-success-text dark:text-success transition hover:bg-success/30"
                  >
                    <Check size={16} />
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleOpenRejection(req)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger-bg dark:bg-danger/15 py-2 text-sm font-medium text-danger-text dark:text-danger transition hover:bg-danger/30"
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
                Aprobar intercambio
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-text-secondary">Socio</p>
                <p className="text-text-primary">{approvalTarget.member_name}</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Fecha del intercambio</p>
                <p className="text-text-primary">{formatHumanDate(approvalTarget.swap_date)}</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-input px-3 py-2">
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary">Origen</p>
                  <p className="text-sm text-text-primary">
                    {DAY_NAMES[approvalTarget.origin_day] || approvalTarget.origin_day} {approvalTarget.origin_hour}
                  </p>
                </div>
                <ArrowLeftRight size={16} className="shrink-0 text-text-secondary" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary">Destino</p>
                    <p className="text-sm text-info-text dark:text-info">
                    {DAY_NAMES[approvalTarget.destination_day] || approvalTarget.destination_day}{" "}
                    {approvalTarget.destination_hour}
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
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Rechazar intercambio
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

export default ScheduleSwapRequests;
