import { useEffect } from "react";

function PaymentForm({
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  editingPayment,
  members,
  subscriptions,
}) {
  const filteredSubscriptions = subscriptions.filter(
    (subscription) =>
      String(subscription.member) === String(formData.member) &&
      !subscription.paid,
  );

  const today = new Date();

  useEffect(() => {
    if (editingPayment) return;

    if (
      formData.member &&
      filteredSubscriptions.length === 1 &&
      String(filteredSubscriptions[0].id) !== formData.subscription
    ) {
      setFormData({
        ...formData,
        subscription: String(filteredSubscriptions[0].id),
      });
    }
  }, [formData.member, filteredSubscriptions]);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-text-primary">
        {editingPayment ? "Editar pago" : "Nuevo pago"}
      </h2>

      <select
        value={formData.member}
        onChange={(e) =>
          setFormData({
            ...formData,
            member: e.target.value,
            subscription: "",
          })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      >
        <option value="">Seleccionar miembro</option>

        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.first_name} {member.last_name}
          </option>
        ))}
      </select>

      {(!formData.member || filteredSubscriptions.length !== 1) && (
        <select
          value={formData.subscription}
          onChange={(e) =>
            setFormData({
              ...formData,
              subscription: e.target.value,
            })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          required
          disabled={!formData.member}
        >
          <option value="">
            {!formData.member
              ? "Primero seleccioná un miembro"
              : filteredSubscriptions.length === 0
                ? "Sin suscripciones pendientes"
                : "Seleccionar suscripción"}
          </option>

          {filteredSubscriptions.map((subscription) => {
            const expired = new Date(subscription.end_date) < today;

            return (
              <option key={subscription.id} value={subscription.id}>
                {expired ? "[VENCIDA] " : ""}
                {subscription.plan_name} •{" "}
                {new Date(subscription.start_date).toLocaleDateString("es-AR")} →{" "}
                {new Date(subscription.end_date).toLocaleDateString("es-AR")}
              </option>
            );
          })}
        </select>
      )}

      <input
        type="number"
        placeholder="Monto"
        value={formData.amount}
        onChange={(e) =>
          setFormData({
            ...formData,
            amount: e.target.value,
          })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />
    
      <select
        value={formData.payment_method}
        onChange={(e) =>
          setFormData({
            ...formData,
            payment_method: e.target.value,
          })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      >
        <option value="cash">Efectivo</option>

        <option value="transfer">Transferencia</option>

        <option value="card">Tarjeta</option>
      </select>

      <textarea
        placeholder="Notas adicionales"
        value={formData.notes}
        onChange={(e) =>
          setFormData({
            ...formData,
            notes: e.target.value,
          })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
      >
        {isSubmitting
          ? editingPayment
            ? "Guardando..."
            : "Registrando..."
          : editingPayment
            ? "Guardar cambios"
            : "Registrar pago"}
      </button>
    </form>
  );
}

export default PaymentForm;
