import { useEffect, useMemo, useState, useRef } from "react";

import { Search, Plus, DollarSign, LayoutGrid, Table, Download, Pencil, X, Info, CheckCircle2, Paperclip } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import MemberCard from "../components/members/MemberCard";
import MemberForm from "../components/members/MemberForm";

import ConfirmModal from "../components/ui/ConfirmModal";

import RecoveryCard from "../components/recoveries/RecoveryCard";

import { useMembers } from "../hooks/useMembers";
import { useMemberForm } from "../hooks/useMemberForm";
import { useFilteredMembers } from "../hooks/useFilteredMembers";
import { useFeature } from "../features/FeatureProvider";
import { useGym } from "../hooks/useGym";
import { txt } from "../utils/labels";
import { getMemberWhatsapp } from "../services/routines.service";
import { getSlots } from "../services/attendance.service";
import { formatHumanDate, formatLongDate } from "../utils/date.utils";
import { getPlans } from "../services/plans.service";
import { getHealthInsurances } from "../services/healthInsurance.service";
import { getDiscounts } from "../services/discounts.service";
import {
  getRecoveries,
  grantRecovery,
  getRecoveryOptions,
  undoRecovery,
} from "../services/recoveries.service";

import {
  getMemberPayments,
  getMemberActivities,
} from "../services/members.service";
import {
  getMemberAttachments,
  reviewMemberAttachment,
} from "../services/attachments.service";
import { getCached, isCacheFresh } from "../utils/cache";

const RECOVERY_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "scheduled", label: "Programadas" },
  { key: "used", label: "Usadas" },
  { key: "expired", label: "Vencidas" },
  { key: "cancelled", label: "Canceladas" },
];

