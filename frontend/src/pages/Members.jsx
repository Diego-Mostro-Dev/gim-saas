import { useEffect, useState, useRef } from "react";

import { Search, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import MemberCard from "../components/members/MemberCard";
import MemberForm from "../components/members/MemberForm";

import ConfirmModal from "../components/ui/ConfirmModal";

import { useMembers } from "../hooks/useMembers";
import { useMemberForm } from "../hooks/useMemberForm";
import { useFilteredMembers } from "../hooks/useFilteredMembers";

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
      <div className="mb-6 flex items-center justify-between">
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
    </div>
  );
}

export default Members;
