function SubscriptionForm({
  formData,
  setFormData,
  onSubmit,
  members,
  plans,
  editingSubscription,
  isSubmitting,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 space-y-3 rounded-2xl border border-white/5 bg-[#201f1f] p-4"
    >
      <h2 className="text-lg font-semibold text-white">
        {editingSubscription ? "Editar suscripción" : "Nueva suscripción"}
      </h2>

      <select
        value={formData.member}
        onChange={(e) =>
          setFormData({
            ...formData,
            member: e.target.value,
          })
        }
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
        required
      >
        <option value="">Seleccionar miembro</option>

        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.first_name} {member.last_name}
          </option>
        ))}
      </select>

      <select
        value={formData.plan}
        onChange={(e) =>
          setFormData({
            ...formData,
            plan: e.target.value,
          })
        }
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
        required
      >
        <option value="">Seleccionar plan</option>

        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={formData.start_date}
        onChange={(e) =>
          setFormData({
            ...formData,
            start_date: e.target.value,
          })
        }
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
        required
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white disabled:opacity-50"
      >
        {isSubmitting
          ? editingSubscription
            ? "Guardando..."
            : "Creando..."
          : editingSubscription
            ? "Guardar cambios"
            : "Crear suscripción"}
      </button>
    </form>
  );
}

export default SubscriptionForm;
