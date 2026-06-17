import { useEffect, useState, useRef } from "react";

import { Search, Plus, DollarSign } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import MemberCard from "../components/members/MemberCard";
import MemberForm from "../components/members/MemberForm";

import ConfirmModal from "../components/ui/ConfirmModal";

import { useMembers } from "../hooks/useMembers";
import { useMemberForm } from "../hooks/useMemberForm";
import { useFilteredMembers } from "../hooks/useFilteredMembers";
import { getMemberWhatsapp } from "../services/routines.service";
import { getSlots } from "../services/attendance.service";
import { getPlans } from "../services/plans.service";

import {
  getMember,
  getMembers,
  createMember,
  deleteMember,
  updateMember,
  getMemberPayments,
} from "../services/members.service";
import { getCached, isCacheFresh } from "../utils/cache";

function Members() {
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

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [memberToDelete, setMemberToDelete] = useState(null);

  const { filteredMembers } = useFilteredMembers({
    members,
    searchTerm,
  });

  const [showPaymentsModal, setShowPaymentsModal] = useState(false);

  const [memberPayments, setMemberPayments] = useState([]);

  const [paymentsMemberName, setPaymentsMemberName] = useState("");

  const [paymentsMemberId, setPaymentsMemberId] = useState(null);

  const [availablePlans, setAvailablePlans] = useState(() => getCached("plans") || []);
  const [loadingPlans, setLoadingPlans] = useState(() => !isCacheFresh("plans", 10 * 60 * 1000));

  const [availableSlots, setAvailableSlots] = useState(() => getCached("slots") || []);
  const [loadingSlots, setLoadingSlots] = useState(() => !isCacheFresh("slots", 10 * 60 * 1000));

  useEffect(() => {
    async function load() {
      if (isCacheFresh("plans", 10 * 60 * 1000)) {
        setAvailablePlans(getCached("plans"));
        setLoadingPlans(false);
        try {
          const data = await getPlans();
          setAvailablePlans(data);
        } catch {}
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

      toast.error("Ocurrió un error");
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando miembros...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* HEADER */}
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Miembros</h1>

          <p className="mt-1 text-sm text-text-secondary">
            Gestión de miembros del gimnasio
            {refreshing && (
              <span className="ml-2 text-xs text-blue-400">Actualizando...</span>
            )}
          </p>
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
      {showForm && !loadingSlots && availableSlots.length === 0 && !editingMember && (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center">
          <p className="text-sm text-text-primary">
            No hay horarios configurados.
          </p>
          <p className="text-sm text-text-secondary">
            Configuralos desde Configuración → Horarios disponibles.
          </p>
        </div>
      )}

      {showForm && (editingMember || availableSlots.length > 0) && (
        <div ref={formRef}>
          <MemberForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            editingMember={editingMember}
            isSubmitting={isSubmitting}
            availableSlots={availableSlots}
            loadingSlots={loadingSlots}
            availablePlans={availablePlans}
            loadingPlans={loadingPlans}
          />
        </div>
      )}

      {/* LIST */}
      <div className="space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
            No se encontraron miembros
          </div>
        ) : (
          filteredMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={openEditForm}
              onDelete={handleOpenDeleteModal}
              onSharePortal={handleSharePortal}
              onCopyPortalLink={handleCopyPortalLink}
              onViewPayments={handleViewPayments}
            />
          ))
        )}
      </div>

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

      {showPaymentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
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
                      Fecha: {new Date(payment.paid_at).toLocaleDateString()}
                    </p>

                    <p>Vencimiento: {payment.subscription_end_date ?? "-"}</p>
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
    </div>
  );
}

export default Members;
