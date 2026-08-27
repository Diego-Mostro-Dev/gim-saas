import { useEffect } from "react";
import { formatHumanDate } from "../../utils/date.utils";
import { formatCurrency } from "../../utils/currency.utils";

function PaymentForm({
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  editingPayment,
  members,
  subscriptions,
}) {
  const today = new Date();

  const isActiveNow = (subscription) =>
    new Date(subscription.start_date) <= today &&
    new Date(subscription.end_date) >= today;

  const dateMillis = (value) => {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const filteredSubscriptions = subscriptions
    .filter(
      (subscription) =>
        String(subscription.member) === String(formData.member) &&
        Number(subscription.remaining) > 0,
    )
    .slice()
    .sort((a, b) => {
      const aActive = isActiveNow(a);
      const bActive = isActiveNow(b);

      if (aActive !== bActive) return bActive ? 1 : -1;

      const endDiff = dateMillis(b.end_date) - dateMillis(a.end_date);

      if (endDiff !== 0) return endDiff;

      return String(b.id).localeCompare(String(a.id));
    });

  const selectedSubscription = filteredSubscriptions.find(
    (subscription) =>
      String(subscription.id) === String(formData.subscription),
  );

  const remaining = selectedSubscription
    ? Number(selectedSubscription.remaining)
    : null;

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
                ? "Sin suscripciones con saldo pendiente"
                : "Seleccionar suscripción"}
          </option>

          {filteredSubscriptions.map((subscription) => {
            const expired = new Date(subscription.end_date) < today;
            const isCurrent =
              filteredSubscriptions.length > 1 && isActiveNow(subscription);
            const label = [
              subscription.plan_name,
              `${formatHumanDate(subscription.start_date)} → ${formatHumanDate(subscription.end_date)}`,
              subscription.total != null
                ? `Total ${formatCurrency(subscription.total)}`
                : null,
              Number(subscription.paid_amount) > 0
                ? `Pagado ${formatCurrency(subscription.paid_amount)}`
                : null,
              subscription.remaining != null
                ? `Restan ${formatCurrency(subscription.remaining)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <option key={subscription.id} value={subscription.id}>
                {isCurrent ? "[ACTUAL] " : ""}
                {expired ? "[VENCIDA] " : ""}
                {label}
              </option>
            );
          })}
        </select>
      )}

      {filteredSubscriptions.length > 1 && (
        <p className="text-xs text-text-secondary">
          La suscripción actual aparece primero; las anteriores con saldo
          pendiente también quedan seleccionables.
        </p>
      )}

      {filteredSubscriptions.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning-bg dark:bg-warning/15 px-4 py-3 text-sm text-warning-text dark:text-warning">
          <p className="mb-2 font-medium">Saldo pendiente:</p>
          <ul className="space-y-1">
            {filteredSubscriptions.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between gap-2">
                <span>
                  {sub.plan_name}
                  {isActiveNow(sub) && (
                    <span className="ml-1 text-xs opacity-70">(actual)</span>
                  )}
                </span>
                <span className="whitespace-nowrap text-xs text-text-secondary">
                  vence {formatHumanDate(sub.end_date)} — restan{" "}
                  {formatCurrency(sub.remaining)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        type="number"
        min="0.01"
        max={remaining ?? undefined}
        step="0.01"
        placeholder={remaining != null ? `Monto (máx ${formatCurrency(remaining)})` : "Monto"}
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
