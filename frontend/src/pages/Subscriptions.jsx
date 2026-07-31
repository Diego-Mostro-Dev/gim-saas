import { useState } from "react";

import MemberSubscriptionCard from "../components/subscriptions/MemberSubscriptionCard";
import SubscriptionFilters from "../components/subscriptions/SubscriptionFilters";
import SubscriptionStats from "../components/subscriptions/SubscriptionStats";

import { useSubscriptions } from "../hooks/useSubscriptions";
import { useFilteredSubscriptions } from "../hooks/useFilteredSubscriptions";
import { useSubscriptionStats } from "../hooks/useSubscriptionStats";

function Subscriptions() {
  const {
    subscriptions,
    members,
    plans,
    loading,
    error,
  } = useSubscriptions();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [renewalFilter, setRenewalFilter] = useState("all");

  const { filteredMembers } = useFilteredSubscriptions({
    members,
    subscriptions,
    searchTerm,
    statusFilter,
    renewalFilter,
  });

  const stats = useSubscriptionStats(members, subscriptions);

  const subsByMember = {};
  subscriptions.forEach((sub) => {
    if (!subsByMember[sub.member]) subsByMember[sub.member] = [];
    subsByMember[sub.member].push(sub);
  });

  Object.values(subsByMember).forEach((subs) => {
    subs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando miembros...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estado comercial</h1>
          <p className="mt-1 text-sm text-text-secondary">Situación actual de cada miembro</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-danger-bg dark:bg-danger/15 p-4 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      <SubscriptionStats stats={stats} />

      <SubscriptionFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        renewalFilter={renewalFilter}
        setRenewalFilter={setRenewalFilter}
      />

      {filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center text-text-secondary">
          No hay miembros que coincidan con los filtros
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <MemberSubscriptionCard
              key={member.id}
              member={member}
              subscriptions={subsByMember[member.id] || []}
              plans={plans}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Subscriptions;
