// src/hooks/useMembers.js

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

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);

      setError(null);

      const data = await getMembers();

      setMembers(data);
    } catch (error) {
      console.error(error);

      setError("Error al cargar miembros");
    } finally {
      setLoading(false);
    }
  }

  async function createNewMember(formData) {
    try {
      const newMember = await createMember(formData);

      setMembers((prev) => [newMember, ...prev]);

      return {
        success: true,
      };
    } catch (error) {
      console.error(error);

      return {
        success: false,
      };
    }
  }

  async function editMember(id, formData) {
    try {
      const updatedMember = await updateMember(id, formData);

      setMembers((prev) =>
        prev.map((member) =>
          member.id === updatedMember.id
            ? updatedMember
            : member,
        ),
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error(error);

      return {
        success: false,
      };
    }
  }

  async function removeMember(id) {
    try {
      await deleteMember(id);

      setMembers((prev) =>
        prev.filter((member) => member.id !== id),
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error(error);

      return {
        success: false,
      };
    }
  }

  return {
    members,
    loading,
    error,

    createNewMember,
    editMember,
    removeMember,
  };
}