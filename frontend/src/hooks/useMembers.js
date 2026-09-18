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

  async function loadMembers(force = false) {
    if (force) {
      clearCached(CACHE_KEY);
    } else if (isCacheFresh(CACHE_KEY, TTL)) {
      const cached = getCached(CACHE_KEY);
      setMembers(cached);
      setLoading(false);
      setError(null);
      void backgroundRefresh();
      return cached;
    }
    try {
      setLoading(true);
      setError(null);

      const data = await getMembers();
      setMembers(data);
      return data;
    } catch (err) {
      setError(err.message || "Error al cargar miembros");
    } finally {
      setLoading(false);
    }
  }

  async function backgroundRefresh() {
    setRefreshing(true);
    try {
      const data = await getMembers();
      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }

  // Carga inicial deliberada con caché (fetch-on-mount): patrón usado en toda la
  // codebase (useSubscriptions, useActivities, useAttendanceStatus, usePlans...).
  // Incluir loadMembers en deps causaría refetch en cada render y re-levantar loading
  // en el mismo effect viola set-state-in-effect; se deshabilita consistentemente.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadMembers();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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
