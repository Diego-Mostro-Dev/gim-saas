import { useEffect, useState } from "react";

import {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
} from "../services/payments.service";

export function usePayments() {
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    try {
      setLoading(true);

      setError(null);

      const data = await getPayments();

      setPayments(data);
    } catch (err) {
      console.error(err);

      setError("Error al cargar pagos");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePayment(data) {
    try {
      const newPayment =
        await createPayment(data);

      setPayments((prev) => [
        newPayment,
        ...prev,
      ]);
    } catch (err) {
      console.error(err);

      throw err;
    }
  }

  async function handleUpdatePayment(
    id,
    data,
  ) {
    try {
      const updatedPayment =
        await updatePayment(id, data);

      setPayments((prev) =>
        prev.map((payment) =>
          payment.id === updatedPayment.id
            ? updatedPayment
            : payment,
        ),
      );
    } catch (err) {
      console.error(err);

      throw err;
    }
  }

  async function handleDeletePayment(id) {
    try {
      await deletePayment(id);

      setPayments((prev) =>
        prev.filter(
          (payment) => payment.id !== id,
        ),
      );
    } catch (err) {
      console.error(err);

      throw err;
    }
  }

  return {
    payments,
    loading,
    error,
    handleCreatePayment,
    handleUpdatePayment,
    handleDeletePayment,
  };
}