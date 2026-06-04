import { useEffect, useState } from "react";

import {
  getMembers,
  createMember,
  deleteMember,
  updateMember,
} from "../services/members.service";

export function useMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadMembers() {
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
    error,
    createNewMember,
    editMember,
    removeMember,
    reload: loadMembers,
  };
}