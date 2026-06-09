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

import {
  getMember,
  getMembers,
  createMember,
  deleteMember,
  updateMember,
  getMemberPayments,
} from "../services/members.service";

function Members() {
  const { members, loading, error, createNewMember, editMember, removeMember } =
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
      <div className="flex min-h-screen items-center justify-center bg-[#131313] text-white">
        Cargando miembros...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131313] px-4 pb-28 pt-6 text-white">
      {/* HEADER */}
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Miembros</h1>

          <p className="mt-1 text-sm text-zinc-400">
            Gestión de miembros del gimnasio
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
        <div className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* SEARCH */}
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3">
        <Search size={18} className="text-zinc-400" />

        <input
          type="text"
          placeholder="Buscar miembro..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </div>

      {/* FORM */}
      {showForm && (
        <div ref={formRef}>
          <MemberForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            editingMember={editingMember}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* LIST */}
      <div className="space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4 text-sm text-zinc-400">
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
          <div className="w-full max-w-2xl rounded-2xl bg-[#201f1f] p-6">
            <h2 className="mb-4 text-xl font-bold">
              Pagos de {paymentsMemberName}
            </h2>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {memberPayments.length === 0 ? (
                <p className="text-zinc-400">No hay pagos registrados</p>
              ) : (
                memberPayments.map((payment) => (
                  <div key={payment.id} className="rounded-xl bg-[#2a2a2a] p-3">
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
                className="flex-1 rounded-xl bg-zinc-700 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
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
