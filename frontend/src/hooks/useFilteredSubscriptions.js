import { useMemo } from "react";

export function useFilteredSubscriptions({
  members,
  subscriptions,
  searchTerm,
  statusFilter,
  renewalFilter,
}) {
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const memberSubs = subscriptions
        .filter((s) => s.member === member.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const currentSub = memberSubs[0];
      const today = new Date();
      const isActive = currentSub &&
        new Date(currentSub.start_date) <= today &&
        new Date(currentSub.end_date) >= today;

      const memberName = `${member.first_name} ${member.last_name}`.toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        memberName.includes(search) ||
        (member.phone || "").includes(searchTerm);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "pending" && isActive && currentSub && !currentSub.paid) ||
        (statusFilter === "expired" && !isActive);

      const matchesRenewal =
        renewalFilter === "all" ||
        (renewalFilter === "with_renewal" && currentSub?.auto_renew) ||
        (renewalFilter === "without_renewal" && currentSub && !currentSub.auto_renew);

      return matchesSearch && matchesStatus && matchesRenewal;
    });
  }, [members, subscriptions, searchTerm, statusFilter, renewalFilter]);

  return { filteredMembers };
}
