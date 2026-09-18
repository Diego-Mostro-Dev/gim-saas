function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

function fmtMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(hhmm, minutes) {
  return fmtMinutes(toMinutes(hhmm) + minutes);
}

export function isFree(intervals, start, end) {
  if (!intervals || !intervals.length || !start || !end) return false;
  const s = toMinutes(start);
  const e = toMinutes(end);
  return intervals.some((iv) => s >= toMinutes(iv.start_time) && e <= toMinutes(iv.end_time));
}

export function startHoursFor(intervals) {
  if (!intervals || !intervals.length) return [];
  return intervals.flatMap((iv) => {
    const start = toMinutes(iv.start_time);
    const end = toMinutes(iv.end_time);
    const out = [];
    for (let h = start; h + 60 <= end; h += 60) out.push(fmtMinutes(h));
    return out;
  });
}

export function endHoursFor(intervals, start) {
  if (!intervals || !intervals.length || !start) return [];
  const s = toMinutes(start);
  return intervals.flatMap((iv) => {
    const startIv = toMinutes(iv.start_time);
    const endIv = toMinutes(iv.end_time);
    if (s < startIv || s >= endIv) return [];
    const out = [];
    for (let e = s + 60; e <= endIv; e += 60) out.push(fmtMinutes(e));
    return out;
  });
}

export function firstFreeStart(intervals) {
  const options = startHoursFor(intervals);
  return options[0] || "";
}

export function firstFreeEnd(intervals, start) {
  const options = endHoursFor(intervals, start);
  return options[0] || "";
}

export function dayIntervals(freeData, day) {
  if (!freeData || !freeData.days || !freeData.days[day]) return [];
  return freeData.days[day] || [];
}

export function reconcileSlot(freeData, day, start, end) {
  const intervals = dayIntervals(freeData, day);
  if (isFree(intervals, start, end)) return { start, end };
  const nextStart = firstFreeStart(intervals);
  const nextEnd = nextStart ? firstFreeEnd(intervals, nextStart) : "";
  return { start: nextStart, end: nextEnd };
}