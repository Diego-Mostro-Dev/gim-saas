function MemberForm({
  formData,
  setFormData,
  onSubmit,
  editingMember,
  isSubmitting,
}) {
  if (!formData) return null;

  const schedules = formData.schedules || [];

  const days = [
    { value: "monday", label: "Lunes" },
    { value: "tuesday", label: "Martes" },
    { value: "wednesday", label: "Miércoles" },
    { value: "thursday", label: "Jueves" },
    { value: "friday", label: "Viernes" },
    { value: "saturday", label: "Sábado" },
  ];

  const AVAILABLE_HOURS = [
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
  ];

  function handleToggleDay(day) {
    const exists = schedules.find((s) => s.day === day);

    if (exists) {
      setFormData({
        ...formData,
        schedules: schedules.filter((s) => s.day !== day),
      });
      return;
    }

    setFormData({
      ...formData,
      schedules: [...schedules, { day, hour: "08:00" }],
    });
  }

  function handleHourChange(day, hour) {
    setFormData({
      ...formData,
      schedules: schedules.map((s) => (s.day === day ? { ...s, hour } : s)),
    });
  }

  function isSelected(day) {
    return schedules.some((s) => s.day === day);
  }

  function getHour(day) {
    return schedules.find((s) => s.day === day)?.hour || "08:00";
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

      <div>
        <label className="mb-1 block text-sm text-zinc-400">Foto</label>

        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setFormData({
              ...formData,
              photo: e.target.files[0],
            })
          }
          className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white"
        />
      </div>

      <div className="rounded-xl bg-[#2a2a2a] p-4">
        <p className="mb-3 text-sm font-medium text-zinc-300">
          Horarios de asistencia
        </p>

        <div className="space-y-3">
          {days.map((day) => {
            const selected = isSelected(day.value);

            return (
              <div key={day.value} className="rounded-xl bg-[#1a1a1a] p-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleToggleDay(day.value)}
                    />
                    {day.label}
                  </label>

                  {selected && (
                    <select
                      value={getHour(day.value)}
                      onChange={(e) =>
                        handleHourChange(day.value, e.target.value)
                      }
                      className="rounded-lg bg-[#2a2a2a] px-3 py-1 text-sm text-white outline-none"
                    >
                      {AVAILABLE_HOURS.map((hour) => (
                        <option
                          key={hour}
                          value={hour}
                          className="bg-[#2a2a2a] text-white"
                        >
                          {hour}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
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
            ? "Guardar cambios"
            : "Crear miembro"}
      </button>
    </form>
  );
}

export default MemberForm;
