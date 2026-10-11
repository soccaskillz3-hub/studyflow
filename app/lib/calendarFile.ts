// Reads classes from a calendar file (.ics), which many schools' portals and calendar apps can
// export. Each weekly repeating event becomes a class, on the days and between the dates it
// repeats; a one-off event that names a course (a midterm, say) becomes a class on that day.

import {courseFromText, type Meeting, type ParseResult} from "./classSchedule";

const DAY_CODES: Record<string, number> = {SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6};

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Field = {params: string; value: string};

// A date-time as the class's own wall clock. Times in UTC ("...Z") are moved into this
// browser's time zone; times with a TZID, or none, are already local to the school.
function readDateTime(field: Field | undefined): Date | null {
  const m = field?.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec = "0", utc] = m;
  if (h === undefined) return null; // an all-day event: no class times
  return utc
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec))
    : new Date(+y, +mo - 1, +d, +h, +mi, +sec);
}

// "PT1H20M" -> minutes.
function readDuration(value: string | undefined) {
  const m = value?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  return (+(m[1] ?? 0) * 24 + +(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
}

const unescape = (text: string) => text.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

export function isCalendarFile(text: string) {
  return /BEGIN:VCALENDAR/i.test(text) && /BEGIN:VEVENT/i.test(text);
}

export function parseCalendarFile(text: string): ParseResult {
  // Long lines are folded onto the next one, starting with a space.
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const meetings: Meeting[] = [];

  for (const [, body] of unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/gi)) {
    const fields: Record<string, Field> = {};
    for (const line of body.split(/\r?\n/)) {
      const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/i);
      if (m && !fields[m[1].toUpperCase()]) fields[m[1].toUpperCase()] = {params: m[2], value: m[3]};
    }
    // Skip cancelled events, and changes to single occurrences of a repeating one.
    if (fields.STATUS?.value.toUpperCase() === "CANCELLED" || fields["RECURRENCE-ID"]) continue;

    const start = readDateTime(fields.DTSTART);
    if (!start) continue;
    const end = readDateTime(fields.DTEND) ?? new Date(start.getTime() + (readDuration(fields.DURATION?.value) ?? 0) * 60_000);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (minutes <= 0 || minutes > 12 * 60 || isoDay(start) !== isoDay(end)) continue;

    const summary = unescape(fields.SUMMARY?.value ?? "");
    const course = courseFromText(summary);
    const rule = Object.fromEntries(
      (fields.RRULE?.value ?? "").split(";").map((part) => part.split("=") as [string, string]),
    );
    const weekly = rule.FREQ?.toUpperCase() === "WEEKLY";
    // A one-off event only counts if it names a course; otherwise it's not a class.
    if (!weekly && !course.code) continue;

    let days = [start.getDay()];
    let endsOn = isoDay(start);
    if (weekly) {
      const byDay = (rule.BYDAY ?? "")
        .split(",")
        .map((d) => DAY_CODES[d.replace(/^[+-]?\d+/, "").toUpperCase()])
        .filter((d) => d !== undefined);
      if (byDay.length) days = [...new Set(byDay)].sort((a, b) => a - b);
      const until = readDateTime({params: "", value: rule.UNTIL?.length === 8 ? `${rule.UNTIL}T000000` : (rule.UNTIL ?? "")});
      if (until) endsOn = isoDay(until);
      else if (rule.COUNT) {
        // Walk forward to the last of COUNT meetings.
        const d = new Date(start);
        for (let left = +rule.COUNT; left > 0; d.setDate(d.getDate() + 1)) {
          if (days.includes(d.getDay())) {
            left--;
            endsOn = isoDay(d);
          }
        }
      } else endsOn = "";
    }

    meetings.push({
      code: (course.code || summary || "Class").slice(0, 20),
      title: course.code ? course.title : summary.length > 20 ? summary.slice(0, 120) : "",
      component: course.component,
      days,
      start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      location: unescape(fields.LOCATION?.value ?? "").slice(0, 100),
      startsOn: isoDay(start),
      endsOn: endsOn || null,
    });
  }

  // The same class can come once per section or term; keep one of each.
  const unique = new Map(meetings.map((m) => [[m.code, m.component, m.days.join(""), m.start, m.end, m.location, m.startsOn, m.endsOn].join("|"), m]));
  return {meetings: [...unique.values()], coursesWithoutTimes: []};
}
