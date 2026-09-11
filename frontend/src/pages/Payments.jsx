import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

import toast from "react-hot-toast";

import { Plus } from "lucide-react";

import PaymentCard from "../components/payments/PaymentCard";
import PaymentForm from "../components/payments/PaymentForm";
import PaymentStats from "../components/payments/PaymentStats";

import ConfirmModal from "../components/ui/ConfirmModal";

import { usePayments } from "../hooks/usePayments";
import { usePaymentStats } from "../hooks/usePaymentStats";
import { usePaymentForm } from "../hooks/usePaymentForm";
import { usePaymentDuplicateWarning } from "../hooks/usePaymentDuplicateWarning";
import { useGym } from "../hooks/useGym";
import { txt } from "../utils/labels";
import { formatCurrency } from "../utils/currency.utils";

import { exportPaymentsCsv } from "../services/payments.service";

function Payments() {
  const location = useLocation();
  const { gym } = useGym();

  const {
    payments,
    members,
    subscriptions,
    loading,
    error,
    isSubmitting,
    handleCreatePayment,
    handleUpdatePayment,
    handleDeletePayment,
  } = usePayments();

  const {
    showForm,
    formData,
    editingPayment,
    setFormData,
    openCreateForm,
    openEditForm,
    closeForm,
    resetForm,
  } = usePaymentForm();

  const {
    warningPayment,
    checkBeforeSubmit,
    confirm: confirmDuplicate,
    dismiss: dismissDuplicate,
  } = usePaymentDuplicateWarning(payments);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [paymentToDelete, setPaymentToDelete] = useState(null);

  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [exporting, setExporting] = useState(false);

  const formRef = useRef(null);

  const { totalAmount, totalPayments, cashPayments, transferPayments } =
    usePaymentStats(payments);

  useEffect(() => {
    const state = location.state;

    if (!loading && state?.prefillMemberId) {
      openCreateForm();

      setFormData({
        member: String(state.prefillMemberId),
        subscription: state.prefillSubscriptionId
          ? String(state.prefillSubscriptionId)
          : "",
        amount: "",
        payment_method: "cash",
        notes: "",
      });

      window.history.replaceState({}, "");
    }
  }, [loading, location.state, openCreateForm, setFormData]);

  useEffect(() => {
    if (showForm && editingPayment && formRef.current) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showForm, editingPayment]);

  async function handleSubmit(e) {
    e.preventDefault();

    const doSubmit = async () => {
      try {
        if (editingPayment) {
          await handleUpdatePayment(editingPayment.id, formData);

          toast.success("Pago actualizado");
        } else {
          await handleCreatePayment(formData);

          toast.success("Pago creado");
        }

        resetForm();

        closeForm();
      } catch (error) {
        console.error(error);

        toast.error(error.message || "Ocurrió un error");
      }
    };

    checkBeforeSubmit({
      paymentMethod: formData.payment_method,
      subscription: formData.subscription,
      excludeId: editingPayment ? editingPayment.id : null,
      submitFn: doSubmit,
    });
  }

  function handleOpenDeleteModal(id) {
    setPaymentToDelete(id);

    setShowDeleteModal(true);
  }

  async function handleDelete() {
    try {
      await handleDeletePayment(paymentToDelete);

      toast.success("Pago eliminado");
    } catch (error) {
      console.error(error);

      toast.error("No se pudo eliminar el pago");
    }
  }

  async function handleExport() {
    if (!exportMonth) {
      toast.error("Seleccioná un mes para descargar");

      return;
    }

    try {
      setExporting(true);

      await exportPaymentsCsv(exportMonth);

      toast.success("CSV descargado");
    } catch (error) {
      console.error(error);

      toast.error(error.message || "No se pudo descargar el CSV");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando pagos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* HEADER */}
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>

          <p className="mt-1 text-sm text-text-secondary">
            {txt(gym, "staff.payments.title")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
            className="rounded-xl border border-border bg-surface-input px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
          />

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-input disabled:opacity-50"
          >
            {exporting ? "Descargando..." : "Descargar CSV"}
          </button>

          <button
            onClick={() => {
              if (showForm) {
                closeForm();
              } else {
                openCreateForm();
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            <Plus size={18} />
            {showForm ? "Cerrar" : "Nuevo"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg dark:bg-danger/10 p-4 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      {/* STATS */}
      <PaymentStats
        totalAmount={totalAmount}
        totalPayments={totalPayments}
        cashPayments={cashPayments}
        transferPayments={transferPayments}
      />

      {/* FORM */}
      {showForm && (
        <div ref={formRef} className="mb-6">
          <PaymentForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            editingPayment={editingPayment}
            members={members}
            subscriptions={subscriptions}
          />
        </div>
      )}

      {/* LIST */}
      <div className="space-y-3">
        {payments.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
            No hay pagos registrados
          </div>
        ) : (
          payments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              onEdit={openEditForm}
              onDelete={handleOpenDeleteModal}
            />
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Eliminar pago"
        message="Esta acción no se puede deshacer"
        confirmText="Eliminar"
        cancelText="Cancelar"
        onClose={() => {
          setShowDeleteModal(false);

          setPaymentToDelete(null);
        }}
        onConfirm={async () => {
          await handleDelete();

          setShowDeleteModal(false);

          setPaymentToDelete(null);
        }}
      />

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
        onClose={dismissDuplicate}
        onConfirm={confirmDuplicate}
      />
    </div>
  );
}

export default Payments;
