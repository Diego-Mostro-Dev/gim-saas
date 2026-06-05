import { useEffect, useState } from "react";

import {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
} from "../services/payments.service";

import { getMembers } from "../services/members.service";

import { getSubscriptions } from "../services/subscriptions.service";

export function usePayments() {
  const [payments, setPayments] = useState([]);

  const [members, setMembers] = useState([]);

  const [subscriptions, setSubscriptions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      setError(null);

      const [
        paymentsData,
        membersData,
        subscriptionsData,
      ] = await Promise.all([
        getPayments(),
        getMembers(),
        getSubscriptions(),
      ]);

      setPayments(paymentsData);

      setMembers(membersData);

      setSubscriptions(
        subscriptionsData,
      );
    } catch (err) {
      console.error(err);

      setError("Error al cargar pagos");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSubscriptions() {
    const subscriptionsData =
      await getSubscriptions();

    setSubscriptions(
      subscriptionsData,
    );
  }

  async function handleCreatePayment(
    data,
  ) {
    try {
      setIsSubmitting(true);

      const newPayment =
        await createPayment(data);

      setPayments((prev) => [
        newPayment,
        ...prev,
      ]);

      await refreshSubscriptions();
    } catch (err) {
      console.error(err);

      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdatePayment(
    id,
    data,
  ) {
    try {
      setIsSubmitting(true);

      const updatedPayment =
        await updatePayment(id, data);

      setPayments((prev) =>
        prev.map((payment) =>
          payment.id ===
          updatedPayment.id
            ? updatedPayment
            : payment,
        ),
      );
    } catch (err) {
      console.error(err);

      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeletePayment(
    id,
  ) {
    try {
      await deletePayment(id);

      setPayments((prev) =>
        prev.filter(
          (payment) =>
            payment.id !== id,
        ),
      );

      await refreshSubscriptions();
    } catch (err) {
      console.error(err);

      throw err;
    }
  }

  return {
    payments,
    members,
    subscriptions,
    loading,
    error,
    isSubmitting,
    handleCreatePayment,
    handleUpdatePayment,
    handleDeletePayment,
  };
}