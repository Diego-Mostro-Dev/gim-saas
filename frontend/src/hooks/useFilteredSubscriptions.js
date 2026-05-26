import { useMemo } from "react";

export function useFilteredSubscriptions({
  subscriptions,
  searchTerm,
  statusFilter,
  paymentFilter,
}) {
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const memberMatch = subscription.member_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

      const planMatch = subscription.plan_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesSearch = memberMatch || planMatch;

      const today = new Date();

      const endDate = new Date(subscription.end_date);

      const isExpired = endDate < today;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !isExpired) ||
        (statusFilter === "expired" && isExpired);

      const matchesPayment =
        paymentFilter === "all" ||
        (paymentFilter === "paid" && subscription.paid) ||
        (paymentFilter === "pending" && !subscription.paid);

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [
    subscriptions,
    searchTerm,
    statusFilter,
    paymentFilter,
  ]);

  return {
    filteredSubscriptions,
  };
}