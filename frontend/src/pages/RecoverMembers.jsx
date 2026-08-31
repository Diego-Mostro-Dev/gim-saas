import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Search, User } from "lucide-react";

import { useMembers } from "../hooks/useMembers";
import { useFilteredMembers } from "../hooks/useFilteredMembers";
import {
  getMemberOutstanding,
  getOutstanding,
  reopenSubscription,
} from "../services/subscriptions.service";
import { createPayment, getPayments } from "../services/payments.service";
import { formatCurrency } from "../utils/currency.utils";
import { findRecentCashPayment } from "../utils/paymentAlerts";
import ConfirmModal from "../components/ui/ConfirmModal";

function formatPeriod(dateStr) {
  const date = new Date(dateStr);
  const period = date.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return period.charAt(0).toUpperCase() + period.slice(1);
}

function RecoverMembers() {
  const { members, loading, error } = useMembers();

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "debt" | "recoverable"

  const [selectedMember, setSelectedMember] = useState(null);

  const [debt, setDebt] = useState(null);
  const [debtLoading, setDebtLoading] = useState(false);
  const [debtError, setDebtError] = useState(null);

  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [payingSubscriptionId, setPayingSubscriptionId] = useState(null);
  const [reopening, setReopening] = useState(false);

  const [warningPayment, setWarningPayment] = useState(null);
  const pendingPaymentRef = useRef(null);

  const [debtorMemberIds, setDebtorMemberIds] = useState(new Set());

  const requestIdRef = useRef(0);

  async function refreshDebtors() {
    try {
      const outstanding = await getOutstanding();
      const ids = new Set(
        outstanding.map((entry) => Number(entry.member_id)),
      );
      setDebtorMemberIds(ids);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const outstanding = await getOutstanding();
        const ids = new Set(
          outstanding.map((entry) => Number(entry.member_id)),
        );
        if (!cancelled) setDebtorMemberIds(ids);
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const { filteredMembers } = useFilteredMembers({
    members,
    searchTerm,
  });

  const debtCount = members.filter((m) =>
    debtorMemberIds.has(Number(m.id)),
  ).length;
  const recoverableCount = members.filter(
    (m) => Boolean(m.is_recoverable),
  ).length;

  const visibleMembers = filteredMembers.filter((member) => {
    if (filter === "debt") return debtorMemberIds.has(Number(member.id));
    if (filter === "recoverable") return Boolean(member.is_recoverable);
    return true;
  });

  async function fetchDebt(memberId) {
    const requestId = ++requestIdRef.current;
    setDebtLoading(true);

    try {
      const data = await getMemberOutstanding(memberId);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setDebt(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setDebtError(err.message || "No se pudo cargar la deuda");
    }

    if (requestId === requestIdRef.current) {
      setDebtLoading(false);
    }
  }

  async function handleSelectMember(member) {
    setSelectedMember(member);
    setDebt(null);
    setDebtError(null);
    setPaymentAmounts({});

    await fetchDebt(member.id);
  }

  async function handleRegisterPayment(subscription) {
    setDebtError(null);
    setPayingSubscriptionId(subscription.id);

    const doPay = async () => {
      try {
        await createPayment({
          subscription: subscription.id,
          amount: paymentAmounts[subscription.id],
        });

        setPaymentAmounts((prev) => ({
          ...prev,
          [subscription.id]: "",
        }));

        await fetchDebt(selectedMember.id);
        await refreshDebtors();
      } catch (err) {
        setDebtError(err.message || "No se pudo registrar el pago");
      } finally {
        setPayingSubscriptionId(null);
      }
    };

    try {
      const payments = await getPayments();
      const existing = findRecentCashPayment(payments, {
        subscription: subscription.id,
      });

      if (existing) {
        setWarningPayment(existing);
        pendingPaymentRef.current = doPay;
        return;
      }

      await doPay();
    } catch (err) {
      setDebtError(err.message || "No se pudo registrar el pago");
      setPayingSubscriptionId(null);
    }
  }

  function confirmDuplicatePayment() {
    const pay = pendingPaymentRef.current;
    pendingPaymentRef.current = null;
    setWarningPayment(null);
    if (pay) pay();
  }

  function dismissDuplicatePayment() {
    pendingPaymentRef.current = null;
    setWarningPayment(null);
    setPayingSubscriptionId(null);
  }

  async function handleRecoverMember() {
    setDebtError(null);
    setReopening(true);

    try {
      await reopenSubscription(selectedMember.id);
      toast.success("Socio recuperado correctamente");
      await fetchDebt(selectedMember.id);
      await refreshDebtors();
    } catch (err) {
      setDebtError(err.message || "No se pudo recuperar el socio");
    } finally {
      setReopening(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando socios...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Recuperar socios</h1>

        <p className="mt-1 text-sm text-text-secondary">
          Buscar un socio y consultar su deuda
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg dark:bg-danger/10 p-4 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      {/* CONTENT */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* LEFT COLUMN */}
        <div>
          {/* SEARCH */}
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3">
            <Search size={18} className="text-text-secondary" />

            <input
              type="text"
              placeholder="Buscar socio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </div>

          {/* FILTER */}
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { key: "all", label: "Todos" },
              { key: "debt", label: `Con deuda (${debtCount})` },
              {
                key: "recoverable",
                label: `Recuperables (${recoverableCount})`,
              },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter === key
                    ? "border-blue-500 bg-blue-500/10 text-blue-600"
                    : "border-border bg-surface-elevated text-text-secondary hover:bg-surface-input"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

      {/* MEMBER LIST */}
      <div className="mb-6 space-y-3">
        {visibleMembers.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
            No se encontraron socios
          </div>
        ) : (
          visibleMembers.map((member) => {
            const isSelected = selectedMember?.id === member.id;
            const hasDebt = debtorMemberIds.has(Number(member.id));
            const isRecoverable = Boolean(member.is_recoverable);

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelectMember(member)}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border bg-surface-elevated hover:bg-surface-input"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-input text-text-secondary">
                  <User size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {member.first_name} {member.last_name}
                  </p>

                  <p className="truncate text-xs text-text-secondary">
                    {member.phone}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {hasDebt && (
                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">
                      Con deuda
                    </span>
                  )}

                  {isRecoverable && (
                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-600">
                      Recuperable
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
      </div>

        {/* RIGHT COLUMN */}
        <div>
          {selectedMember ? (
            <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-text-primary">
                Deuda de {selectedMember.first_name} {selectedMember.last_name}
              </h2>

          {debtLoading && (
            <p className="text-sm text-text-secondary">Cargando deuda...</p>
          )}

          {debtError && (
            <div className="rounded-xl border border-danger/20 bg-danger-bg dark:bg-danger/10 p-3 text-sm text-danger-text dark:text-danger">
              {debtError}
            </div>
          )}

          {debt && !debtLoading && (
            <div className="space-y-6">
              {debt.total > 0 ? (
                <>
              {debt.subscriptions.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  El socio no posee deuda pendiente
                </p>
              ) : (
                debt.subscriptions.map((subscription) => (
                  <div key={subscription.id}>
                    <p className="mb-2 text-sm font-semibold text-text-primary">
                      {formatPeriod(subscription.start_date)}
                    </p>

                    <div className="mb-3 space-y-1 text-sm text-text-secondary">
                      <p className="text-xs font-semibold uppercase tracking-wide">
                        Servicios
                      </p>

                      {subscription.items.map((item) => (
                        <p
                          key={item.id}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span className="truncate">
                            • {item.name_snapshot || item.activity_name}
                          </span>

                          <span className="shrink-0 text-text-primary">
                            {formatCurrency(item.price_snapshot)}
                          </span>
                        </p>
                      ))}
                    </div>

                    <div className="space-y-1 text-sm text-text-secondary">
                      <p>
                        <span className="inline-block w-20">Total:</span>
                        <span className="text-text-primary">
                          {formatCurrency(subscription.total)}
                        </span>
                      </p>

                      <p>
                        <span className="inline-block w-20">Pagado:</span>
                        <span className="text-text-primary">
                          {formatCurrency(subscription.paid_amount)}
                        </span>
                      </p>

                      <p>
                        <span className="inline-block w-20">Restan:</span>
                        <span className="text-text-primary">
                          {formatCurrency(subscription.remaining)}
                        </span>
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={Number(subscription.remaining)}
                        placeholder={`Monto (máx ${formatCurrency(subscription.remaining)})`}
                        value={paymentAmounts[subscription.id] || ""}
                        onChange={(e) =>
                          setPaymentAmounts((prev) => ({
                            ...prev,
                            [subscription.id]: e.target.value,
                          }))
                        }
                        className="min-w-0 flex-1 basis-40 rounded-xl border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
                      />

                      <button
                        type="button"
                        onClick={() => handleRegisterPayment(subscription)}
                        disabled={payingSubscriptionId !== null}
                        className="shrink-0 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
                      >
                        {payingSubscriptionId === subscription.id
                          ? "Registrando..."
                          : "Registrar pago"}
                      </button>
                    </div>
                  </div>
                ))
              )}

              {debt.subscriptions.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold text-text-primary">
                    Total adeudado:
                  </p>

                  <p className="mt-1 text-xl font-bold text-text-primary">
                    {formatCurrency(debt.total)}
                  </p>
                </div>
              )}
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    El socio no posee deuda pendiente
                  </p>

                  <button
                    type="button"
                    onClick={handleRecoverMember}
                    disabled={reopening}
                    className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-60"
                  >
                    {reopening ? "Recuperando..." : "Recuperar socio"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center shadow-sm">
              <p className="text-sm text-text-secondary">
                Seleccione un socio para consultar su deuda.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(warningPayment)}
        title="Pago reciente detectado"
        message={
          warningPayment
            ? `Ya se registró un pago en efectivo de ${formatCurrency(
                warningPayment.amount,
              )} para esta suscripción. ¿Confirmás que querés registrar otro pago en efectivo?`
            : ""
        }
        confirmText="Sí, registrar igual"
        cancelText="Revisar"
        onClose={dismissDuplicatePayment}
        onConfirm={confirmDuplicatePayment}
      />
    </div>
  );
}

export default RecoverMembers;
