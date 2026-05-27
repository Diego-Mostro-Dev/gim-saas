import { useEffect, useState } from "react";

import { Search, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import BottomNav from "../components/dashboard/BottomNav";
import MemberCard from "../components/members/MemberCard";
import MemberForm from "../components/members/MemberForm";

import toast from "react-hot-toast";

import {
  getMembers,
  createMember,
  deleteMember,
  updateMember,
} from "../services/members.service";

function Members() {
  const [members, setMembers] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
  });

  // Cargar miembros
  useEffect(() => {
    async function loadMembers() {
      try {
        const data = await getMembers();

        setMembers(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadMembers();
  }, []);

  // Abrir form desde query param (?create=true)
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const shouldOpenForm = params.get("create");

    if (shouldOpenForm === "true") {
      setShowForm(true);

      // limpiar URL sin generar loops
      navigate("/members", { replace: true });
    }
  }, [location.search, navigate]);

  // CREATE / UPDATE
  async function handleCreateMember(e) {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (editingMember) {
        const updatedMember = await updateMember(editingMember.id, formData);

        setMembers((prev) =>
          prev.map((m) => (m.id === updatedMember.id ? updatedMember : m)),
        );

        toast.success("Miembro actualizado correctamente");
      } else {
        const newMember = await createMember(formData);

        setMembers((prev) => [newMember, ...prev]);

        toast.success("Miembro creado correctamente");
      }

      setFormData({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
      });

      setEditingMember(null);

      setShowForm(false);
    } catch (error) {
      console.error(error);

      toast.error("Ocurrió un error");
    } finally {
      setIsSubmitting(false);
    }
  }

  // DELETE
  async function handleDeleteMember(id) {
    const confirmed = window.confirm("¿Eliminar miembro?");

    if (!confirmed) return;

    try {
      await deleteMember(id);

      setMembers((prev) => prev.filter((m) => m.id !== id));

      toast.success("Miembro eliminado");
    } catch (error) {
      console.error(error);

      toast.error("No se pudo eliminar el miembro");
    }
  }

  // EDIT
  function handleEditMember(member) {
    setEditingMember(member);

    setFormData({
      first_name: member.first_name,
      last_name: member.last_name,
      phone: member.phone,
      email: member.email,
    });

    setShowForm(true);
  }

  // CLOSE FORM
  function handleCloseForm() {
    setShowForm(false);

    setEditingMember(null);

    setFormData({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
    });
  }

  const filteredMembers = members.filter((member) =>
    `${member.first_name} ${member.last_name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

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
          onClick={() => (showForm ? handleCloseForm() : setShowForm(true))}
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus size={18} />
          Nuevo
        </button>
      </div>

      {/* SEARCH */}
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3">
        <Search size={18} className="text-zinc-400" />

        <input
          type="text"
          placeholder="Buscar miembro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </div>

      {/* FORM */}
      {showForm && (
        <MemberForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreateMember}
          editingMember={editingMember}
          isSubmitting={isSubmitting}
        />
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
              onEdit={handleEditMember}
              onDelete={handleDeleteMember}
            />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default Members;
