function MemberForm({
  formData,
  setFormData,
  onSubmit,
  editingMember,
  isSubmitting,
}) {
  const days = [
    { value: "monday", label: "Lunes" },
    { value: "tuesday", label: "Martes" },
    { value: "wednesday", label: "Miércoles" },
    { value: "thursday", label: "Jueves" },
    { value: "friday", label: "Viernes" },
    { value: "saturday", label: "Sábado" },
  ];

  function toggleDay(day) {
    const currentDays = formData.schedule_days || [];

    const exists = currentDays.includes(day);

    if (exists) {
      setFormData({
        ...formData,
        schedule_days: currentDays.filter((d) => d !== day),
      });
    } else {
      setFormData({
        ...formData,
        schedule_days: [...currentDays, day],
      });
    }
  }

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

      <div className="rounded-xl bg-[#2a2a2a] p-4">
        <p className="mb-3 text-sm font-medium text-zinc-300">
          Días de asistencia
        </p>

        <div className="grid grid-cols-2 gap-2">
          {days.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-2 text-sm text-white"
            >
              <input
                type="checkbox"
                checked={formData.schedule_days?.includes(day.value) || false}
                onChange={() => toggleDay(day.value)}
              />

              {day.label}
            </label>
          ))}
        </div>
      </div>

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
