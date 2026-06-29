import { useState, useEffect, useCallback } from "react";
import {
  getMemberEnrollments,
  unenrollMemberFromActivity,
} from "../services/activitiesPublic.service";

export function useMemberActivities(token) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unenrollingId, setUnenrollingId] = useState(null);

  useEffect(() => {
    if (!token) return;
    loadEnrollments();
  }, [token]);

  async function loadEnrollments() {
    try {
      setLoading(true);
      setError(null);
      const data = await getMemberEnrollments(token);
      setEnrollments(data);
    } catch (err) {
      setError(err.message || "Error al cargar actividades");
    } finally {
      setLoading(false);
    }
  }

  const handleUnenroll = useCallback(async (scheduleId) => {
    setUnenrollingId(scheduleId);
    try {
      await unenrollMemberFromActivity(token, scheduleId);
      setEnrollments((prev) =>
        prev.filter((e) => e.schedule !== scheduleId)
      );
      return true;
    } finally {
      setUnenrollingId(null);
    }
  }, [token]);

  const reload = useCallback(() => {
    loadEnrollments();
  }, []);

  return { enrollments, loading, error, handleUnenroll, unenrollingId, reload };
}
