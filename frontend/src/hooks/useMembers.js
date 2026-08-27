import { useEffect, useState } from "react";

import {
  getMembers,
  createMember,
  deleteMember,
  updateMember,
} from "../services/members.service";
import { getCached, isCacheFresh, clearCached } from "../utils/cache";

const CACHE_KEY = "members";
const TTL = 5 * 60 * 1000;

export function useMembers() {
  const [members, setMembers] = useState(() => getCached(CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !isCacheFresh(CACHE_KEY, TTL));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function loadMembers() {
    if (isCacheFresh(CACHE_KEY, TTL)) {
      setMembers(getCached(CACHE_KEY));
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const data = await getMembers();
      setMembers(data);
    } catch (err) {
      setError(err.message || "Error al cargar miembros");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  async function createNewMember(data) {
    const newMember = await createMember(data);
    setMembers((prev) => [newMember, ...prev]);
    clearCached(CACHE_KEY);
    return newMember;
  }

  async function editMember(id, data) {
    const updated = await updateMember(id, data);

    setMembers((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );

    clearCached(CACHE_KEY);
    return updated;
  }

  async function removeMember(id) {
    await deleteMember(id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    clearCached(CACHE_KEY);
  }

  return {
    members,
    loading,
    refreshing,
    error,
    createNewMember,
    editMember,
    removeMember,
    reload: loadMembers,
  };
}
