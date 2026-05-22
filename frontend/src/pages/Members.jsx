import { useEffect, useState } from "react";

import { Search, Plus } from "lucide-react";

import BottomNav from "../components/dashboard/BottomNav";

import {
  getMembers,
  createMember,
} from "../services/members.service";

function Members() {
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] =
  useState(false);

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
  });

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

  async function handleCreateMember(e) {
  e.preventDefault();

  if (isSubmitting) return;

  setIsSubmitting(true);

  try {
    const newMember =
      await createMember(formData);

    setMembers(prev => [
      newMember,
      ...prev,
    ]);

    setFormData({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
    });

    setShowForm(false);
  } catch (error) {
    console.error(error);
  } finally {
    setIsSubmitting(false);
  }
}

  const filteredMembers = members.filter(
    member =>
      `${member.first_name} ${member.last_name}`
        .toLowerCase()
        .includes(search.toLowerCase())
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Miembros
          </h1>

          <p className="mt-1 text-sm text-zinc-400">
            Gestión de miembros del gimnasio
          </p>
        </div>

        <button
          onClick={() =>
            setShowForm(prev => !prev)
          }
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus size={18} />
          Nuevo
        </button>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3">
        <Search
          size={18}
          className="text-zinc-400"
        />

        <input
          type="text"
          placeholder="Buscar miembro..."
          value={search}
          onChange={e =>
            setSearch(e.target.value)
          }
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateMember}
          className="mb-6 space-y-3 rounded-2xl border border-white/5 bg-[#201f1f] p-4"
        >
          <input
            type="text"
            placeholder="Nombre"
            value={formData.first_name}
            onChange={e =>
              setFormData({
                ...formData,
                first_name: e.target.value,
              })
            }
            className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
            required
          />

          <input
            type="text"
            placeholder="Apellido"
            value={formData.last_name}
            onChange={e =>
              setFormData({
                ...formData,
                last_name: e.target.value,
              })
            }
            className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
            required
          />

          <input
            type="text"
            placeholder="Teléfono"
            value={formData.phone}
            onChange={e =>
              setFormData({
                ...formData,
                phone: e.target.value,
              })
            }
            className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={e =>
              setFormData({
                ...formData,
                email: e.target.value,
              })
            }
            className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
          >
            {isSubmitting ?"Creando...": "Crear Miembro"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4 text-sm text-zinc-400">
            No se encontraron miembros
          </div>
        ) : (
          filteredMembers.map(member => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#201f1f] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2a2a2a] font-bold text-blue-300">
                  {member.first_name[0]}
                  {member.last_name[0]}
                </div>

                <div>
                  <p className="font-medium text-white">
                    {member.first_name}{" "}
                    {member.last_name}
                  </p>

                  <p className="text-sm text-zinc-400">
                    {member.phone}
                  </p>

                  <p className="text-xs text-zinc-500">
                    {member.email}
                  </p>
                </div>
              </div>

              <div
                className={`rounded-md px-2 py-1 text-xs ${
                  member.active
                    ? "bg-blue-500/10 text-blue-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {member.active
                  ? "Activo"
                  : "Inactivo"}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default Members;