function Members() {
  const { gym } = useGym();
  const { members, loading, refreshing, error, createNewMember, editMember, removeMember } =
    useMembers();

  const {
    showForm,
    formData,
    editingMember,
    setFormData,
    openCreateForm,
    openEditForm,
    closeForm,
    resetForm,
  } = useMemberForm();

  const location = useLocation();

  const navigate = useNavigate();

  const formRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const [viewMode, setViewMode] = useState("cards");

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const dayLabels = {
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mié",
    thursday: "Jue",
    friday: "Vie",
    saturday: "Sáb",
    sunday: "Dom",
  };

  function handleExportCsv() {
    const header = [
      "Nombre",
      "Teléfono",
      "Email",
      "Documento",
      "Fecha de nacimiento",
      "Obra social",
      "Nº afiliado",
      "Plan",
      "Horarios",
    ];

    const rows = filteredMembers.map((member) => {
      const schedules = (member.schedules || [])
        .map((s) => `${dayLabels[s.day]} ${s.hour}`)
        .join(", ");

      return [
        `${member.first_name} ${member.last_name}`,
        member.phone || "",
        member.email || "",
        member.document_number || "",
        member.date_of_birth || "",
        member.health_insurance || "",
        member.affiliate_number || "",
        member.plan_name || "",
        schedules,
      ];
    });

    const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;

    const csv = [header, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "miembros.csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    toast.success("Listado exportado a CSV");
  }

  const [memberToDelete, setMemberToDelete] = useState(null);

  const { filteredMembers } = useFilteredMembers({
    members,
    searchTerm,
  });

  const [showPaymentsModal, setShowPaymentsModal] = useState(false);

  const [memberPayments, setMemberPayments] = useState([]);

  const [paymentsMemberName, setPaymentsMemberName] = useState("");

  const [paymentsMemberId, setPaymentsMemberId] = useState(null);

  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const [recoveryMemberId, setRecoveryMemberId] = useState(null);

  const [recoveryMemberName, setRecoveryMemberName] = useState("");

  const [recoveries, setRecoveries] = useState([]);

  const [recoveryStatus, setRecoveryStatus] = useState("idle");

  const [grantForm, setGrantForm] = useState({
    kind: "training",
    activity: "",
    note: "",
    date: "",
    selectedOption: "",
  });

  const [granting, setGranting] = useState(false);

  const [grantActivities, setGrantActivities] = useState([]);

  const [grantOptions, setGrantOptions] = useState([]);

  const [grantOptionsStatus, setGrantOptionsStatus] = useState("idle");

  const [recoveryFilter, setRecoveryFilter] = useState("all");

  const [undoRecoveryTarget, setUndoRecoveryTarget] = useState(null);

  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);

  const [attachmentsMemberName, setAttachmentsMemberName] = useState("");

  const [attachmentsList, setAttachmentsList] = useState([]);

  const [attachmentsStatus, setAttachmentsStatus] = useState("idle");

  const [reviewingAttachmentId, setReviewingAttachmentId] = useState(null);

  const [attachmentLightbox, setAttachmentLightbox] = useState(null);

  const activitiesEnabled = useFeature("activities");

  const [availablePlans, setAvailablePlans] = useState(() => getCached("plans") || []);
  const [loadingPlans, setLoadingPlans] = useState(() => !isCacheFresh("plans", 30 * 60 * 1000));

  const [availableSlots, setAvailableSlots] = useState(() => getCached("slots") || []);
  const [loadingSlots, setLoadingSlots] = useState(() => !isCacheFresh("slots", 10 * 60 * 1000));

  const [availableActivities, setAvailableActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [availableInsurances, setAvailableInsurances] = useState([]);

  const [availableDiscounts, setAvailableDiscounts] = useState([]);

  useEffect(() => {
    let active = true;
    getHealthInsurances()
      .then((data) => {
        if (active) setAvailableInsurances(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getDiscounts()
      .then((data) => {
        if (active) setAvailableDiscounts(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    async function load() {
      if (isCacheFresh("plans", 30 * 60 * 1000)) {
        setAvailablePlans(getCached("plans"));
        setLoadingPlans(false);
        return;
      }
      try {
        setLoadingPlans(true);
        const data = await getPlans();
        setAvailablePlans(data);
      } catch {
        toast.error("Error al cargar planes disponibles");
      } finally {
        setLoadingPlans(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function load() {
      if (isCacheFresh("slots", 10 * 60 * 1000)) {
        setAvailableSlots(getCached("slots"));
        setLoadingSlots(false);
        try {
          const data = await getSlots();
          setAvailableSlots(data);
        } catch {}
        return;
      }
      try {
        setLoadingSlots(true);
        const data = await getSlots();
        setAvailableSlots(data);
      } catch {
        toast.error("Error al cargar horarios disponibles");
      } finally {
        setLoadingSlots(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!activitiesEnabled || !showForm || editingMember) return;

    async function load() {
      try {
        setLoadingActivities(true);
        const data = await getMemberActivities();
        setAvailableActivities(data);
      } catch {
        setAvailableActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    }
    load();
  }, [activitiesEnabled, showForm, editingMember]);

  // Abrir form desde query param (?create=true)
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const shouldOpenForm = params.get("create");

    if (shouldOpenForm === "true") {
      openCreateForm();

      navigate("/members", {
        replace: true,
      });
    }
  }, [location.search, navigate, openCreateForm]);

  useEffect(() => {
    if (showForm && editingMember && formRef.current) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showForm, editingMember]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (editingMember) {
        await editMember(editingMember.id, formData);

        toast.success("Miembro actualizado correctamente");
      } else {
        await createNewMember(formData);

        toast.success("Miembro creado correctamente");
      }

      resetForm();

      closeForm();
    } catch (error) {
      console.error(error);

      const msg = error?.message || "Ocurrió un error al guardar el miembro";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenDeleteModal(id) {
    setMemberToDelete(id);

    setShowDeleteModal(true);
  }

  async function handleDeleteMember() {
    try {
      await removeMember(memberToDelete);

      toast.success("Miembro eliminado");
    } catch (error) {
      console.error(error);

      toast.error("No se pudo eliminar el miembro");
    }
  }

  async function handleViewPayments(member) {
    try {
      const data = await getMemberPayments(member.id);

      setMemberPayments(data);

      setPaymentsMemberName(`${member.first_name} ${member.last_name}`);

      setPaymentsMemberId(member.id);

      setShowPaymentsModal(true);
    } catch (error) {
      console.error(error);

      toast.error("No se pudo cargar el historial");
    }
  }

  async function handleViewRecoveries(member) {
    setRecoveryMemberId(member.id);

    setRecoveryMemberName(`${member.first_name} ${member.last_name}`);

    setGrantForm({
      kind: "training",
      activity: "",
      note: "",
      date: "",
      selectedOption: "",
    });

    setGrantOptions([]);

    setGrantOptionsStatus("idle");

    setShowRecoveryModal(true);

    setRecoveryFilter("all");

    setRecoveryStatus("loading");

    try {
      const data = await getRecoveries({ member: member.id });

      setRecoveries(data);

      setRecoveryStatus("success");
    } catch (error) {
      console.error(error);

      setRecoveryStatus("error");

      toast.error("No se pudo cargar las recuperaciones");
    }

    if (activitiesEnabled) {
      try {
        const activities = await getMemberActivities(member.id);

        setGrantActivities(activities);
      } catch {
        setGrantActivities([]);
      }
    }
  }

  async function handleViewAttachments(member) {
    setAttachmentsMemberName(`${member.first_name} ${member.last_name}`);

    setAttachmentsStatus("loading");

    setShowAttachmentsModal(true);

    try {
      const data = await getMemberAttachments(member.id);

      setAttachmentsList(data);

      setAttachmentsStatus("success");
    } catch (error) {
      console.error(error);

      setAttachmentsStatus("error");

      toast.error("No se pudieron cargar los adjuntos");
    }
  }

  async function handleToggleReview(attachment, reviewed) {
    try {
      setReviewingAttachmentId(attachment.id);

      const updated = await reviewMemberAttachment(attachment.id, reviewed);

      setAttachmentsList((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
    } catch (error) {
      console.error(error);

      toast.error("No se pudo actualizar el estado");
    } finally {
      setReviewingAttachmentId(null);
    }
  }

  async function loadGrantOptionsFor(kind, activity, date) {
    if (!recoveryMemberId || !date) return;

    if (kind === "activity" && !activity) return;

    setGrantOptionsStatus("loading");

    setGrantForm((prev) => ({ ...prev, selectedOption: "" }));

    try {
      const options = await getRecoveryOptions(
        recoveryMemberId,
        kind,
        activity || null,
        date,
      );

      setGrantOptions(options);

      setGrantOptionsStatus("success");
    } catch (error) {
      setGrantOptions([]);

      setGrantOptionsStatus("success");

      toast.error(error.message || "No hay horarios disponibles para esa fecha");
    }
  }

  function handleGrantFormChange(e) {
    const { name, value } = e.target;

    setGrantForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "kind" || name === "activity"
        ? { date: "", selectedOption: "" }
        : {}),
    }));

    setGrantOptions([]);

    setGrantOptionsStatus("idle");
  }

  function handleGrantDateChange(e) {
    const date = e.target.value;

    setGrantForm((prev) => ({ ...prev, date, selectedOption: "" }));

    setGrantOptions([]);

    setGrantOptionsStatus("idle");

    if (date) {
      loadGrantOptionsFor(grantForm.kind, grantForm.activity, date);
    }
  }

  async function handleGrantRecovery(e) {
    e.preventDefault();

    if (granting || !recoveryMemberId) return;

    if (grantForm.kind === "activity" && !grantForm.activity) {
      toast.error("Elegí la actividad a recuperar");

      return;
    }

    if (!grantForm.date) {
      toast.error("Elegí el día en que el socio recupera la clase");

      return;
    }

    if (!grantForm.selectedOption) {
      toast.error("Elegí el horario de la recuperación");

      return;
    }

    setGranting(true);

    try {
      const data = {
        member: recoveryMemberId,
        kind: grantForm.kind,
        date: grantForm.date,
      };

      if (grantForm.kind === "activity") {
        data.activity = Number(grantForm.activity);
      }

      const [optionType, optionId] = grantForm.selectedOption.split(":");

      if (optionType === "slot") {
        data.slot_id = Number(optionId);
      } else {
        data.schedule_id = Number(optionId);
      }

      if (grantForm.note.trim()) {
        data.note = grantForm.note.trim();
      }

      const created = await grantRecovery(data);

      setRecoveries((prev) => [created, ...prev]);

      setGrantForm({
        kind: "training",
        activity: "",
        note: "",
        date: "",
        selectedOption: "",
      });

      setGrantOptions([]);

      setGrantOptionsStatus("idle");

      toast.success("Recuperación programada");
    } catch (error) {
      toast.error(error.message || "No se pudo otorgar la recuperación");
    } finally {
      setGranting(false);
    }
  }

  async function handleUndoRecovery(recoveryId) {
    try {
      const updated = await undoRecovery(recoveryId);

      setRecoveries((prev) => prev.map((r) => (r.id === recoveryId ? updated : r)));

      toast.success("Recuperación deshecha");
    } catch (error) {
      toast.error(error.message || "No se pudo deshacer la recuperación");
    }
  }

  async function handleSharePortal(memberId) {
    try {
      const data = await getMemberWhatsapp(memberId);

      const phone = data.phone.replace(/\D/g, "");

      const url = `https://wa.me/54${phone}?text=${encodeURIComponent(
        data.message,
      )}`;

      window.open(url, "_blank");
    } catch {
      toast.error("El socio no tiene una rutina activa");
    }
  }

  async function handleCopyPortalLink(memberId) {
    try {
      const data = await getMemberWhatsapp(memberId);

      const urlMatch = data.message.match(/https?:\/\/[^\s]+/);

      if (urlMatch) {
        await navigator.clipboard.writeText(urlMatch[0]);

        toast.success("Link copiado al portapapeles");
      }
    } catch {
      toast.error("El socio no tiene una rutina activa");
    }
  }

  const grantedThisMonth = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return recoveries.filter(
      (r) => r.created_at && r.created_at.startsWith(monthKey),
    ).length;
  }, [recoveries]);

  const maxSessionRecoveries = gym?.max_session_recoveries_per_month;

  const recoveriesLimitReached =
    typeof maxSessionRecoveries === "number" &&
    grantedThisMonth >= maxSessionRecoveries;

  const filteredRecoveries = useMemo(
    () =>
      recoveryFilter === "all"
        ? recoveries
        : recoveries.filter((r) => r.status === recoveryFilter),
    [recoveries, recoveryFilter],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando miembros...
      </div>
    );
  }

  const selectedGrantOptionLabel = (() => {
    if (!grantForm.selectedOption) return null;

    const option = grantOptions.find(
      (o) => `${o.type}:${o.slot_id || o.schedule_id}` === grantForm.selectedOption,
    );
    if (!option) return null;

    return option.type === "slot"
      ? option.hour
      : `${option.start_time}–${option.end_time}`;
  })();

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* HEADER */}
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Miembros</h1>

          <p className="mt-1 text-sm text-text-secondary">
            {txt(gym, "staff.members.title")}
            {refreshing && (
              <span className="ml-2 text-xs text-blue-400">Actualizando...</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-xl bg-surface-elevated px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-input"
          >
            <Download size={16} />
            Exportar CSV
          </button>

          <div className="flex items-center rounded-xl border border-border bg-surface-elevated p-1">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "cards"
                  ? "bg-blue-500 text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <LayoutGrid size={15} />
              Tarjetas
            </button>

            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "table"
                  ? "bg-blue-500 text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Table size={15} />
              Directorio
            </button>
          </div>

          <button
            onClick={() => {
              if (showForm) {
                closeForm();
              } else {
                openCreateForm();
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            <Plus size={18} />
            {showForm ? "Cerrar" : "Nuevo"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      {/* SEARCH */}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3">
        <Search size={18} className="text-text-secondary" />

        <input
          type="text"
          placeholder="Buscar miembro..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
        />
      </div>

      {/* FORM */}
      {showForm && !loadingSlots && availableSlots.length === 0 && !editingMember && !activitiesEnabled && (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center">
          <p className="text-sm text-text-primary">
            No hay horarios configurados.
          </p>
          <p className="text-sm text-text-secondary">
            Configuralos desde Configuración → Horarios disponibles.
          </p>
        </div>
      )}

      {showForm && (editingMember || availableSlots.length > 0 || activitiesEnabled) && (
        <div ref={formRef}>
          <MemberForm
            gym={gym}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            editingMember={editingMember}
            isSubmitting={isSubmitting}
            availableSlots={availableSlots}
            loadingSlots={loadingSlots}
            availablePlans={availablePlans}
            loadingPlans={loadingPlans}
            availableActivities={availableActivities}
            loadingActivities={loadingActivities}
            activitiesAvailable={activitiesEnabled}
            availableInsurances={availableInsurances}
            availableDiscounts={availableDiscounts}
          />
        </div>
      )}

      {/* LIST */}
      {filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
          No se encontraron miembros
        </div>
      ) : viewMode === "cards" ? (
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={openEditForm}
              onDelete={handleOpenDeleteModal}
              onSharePortal={handleSharePortal}
              onCopyPortalLink={handleCopyPortalLink}
              onViewPayments={handleViewPayments}
              onViewRecoveries={handleViewRecoveries}
              onViewAttachments={handleViewAttachments}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-text-secondary">
                <th className="px-4 py-3 font-medium">Miembro</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Nacimiento</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-border last:border-0 hover:bg-surface-input/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-input font-bold text-info-text dark:text-info">
                        {member.photo ? (
                          <img
                            src={member.photo}
                            alt={`${member.first_name} ${member.last_name}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <>
                            {member.first_name[0]}
                            {member.last_name[0]}
                          </>
                        )}
                      </div>
                      <span className="font-medium text-text-primary">
                        {member.first_name} {member.last_name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-text-secondary">{member.phone || "—"}</td>

                  <td className="px-4 py-3 text-text-secondary">{member.document_number || "—"}</td>

                  <td className="px-4 py-3 text-text-secondary">{member.date_of_birth || "—"}</td>

                  <td className="px-4 py-3 text-text-secondary">{member.email || "—"}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {member.plan_name ? (
                        <span className="rounded-md bg-success-bg dark:bg-success/15 px-2 py-0.5 text-xs text-success-text dark:text-success">
                          {member.plan_name}
                        </span>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                      {member.discount_percent > 0 && (
                        <span className="rounded-md bg-info-bg dark:bg-info/15 px-2 py-0.5 text-xs font-medium text-info-text dark:text-info">
                          -{member.discount_percent}%
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewPayments(member)}
                        className="rounded-lg bg-info-bg dark:bg-info/15 p-2 text-info-text dark:text-info transition hover:bg-info/30"
                        title="Historial de pagos"
                      >
                        Historial
                      </button>

                      <button
                        onClick={() => handleViewAttachments(member)}
                        className="rounded-lg bg-info-bg dark:bg-info/15 p-2 text-info-text dark:text-info transition hover:bg-info/30"
                        title="Adjuntos"
                      >
                        <span className="flex items-center gap-1">
                          <Paperclip size={16} />
                          {member.pending_attachments_count > 0 && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-text dark:text-warning">
                              {member.pending_attachments_count}
                            </span>
                          )}
                        </span>
                      </button>

                      <button
                        onClick={() => openEditForm(member)}
                        className="rounded-lg bg-info-bg dark:bg-info/15 p-2 text-info-text dark:text-info transition hover:bg-info/30"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Eliminar miembro"
        message="Esta acción no se puede deshacer"
        confirmText="Eliminar"
        cancelText="Cancelar"
        onClose={() => {
          setShowDeleteModal(false);

          setMemberToDelete(null);
        }}
        onConfirm={async () => {
          await handleDeleteMember();

          setShowDeleteModal(false);

          setMemberToDelete(null);
        }}
      />

      <ConfirmModal
        isOpen={Boolean(undoRecoveryTarget)}
        title="Deshacer recuperación"
        message="Se borra la asistencia registrada y la recuperación queda cancelada."
        confirmText="Deshacer"
        cancelText="Cancelar"
        onClose={() => setUndoRecoveryTarget(null)}
        onConfirm={() => {
          const recoveryId = undoRecoveryTarget?.id;

          setUndoRecoveryTarget(null);

          if (recoveryId) handleUndoRecovery(recoveryId);
        }}
      />

      {showAttachmentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-surface-elevated p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  Adjuntos de {attachmentsMemberName}
                </h2>

                <p className="text-sm text-text-secondary">
                  Órdenes, comprobantes y estudios enviados por el socio.
                </p>
              </div>

              <button
                onClick={() => setShowAttachmentsModal(false)}
                className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-input"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="-mx-2 flex-1 space-y-2 overflow-y-auto px-2">
              {attachmentsStatus === "loading" ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  Cargando...
                </p>
              ) : attachmentsStatus === "error" ? (
                <p className="py-6 text-center text-sm text-danger-text dark:text-danger">
                  No se pudieron cargar los adjuntos.
                </p>
              ) : attachmentsList.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  No hay adjuntos cargados por este socio.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {attachmentsList.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex gap-3 rounded-xl bg-surface-input p-3"
                    >
                      <button
                        onClick={() => setAttachmentLightbox(attachment.url)}
                        className="shrink-0"
                      >
                        <img
                          src={attachment.url}
                          alt={attachment.category_label}
                          className="h-20 w-20 rounded-lg border border-border object-cover"
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {attachment.category_label}
                        </p>

                        {attachment.note && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
                            {attachment.note}
                          </p>
                        )}

                        <p className="mt-1 text-[11px] text-text-secondary">
                          {formatHumanDate(attachment.created_at)}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              attachment.reviewed
                                ? "bg-success/15 text-success-text dark:text-success"
                                : "bg-warning/15 text-warning-text dark:text-warning"
                            }`}
                          >
                            {attachment.reviewed ? "Revisado" : "Pendiente"}
                          </span>

                          <button
                            onClick={() =>
                              handleToggleReview(
                                attachment,
                                !attachment.reviewed,
                              )
                            }
                            disabled={reviewingAttachmentId === attachment.id}
                            className="rounded-lg bg-surface-elevated px-2 py-1 text-[11px] font-medium text-info-text dark:text-info transition hover:bg-info/20 disabled:opacity-50"
                          >
                            {reviewingAttachmentId === attachment.id
                              ? "Guardando..."
                              : attachment.reviewed
                                ? "Desmarcar"
                                : "Marcar revisado"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex shrink-0 gap-3">
              <button
                onClick={() => setShowAttachmentsModal(false)}
                className="flex-1 rounded-xl bg-surface-input py-2 text-sm font-medium text-text-primary transition hover:bg-surface-elevated"
              >
                Cerrar
              </button>
            </div>
          </div>

{attachmentLightbox && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
                onClick={() => setAttachmentLightbox(null)}
              >
              <div className="relative">
                <img
                  src={attachmentLightbox}
                  alt="Adjunto"
                  className="max-h-[85vh] max-w-full rounded-2xl object-contain"
                />

                <button
                  onClick={() => setAttachmentLightbox(null)}
                  className="absolute -top-3 -right-3 rounded-full bg-surface-elevated p-2 text-text-primary shadow transition hover:bg-surface-input"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showPaymentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-surface-elevated p-6">
            <h2 className="mb-4 text-xl font-bold text-text-primary">
              Pagos de {paymentsMemberName}
            </h2>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {memberPayments.length === 0 ? (
                <p className="text-text-secondary">No hay pagos registrados</p>
              ) : (
                memberPayments.map((payment) => (
                  <div key={payment.id} className="rounded-xl bg-surface-input p-3">
                    <p>Plan: {payment.plan_name}</p>

                    <p>
                      Monto: ${Number(payment.amount).toLocaleString("es-AR")}
                    </p>

                    <p>
                      Fecha: {formatHumanDate(payment.paid_at)}
                    </p>

                    <p>Vencimiento: {formatHumanDate(payment.subscription_end_date)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowPaymentsModal(false)}
                className="flex-1 rounded-xl bg-surface-input py-2 text-sm font-medium text-text-primary transition hover:bg-surface-elevated"
              >
                Cerrar
              </button>

              <button
                onClick={() => {
                  setShowPaymentsModal(false);

                  navigate("/payments", {
                    state: {
                      prefillMemberId: paymentsMemberId,
                    },
                  });
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
              >
                <DollarSign size={16} />

                Registrar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-surface-elevated p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  Recuperaciones de {recoveryMemberName}
                </h2>

                <p className="mt-1 text-xs text-text-secondary">
                  La recuperación es la asistencia del día: elegí qué clase
                  recupera, el día y el horario. No consume paquete ni cuota
                  semanal.
                </p>
              </div>

              <button
                onClick={() => setShowRecoveryModal(false)}
                className="shrink-0 text-text-secondary transition hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">

            <form
              onSubmit={handleGrantRecovery}
              className="mb-6 rounded-xl border border-border bg-surface-input p-3"
            >
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Otorgar recuperación
              </h3>

              {typeof maxSessionRecoveries === "number" && (
                <div
                  className={`mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                    recoveriesLimitReached
                      ? "bg-danger/10 text-danger-text dark:text-danger"
                      : "bg-info-bg dark:bg-info/15 text-info-text dark:text-info"
                  }`}
                >
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {maxSessionRecoveries === 0
                      ? "Las recuperaciones están deshabilitadas este mes."
                      : `${grantedThisMonth} de ${maxSessionRecoveries} recuperaciones usadas este mes.`}
                    {maxSessionRecoveries > 0 &&
                      recoveriesLimitReached &&
                      " Ya se alcanzó el límite."}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-text-primary">
                    Qué recupera
                  </label>
                  <select
                    value={grantForm.kind}
                    name="kind"
                    onChange={handleGrantFormChange}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none"
                  >
                    <option value="training">{txt(gym, "recovery.kind.training")}</option>
                    {activitiesEnabled && <option value="activity">{txt(gym, "recovery.kind.activity")}</option>}
                  </select>
                </div>

                {grantForm.kind === "activity" && (
                  <div>
                    <label className="mb-1 block text-xs text-text-primary">
                      Actividad
                    </label>
                    <select
                      value={grantForm.activity}
                      name="activity"
                      onChange={handleGrantFormChange}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {grantActivities.map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] leading-snug text-text-secondary">
                      La recuperación reemplaza la asistencia del socio ese día.
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs text-text-primary">
                    Día
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={grantForm.date}
                    onChange={handleGrantDateChange}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none"
                  />
                  <p className="mt-1 text-[11px] leading-snug text-text-secondary">
                    Es el día en que el socio recupera la clase. Si no asiste ese
                    día en ese horario, la recuperación vence.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-text-primary">
                    Horario
                  </label>
                  <select
                    key={`schedule-${grantOptionsStatus}-${grantForm.date}`}
                    value={grantForm.selectedOption}
                    name="selectedOption"
                    onChange={handleGrantFormChange}
                    disabled={!grantForm.date}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none disabled:opacity-50"
                  >
                    <option value="">
                      {grantForm.date
                        ? grantOptionsStatus === "loading"
                          ? "Cargando horarios..."
                          : "Seleccionar..."
                        : "Elegí primero el día"}
                    </option>
                    {grantOptions.map((option) => {
                      const id =
                        option.type === "slot"
                          ? option.slot_id
                          : option.schedule_id;
                      const when =
                        option.type === "slot"
                          ? `${dayLabels[option.day]} ${option.hour}`
                          : `${option.start_time}–${option.end_time}`;
                      const cups =
                        option.available != null
                          ? `${option.available} cupo/s`
                          : "Sin límite";
                      return (
                        <option
                          key={`${option.type}-${id}`}
                          value={`${option.type}:${id}`}
                        >
                          {when} · {cups}
                          {option.is_own ? " · tu horario" : ""}
                        </option>
                      );
                    })}
                    {grantForm.date &&
                      grantOptionsStatus === "success" &&
                      grantOptions.length === 0 && (
                        <option value="" disabled>
                          No hay horarios para esa fecha
                        </option>
                      )}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-text-primary">
                    Nota (opcional)
                  </label>
                  <input
                    type="text"
                    value={grantForm.note}
                    name="note"
                    onChange={handleGrantFormChange}
                    placeholder="Ej: faltó el lunes por trabajo"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none"
                  />
                </div>
              </div>

              {grantForm.date && !granting && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface-elevated px-3 py-2 text-xs text-text-primary">
                  <CheckCircle2
                    size={14}
                    className="mt-0.5 shrink-0 text-success-text dark:text-success"
                  />
                  <span>
                    Se programará para el{" "}
                    <span className="font-medium">
                      {formatLongDate(grantForm.date)}
                    </span>
                    {selectedGrantOptionLabel ? (
                      <>
                        {" "}
                        a las{" "}
                        <span className="font-medium">
                          {selectedGrantOptionLabel}
                        </span>
                        .
                      </>
                    ) : (
                      ". Elegí el horario para confirmar."
                    )}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={granting || recoveriesLimitReached}
                className="mt-3 w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
              >
                {granting ? "Otorgando..." : "Programar y otorgar"}
              </button>
            </form>

            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Historial
            </h3>

            {recoveryStatus === "loading" ? (
              <p className="text-text-secondary">Cargando...</p>
            ) : recoveryStatus === "error" ? (
              <p className="text-danger-text dark:text-danger">
                No se pudo cargar el historial.
              </p>
            ) : recoveries.length === 0 ? (
              <p className="rounded-xl bg-surface-input px-4 py-3 text-sm text-text-secondary">
                No hay recuperaciones otorgadas.
              </p>
            ) : (
              <>
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {RECOVERY_FILTERS.map((f) => {
                    const count =
                      f.key === "all"
                        ? recoveries.length
                        : recoveries.filter((r) => r.status === f.key).length;

                    return (
                      <button
                        key={f.key}
                        onClick={() => setRecoveryFilter(f.key)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          recoveryFilter === f.key
                            ? "bg-info text-white"
                            : "bg-surface-elevated text-text-secondary hover:bg-surface-input"
                        }`}
                      >
                        {f.label}
                        {count > 0 && (
                          <span
                            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              recoveryFilter === f.key
                                ? "bg-white/20 text-white"
                                : "bg-surface-input text-text-secondary"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {filteredRecoveries.length === 0 ? (
                  <p className="rounded-xl bg-surface-input px-4 py-3 text-sm text-text-secondary">
                    No hay recuperaciones con ese estado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredRecoveries.map((recovery) => (
                      <RecoveryCard
                        key={recovery.id}
                        recovery={recovery}
                        showGrantedMeta
                        actions={
                          recovery.status === "used" ? (
                            <button
                              type="button"
                              onClick={() => setUndoRecoveryTarget(recovery)}
                              className="rounded-lg border border-danger/40 px-2.5 py-1 text-xs text-danger-text dark:text-danger transition hover:bg-danger/10"
                            >
                              Deshacer
                            </button>
                          ) : null
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            </div>

            <div className="mt-4 flex shrink-0 gap-3 border-t border-border pt-4">
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="flex-1 rounded-xl bg-surface-input py-2 text-sm font-medium text-text-primary transition hover:bg-surface-elevated"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Members;
