function MemberForm({
  formData,
  setFormData,
  onSubmit,
  editingMember,
  isSubmitting,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 space-y-3 rounded-2xl border border-white/5 bg-[#201f1f] p-4"
    >
      <h2 className="text-lg font-semibold text-white">
        {editingMember ? "Editar miembro" : "Nuevo miembro"}
      </h2>

      <input
        type="text"
        placeholder="Nombre"
        value={formData.first_name}
        onChange={(e) =>
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
        onChange={(e) =>
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
        onChange={(e) =>
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
        onChange={(e) =>
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
        {isSubmitting
          ? editingMember
            ? "Guardando..."
            : "Creando..."
          : editingMember
            ? "Guardar Cambios"
            : "Crear Miembro"}
      </button>
    </form>
  );
}

export default MemberForm;
