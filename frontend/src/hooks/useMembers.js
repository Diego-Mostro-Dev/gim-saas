import { useEffect, useState } from "react";

import {
  getMembers,
  createMember,
  deleteMember,
  updateMember,
} from "../services/members.service";
import { getCached, isCacheFresh } from "../utils/cache";

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
    try {
      const newMember = await createMember(data);
      setMembers((prev) => [newMember, ...prev]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function editMember(id, data) {
    try {
      const updated = await updateMember(id, data);

      setMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function removeMember(id) {
    try {
      await deleteMember(id);

      setMembers((prev) => prev.filter((m) => m.id !== id));

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
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
