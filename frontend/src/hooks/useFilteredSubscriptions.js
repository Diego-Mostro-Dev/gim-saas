import { useMemo } from "react";

export function useFilteredSubscriptions({
  subscriptions,
  searchTerm,
  statusFilter,
  paymentFilter,
}) {
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const fullText = `
        ${subscription.member_name}
        ${subscription.plan_name}
      `.toLowerCase();

      const matchesSearch = fullText.includes(
        searchTerm.toLowerCase(),
      );

      const today = new Date();

      const endDate = new Date(
        subscription.end_date,
      );

      const isExpired = endDate < today;

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "expired"
            ? isExpired
            : !isExpired;

      const matchesPayment =
        paymentFilter === "all"
          ? true
          : paymentFilter === "paid"
            ? subscription.paid
            : !subscription.paid;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment
      );
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