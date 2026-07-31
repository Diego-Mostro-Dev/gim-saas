import { useMemo } from "react";

export function useSubscriptionStats(members, subscriptions) {
  const stats = useMemo(() => {
    const today = new Date();

    const subsByMember = {};
    subscriptions.forEach((sub) => {
      if (!subsByMember[sub.member]) subsByMember[sub.member] = [];
      subsByMember[sub.member].push(sub);
    });

    let active = 0;
    let pending = 0;
    let noRenewal = 0;

    members.forEach((member) => {
      const memberSubs = (subsByMember[member.id] || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      const current = memberSubs[0];
      if (!current) return;

      const isActive =
        new Date(current.start_date) <= today &&
        new Date(current.end_date) >= today;

      if (isActive) {
        active++;
        if (!current.paid) pending++;
        if (!current.auto_renew) noRenewal++;
      }
    });

    return {
      total: members.length,
      active,
      pending,
      noRenewal,
    };
  }, [members, subscriptions]);

  return stats;
}
