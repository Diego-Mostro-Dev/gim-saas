import { useMemo } from "react";

export function useFilteredSubscriptions({
  subscriptions,
  searchTerm,
  statusFilter,
  paymentFilter,
}) {
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const today = new Date();

      const endDate = new Date(subscription.end_date);

      const isExpired = endDate < today;

      const matchesSearch =
        subscription.member_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        subscription.plan_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? !isExpired
            : isExpired;

      const matchesPayment =
        paymentFilter === "all"
          ? true
          : paymentFilter === "paid"
            ? subscription.paid
            : !subscription.paid;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [subscriptions, searchTerm, statusFilter, paymentFilter]);

  return {
    filteredSubscriptions,
  };
}