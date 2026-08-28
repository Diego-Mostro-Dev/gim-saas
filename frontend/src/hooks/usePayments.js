import { useEffect, useState } from "react";

import {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
} from "../services/payments.service";

import { getMembers } from "../services/members.service";

import { getSubscriptions } from "../services/subscriptions.service";
import { getCached, isCacheFresh } from "../utils/cache";

function secondaryCacheFresh() {
  return (
    isCacheFresh("members", 5 * 60 * 1000) &&
    isCacheFresh("subscriptions", 2 * 60 * 1000)
  );
}

export function usePayments() {
  const [payments, setPayments] = useState([]);

  const [members, setMembers] = useState(() =>
    isCacheFresh("members", 5 * 60 * 1000) ? getCached("members") || [] : []
  );

  const [subscriptions, setSubscriptions] =
    useState(() =>
      isCacheFresh("subscriptions", 2 * 60 * 1000) ? getCached("subscriptions") || [] : []
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function loadData() {
    await Promise.resolve();
    if (secondaryCacheFresh()) {
      setMembers(getCached("members") || []);
      setSubscriptions(getCached("subscriptions") || []);
      setLoading(false);
      setError(null);
      try {
        const paymentsData = await getPayments();
        setPayments(paymentsData);
      } catch (err) {
        console.error(err);
      }
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const [paymentsResult, membersResult, subscriptionsResult] =
        await Promise.allSettled([
          getPayments(),
          getMembers(),
          getSubscriptions(),
        ]);

      if (paymentsResult.status === "fulfilled") {
        setPayments(paymentsResult.value);
      } else {
        console.error(paymentsResult.reason);
        setError("Error al cargar pagos");
      }

      if (membersResult.status === "fulfilled") {
        setMembers(membersResult.value);
      } else {
        console.error(membersResult.reason);
      }

      if (subscriptionsResult.status === "fulfilled") {
        setSubscriptions(subscriptionsResult.value);
      } else {
        console.error(subscriptionsResult.reason);
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function runLoader() {
      await loadData();
    }
    runLoader();

    async function check() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const [paymentsResult, membersResult, subscriptionsResult] =
          await Promise.allSettled([
            getPayments(),
            getMembers(),
            getSubscriptions(),
          ]);

        if (paymentsResult.status === "fulfilled") {
          setPayments(paymentsResult.value);
        }

        if (membersResult.status === "fulfilled") {
          setMembers(membersResult.value);
        }

        if (subscriptionsResult.status === "fulfilled") {
          setSubscriptions(subscriptionsResult.value);
        }
      } catch {
        // silencioso: el próximo ciclo reintentará
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        check();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    const interval = setInterval(check, 1 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, []);

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
