// Times are "HH:MM" strings on a 24-hour clock, e.g. "16:30".

const pad = (n: number) => String(n).padStart(2, "0");

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number) {
  const clamped = Math.min(Math.max(total, 0), 23 * 60 + 55);
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(m)} ${suffix}`;
}

export function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// 12-hour parts <-> "HH:MM", for the time picker's hour / minute / AM-PM columns.
export function toParts(time: string) {
  const [h, m] = time.split(":").map(Number);
  return {hour12: h % 12 === 0 ? 12 : h % 12, minute: m, pm: h >= 12};
}

export function fromParts(hour12: number, minute: number, pm: boolean) {
  return `${pad((hour12 % 12) + (pm ? 12 : 0))}:${pad(minute)}`;
}

// Minutes since midnight, local time.
export function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

// Hour of the day (0–24) as a short label, e.g. 13 -> "1 PM".
export function formatHour(hour: number) {
  const h = hour % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
}
