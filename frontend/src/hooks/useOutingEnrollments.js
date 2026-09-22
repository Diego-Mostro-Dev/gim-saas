import { useEffect, useState } from "react";

import {
  getScheduleOutingEnrollments,
  unenrollOutingMember,
} from "../services/outingsEnrollments.service";
import { getOuting } from "../services/outings.service";

export function useOutingEnrollments(scheduleId, outingId) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [outingName, setOutingName] = useState("");
  const [outing, setOuting] = useState(null);

  async function load() {
    if (!scheduleId) return;

    try {
      setLoading(true);
      setError(null);

      const [enrollData, outingData] = await Promise.all([
        getScheduleOutingEnrollments(scheduleId),
        outingId ? getOuting(outingId) : Promise.resolve(null),
      ]);

      setEnrollments(enrollData);
      if (outingData) {
        setOutingName(outingData.name);
        setOuting(outingData);
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar inscriptos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [scheduleId, outingId]);

  async function handleUnenroll(memberId) {
    try {
      await unenrollOutingMember(scheduleId, memberId);
      setEnrollments((prev) =>
        prev.filter((e) => e.member.id !== memberId),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  return {
    enrollments,
    loading,
    error,
    outing,
    outingName,
    handleUnenroll,
    reload: load,
  };
}