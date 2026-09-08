import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import {
  getAttendanceStatus,
  registerAttendance,
} from "../services/attendance.service";
import { getCached, isCacheFresh } from "../utils/cache";

const TTL = 60 * 1000;

const DEFAULT_DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const WEEKDAY_KEY_BY_GETDAY = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayKey(getDay) {
  return WEEKDAY_KEY_BY_GETDAY[getDay];
}

function todayKey() {
  return weekdayKey(new Date().getDay());
}

function defaultDayFor(dayKeys) {
  const today = todayKey();
  if (dayKeys.includes(today)) return today;
  const startIdx = DAY_ORDER.indexOf(today);
  for (let i = 1; i <= 7; i += 1) {
    const candidate = DAY_ORDER[(startIdx + i) % 7];
    if (dayKeys.includes(candidate)) return candidate;
  }
  return dayKeys[0];
}

export function useAttendanceStatus(openDays = [], closedDates = []) {
  const [day, setDay] = useState(() => sessionStorage.getItem("attendance_day") || null);

  const [hour, setHour] = useState(() => sessionStorage.getItem("attendance_hour") || "08:00");

  const dayKeys = openDays.length > 0 ? openDays : DEFAULT_DAY_KEYS;
  const effectiveDay = day && dayKeys.includes(day) ? day : defaultDayFor(dayKeys);

  function cacheKey(d, h) {
    return `attendance-status-${d}-${h}`;
  }

  const [members, setMembers] = useState(() => getCached(cacheKey(effectiveDay, hour)) || []);

  const [loading, setLoading] = useState(() => !isCacheFresh(cacheKey(effectiveDay, hour), TTL));

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  function handleSetDay(newDay) {
    setDay(newDay);
    sessionStorage.setItem("attendance_day", newDay);
  }

  function handleSetHour(newHour) {
    setHour(newHour);
    sessionStorage.setItem("attendance_hour", newHour);
  }

  useEffect(() => {
    if (effectiveDay) loadStatus();
  }, [effectiveDay, hour]);

  async function loadStatus(forceRefresh = false) {
    const key = cacheKey(effectiveDay, hour);
    if (!forceRefresh && isCacheFresh(key, TTL)) {
      setMembers(getCached(key));
      setLoading(false);
      setError(null);
      setRefreshing(true);
      try {
        const data = await getAttendanceStatus(effectiveDay, hour);
        setMembers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setRefreshing(false);
      }
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const data = await getAttendanceStatus(
        effectiveDay,
        hour,
      );

      setMembers(data);
    } catch (err) {
      console.error("ERROR REGISTER:", err);

      setError(
        err.message ||
        "Error registrando asistencia",
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(
    scheduleId,
  ) {
    try {
      await registerAttendance(
        scheduleId,
      );

      await loadStatus(true);
    } catch (err) {
      console.error(err);

      toast.error(
        err.message || "Error registrando asistencia",
      );
    }
  }

  const isTodayOpen = openDays.length > 0 && openDays.includes(todayKey());
  const isTodayClosed = new Set(closedDates).has(todayStr());

  return {
    day: effectiveDay,
    setDay: handleSetDay,
    hour,
    setHour: handleSetHour,
    members,
    loading,
    refreshing,
    error,
    markAttendance,
    reload: () => loadStatus(true),
    isTodayClosed,
    canRegister: isTodayOpen && effectiveDay === todayKey() && !isTodayClosed,
  };
}