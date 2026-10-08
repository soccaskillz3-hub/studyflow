// Calendar days as "YYYY-MM-DD" strings in the user's own time zone (never UTC), so a day
// means the same thing on screen as in the database.

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const isDayKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDate(value).getTime());

// Local midnight on that day.
export function toDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number) {
  const date = toDate(day);
  date.setDate(date.getDate() + n);
  return dayKey(date);
}

// The Monday of that day's week.
export function weekStart(day: string) {
  return addDays(day, -((toDate(day).getDay() + 6) % 7));
}

export const weekDays = (start: string) => Array.from({length: 7}, (_, i) => addDays(start, i));

// Every day from `from` to `to`, both included.
export function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

export const formatDay = (day: string, options: Intl.DateTimeFormatOptions) =>
  toDate(day).toLocaleDateString(undefined, options);
