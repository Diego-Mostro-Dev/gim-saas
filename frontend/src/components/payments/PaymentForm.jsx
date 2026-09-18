import { useEffect, useMemo, useState } from "react";
import { formatHumanDate } from "../../utils/date.utils";
import { formatCurrency } from "../../utils/currency.utils";
import { getMemberOutstanding } from "../../services/subscriptions.service";

const today = new Date();

const isActiveNow = (subscription) =>
  new Date(subscription.start_date) <= today &&
  new Date(subscription.end_date) >= today;

function PaymentForm({
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  editingPayment,
  members,
}) {
  const [outstanding, setOutstanding] = useState(null);

  const [outstandingMember, setOutstandingMember] =
    useState("");

  const [outstandingError, setOutstandingError] =
    useState(null);

  useEffect(() => {
    if (!formData.member) return undefined;

    let cancelled = false;

    getMemberOutstanding(formData.member)
      .then((data) => {
        if (cancelled) return;

        setOutstanding(data);

        setOutstandingMember(String(formData.member));

        setOutstandingError(null);
      })
      .catch((err) => {
        if (cancelled) return;

        console.error(err);

        setOutstandingError(
          err.message || "No se pudieron cargar los saldos",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [formData.member]);

  const outstandingFresh =
    Boolean(formData.member) &&
    outstandingMember === String(formData.member);

  const loadingOutstanding =
    Boolean(formData.member) &&
    !outstandingFresh &&
    !outstandingError;

  const listSource = outstandingFresh ? outstanding : null;

  const pendingItems = useMemo(() => [
    ...(listSource?.subscriptions || []).map((subscription) => {
      const active = isActiveNow(subscription);

      const expired = new Date(subscription.end_date) < today;

      return {
        key: `sub:${subscription.id}`,
        group: "Suscripción",
        mark: expired
          ? "[VENCIDA] "
          : active
            ? "[ACTUAL] "
            : "",
        label: [
          subscription.plan_name,
          `${formatHumanDate(subscription.start_date)} → ${formatHumanDate(subscription.end_date)}`,
          subscription.total != null
            ? `Total ${formatCurrency(subscription.total)}`
            : null,
          Number(subscription.paid_amount) > 0
            ? `Pagado ${formatCurrency(subscription.paid_amount)}`
            : null,
          `Restan ${formatCurrency(subscription.remaining)}`,
        ]
          .filter(Boolean)
          .join(" · "),
        remaining: Number(subscription.remaining),
        apply: () => ({
          subscription: String(subscription.id),
          enrollment: "",
          personal_training_assignment: "",
          concept: "subscription",
        }),
      };
    }),
    ...(listSource?.packages || [])
      .filter((pkg) => pkg.enrollment_id != null)
      .map((pkg) => ({
        key: `enr:${pkg.enrollment_id}`,
        group: "Clases",
        mark: "",
        label: [
          pkg.name,
          `${pkg.sessions_total} sesiones`,
          Number(pkg.paid_amount) > 0
            ? `Pagado ${formatCurrency(pkg.paid_amount)}`
            : null,
          `Restan ${formatCurrency(pkg.remaining)}`,
        ]
          .filter(Boolean)
          .join(" · "),
        remaining: Number(pkg.remaining),
        apply: () => ({
          subscription: "",
          enrollment: String(pkg.enrollment_id),
          personal_training_assignment: "",
          concept: "coseguro",
        }),
      })),
    ...(listSource?.packages || [])
      .filter((pkg) => pkg.assignment_id != null)
      .map((pkg) => ({
        key: `asg:${pkg.assignment_id}`,
        group: "PT",
        mark: "",
        label: [
          pkg.name,
          `${pkg.sessions_total} sesiones`,
          Number(pkg.paid_amount) > 0
            ? `Pagado ${formatCurrency(pkg.paid_amount)}`
            : null,
          `Restan ${formatCurrency(pkg.remaining)}`,
        ]
          .filter(Boolean)
          .join(" · "),
        remaining: Number(pkg.remaining),
        apply: () => ({
          subscription: "",
          enrollment: "",
          personal_training_assignment: String(pkg.assignment_id),
          concept: "personal_training",
        }),
      })),
    ...(listSource?.sellados || []).map((sellado) => {
      const isEnrollment = sellado.target_type === "enrollment";

      const targetId = isEnrollment
        ? sellado.enrollment_id
        : sellado.assignment_id;

      return {
        key: `${isEnrollment ? "enr" : "asg"}-sellado:${targetId}`,
        group: "Sellado",
        mark: "",
        label: [
          sellado.name,
          `Sellado ${formatCurrency(sellado.amount)}`,
        ]
          .filter(Boolean)
          .join(" · "),
        remaining: Number(sellado.amount),
        prefillAmount: String(sellado.amount),
        apply: () => ({
          subscription: "",
          enrollment: isEnrollment ? String(targetId) : "",
          personal_training_assignment: isEnrollment ? "" : String(targetId),
          concept: "sellado",
        }),
      };
    }),
  ], [listSource]);

  function currentKey(form = formData) {
    if (form.subscription) return `sub:${form.subscription}`;

    if (form.enrollment) {
      return `${form.concept === "sellado" ? "enr-sellado" : "enr"}:${form.enrollment}`;
    }

    if (form.personal_training_assignment) {
      return `${form.concept === "sellado" ? "asg-sellado" : "asg"}:${form.personal_training_assignment}`;
    }

    return "";
  }

  const selectedKey = currentKey();

  const syntheticItems = [];

  if (editingPayment && selectedKey) {
    const exists = pendingItems.some(
      (item) => item.key === selectedKey,
    );

    if (!exists) {
      syntheticItems.push({
        key: selectedKey,
        group:
          editingPayment.concept === "sellado" ? "Sellado" : "No vigente",
        mark: "",
        label: [
          editingPayment.plan_name || "Pago registrado",
          "Elemento ya saldado o no vigente",
        ]
          .filter(Boolean)
          .join(" · "),
        remaining:
          editingPayment.amount != null
            ? Number(editingPayment.amount)
            : 0,
        apply: () => ({
          subscription: formData.subscription,
          enrollment: formData.enrollment,
          personal_training_assignment: formData.personal_training_assignment,
          concept: formData.concept,
        }),
      });
    }
  }

  const items = [...pendingItems, ...syntheticItems];

  const selectedItem = items.find(
    (item) => item.key === selectedKey,
  );

  const remaining = selectedItem ? selectedItem.remaining : null;

  const isSellado = selectedItem
    ? selectedItem.group === "Sellado"
    : false;

  useEffect(() => {
    if (editingPayment) return;

    if (!formData.member || !outstandingFresh) return;

    if (pendingItems.length !== 1) return;

    const only = pendingItems[0];

    if (`${only.key}` === selectedKey) return;

    const patch = only.apply();

    patch.amount =
      only.prefillAmount != null ? only.prefillAmount : "";

    setFormData((prev) => ({ ...prev, ...patch }));
  }, [
    formData.member,
    outstandingFresh,
    pendingItems,
    selectedKey,
    editingPayment,
    setFormData,
  ]);

  const targetOptionsText = !formData.member
    ? "Primero seleccioná un miembro"
    : loadingOutstanding
      ? "Cargando..."
      : outstandingError
        ? "Error al cargar los saldos"
        : items.length === 0
          ? "Sin saldos pendientes"
          : "Seleccionar a cobrar";

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
        onChange={(e) => {
          const memberId = e.target.value;

          setFormData({
            ...formData,
            member: memberId,
            subscription: "",
            enrollment: "",
            personal_training_assignment: "",
            concept: "",
          });

          setOutstanding(null);

          setOutstandingMember("");

          setOutstandingError(null);
        }}
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      >
        <option value="">Seleccionar miembro</option>

        {members.map((member) => {
          const identityBits = [
            member.document_number
              ? `DNI ${member.document_number}`
              : null,
            member.phone || null,
            member.insurance_name || null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <option key={member.id} value={member.id}>
              {member.first_name} {member.last_name}
              {identityBits ? ` · ${identityBits}` : ""}
            </option>
          );
        })}
      </select>

      <select
        value={selectedKey}
        onChange={(e) => {
          const item = items.find(
            (candidate) => candidate.key === e.target.value,
          );

          if (item) {
            const patch = item.apply();

            patch.amount =
              item.prefillAmount != null ? item.prefillAmount : "";

            setFormData((prev) => ({ ...prev, ...patch }));
          } else {
            setFormData({
              ...formData,
              subscription: "",
              enrollment: "",
              personal_training_assignment: "",
              concept: "",
            });
          }
        }}
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
        disabled={!formData.member || loadingOutstanding}
      >
        <option value="">{targetOptionsText}</option>

        {items.map((item) => (
          <option key={item.key} value={item.key}>
            {item.mark}[{item.group}] {item.label}
          </option>
        ))}
      </select>

      {isSellado && (
        <p className="text-xs text-text-secondary">
          El sellado es por este monto exacto.
        </p>
      )}

      {syntheticItems.length > 0 && (
        <p className="text-xs text-text-secondary">
          El elemento cobrado ya no está pendiente: el monto queda limitado a
          lo ya registrado.
        </p>
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