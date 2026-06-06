import { useEffect, useState } from "react";

import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../services/routines.service";

export function useRoutineTemplates() {
  const [templates, setTemplates] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoading(true);
      setError(null);

      const data =
        await getTemplates();

      setTemplates(data);
    } catch (err) {
      console.error(err);

      setError(
        "No se pudieron cargar las plantillas"
      );
    } finally {
      setLoading(false);
    }
  }

  async function addTemplate(payload) {
    const created =
      await createTemplate(payload);

    setTemplates((prev) => [
      created,
      ...prev,
    ]);

    return created;
  }

  async function editTemplate(
    id,
    payload
  ) {
    const updated =
      await updateTemplate(
        id,
        payload
      );

    setTemplates((prev) =>
      prev.map((item) =>
        item.id === id
          ? updated
          : item
      )
    );

    return updated;
  }

  async function removeTemplate(id) {
    await deleteTemplate(id);

    setTemplates((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  }

  return {
    templates,
    loading,
    error,
    addTemplate,
    editTemplate,
    removeTemplate,
    reloadTemplates:
      loadTemplates,
  };
}