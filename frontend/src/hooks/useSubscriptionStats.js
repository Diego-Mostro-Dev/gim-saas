import { useMemo } from "react";

export function useSubscriptionStats(subscriptions) {
  const stats = useMemo(() => {
    const today = new Date();

    let active = 0;
    let expired = 0;
    let paid = 0;
    let pending = 0;

    subscriptions.forEach((subscription) => {
      const endDate = new Date(subscription.end_date);

      const isExpired = endDate < today;

      if (isExpired) {
        expired++;
      } else {
        active++;
      }

      if (subscription.paid) {
        paid++;
      } else {
        pending++;
      }
    });

    return {
      total: subscriptions.length,
      active,
      expired,
      paid,
      pending,
    };
  }, [subscriptions]);

  return stats;
}