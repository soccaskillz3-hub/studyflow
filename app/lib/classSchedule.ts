// Reads a class schedule pasted from a student portal (Waterloo Quest's list view, TMU's
// MyServiceHub and other PeopleSoft systems, York's timetables, or a plain list like
// "CS 135 LEC MWF 10:30-11:20 MC 2065") and finds each weekly meeting: course, component, days,
// times, room and the dates it runs between.
//
// Copying a web table can put each cell on its own line or a whole row on one, so the parser
// doesn't rely on layout. It looks for days + times, either a range ("MWF 10:30AM - 11:20AM") or
// a start and a length in minutes ("M 13:00 80", as York lists them), and takes the course and
// component from what came before them, and the room and dates from what follows.

export type Meeting = {
  code: string; // "CS 135"
  title: string; // "Designing Functional Programs", or "" if the paste didn't include one
  component: string; // "LEC", "TUT", ... or "" if unknown
  days: number[]; // 0 = Sunday ... 6 = Saturday, as Date.getDay()
  start: string; // "HH:MM", 24-hour
  end: string;
  location: string;
  startsOn: string | null; // "YYYY-MM-DD", first day it meets; null if not given
  endsOn: string | null;
};

export type ParseResult = {
  meetings: Meeting[];
  // Course codes found with no class times anywhere, e.g. from a transcript or a course list.
  coursesWithoutTimes: string[];
};

export const COMPONENTS: Record<string, string> = {
  LEC: "Lecture",
  TUT: "Tutorial",
  LAB: "Lab",
  SEM: "Seminar",
  TST: "Test",
  DIS: "Discussion",
  REC: "Recitation",
  PRA: "Practicum",
  STU: "Studio",
  CLN: "Clinic",
  WRK: "Work term",
  ENS: "Ensemble",
  FLD: "Field studies",
  RDG: "Reading",
  PRJ: "Project",
  OLN: "Online",
};

// Other schools' codes for the same components: York writes LECT, TUTR, SEMR and so on.
const COMPONENT_ALIASES: Record<string, string> = {
  LECT: "LEC",
  BLEN: "LEC", // York: blended (part online) lecture
  TUTR: "TUT",
  SEMR: "SEM",
  LABR: "LAB",
  STDO: "STU",
  PRAC: "PRA",
  ONLN: "OLN",
  CLIN: "CLN",
};

// LEC, or what another school calls it (LECT -> LEC); undefined if it isn't a component code.
const componentCode = (word: string) => (COMPONENTS[word] ? word : COMPONENT_ALIASES[word]);

const COMPONENT_WORDS: Record<string, string> = {
  lecture: "LEC",
  tutorial: "TUT",
  laboratory: "LAB",
  lab: "LAB",
  seminar: "SEM",
  test: "TST",
  exam: "TST",
  midterm: "TST",
  discussion: "DIS",
  recitation: "REC",
  studio: "STU",
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Day abbreviations, longest first so "Th" wins over "T" and "Thursday" over "Th".
const DAY_TOKENS: [string, number][] = [
  ["wednesday", 3], ["thursday", 4], ["saturday", 6], ["tuesday", 2], ["monday", 1], ["friday", 5], ["sunday", 0],
  ["thurs", 4], ["tues", 2],
  ["mon", 1], ["tue", 2], ["wed", 3], ["thu", 4], ["fri", 5], ["sat", 6], ["sun", 0],
  ["mo", 1], ["tu", 2], ["we", 3], ["th", 4], ["fr", 5], ["sa", 6], ["su", 0],
  ["m", 1], ["t", 2], ["w", 3], ["r", 4], ["f", 5], ["s", 6], ["u", 0],
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// 10:30AM, 10:30 a.m., 2pm, 14:00
const TIME = String.raw`(\d{1,2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m\b\.?)?`;
const TIME_RANGE = new RegExp(String.raw`(?<![\d/:.])${TIME}\s*(?:-|to)\s*${TIME}`, "gi");
// 13:00 80, or 1:00PM 80 min: a start time and a length in minutes.
const START_AND_LENGTH = new RegExp(
  String.raw`(?<![\d/:.])(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s*m\b\.?)?\s+(\d{2,3})(?:\s*min(?:ute)?s?\b\.?)?(?![\d:/.])`,
  "gi",
);
const NEEDS_MINUTES_OR_MERIDIEM = /:\d{2}|[ap]\.?\s*m/i;

// CS 135, MATH 137, CS 136L, ECE 105, PD 1. Rooms (MC 2065) look the same; context decides.
const CODE = /\b([A-Z]{2,6})\s?(\d{1,4}[A-Z]{0,2})\b(?!:)/g;
// A room on a line of its own: "MC 2065", "TRS 1-067", "ENG LG14", "SLH D".
const CODE_ONLY_LINE = /^(?:[A-Z]{1,6}\d?\s?[A-Z]{0,3}\d{1,4}[A-Z]{0,2}(?:-\d{1,4}[A-Z]?)?|[A-Z]{2,5}\s[A-Z])$/;

const DATE_PATTERNS: [RegExp, (m: RegExpMatchArray) => string | null][] = [
  // 2025-09-08 or 2025/09/08
  [/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g, (m) => isoDate(+m[1], +m[2], +m[3])],
  // 09/08/2025 (month first, as Quest shows it) or 28/09/2025 when the first number can't be a month
  [/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m) => (+m[1] > 12 ? isoDate(+m[3], +m[2], +m[1]) : isoDate(+m[3], +m[1], +m[2]))],
  // Sep 8, 2025
  [/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g, (m) => monthDate(m[1], +m[2], +m[3])],
  // 8 Sep 2025
  [/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g, (m) => monthDate(m[2], +m[1], +m[3])],
];

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function monthDate(name: string, d: number, y: number) {
  const m = MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  return m === -1 ? null : isoDate(y, m + 1, d);
}

// Every date on a line, in order.
function findDates(line: string) {
  const found: {index: number; date: string}[] = [];
  for (const [pattern, toDate] of DATE_PATTERNS) {
    for (const m of line.matchAll(pattern)) {
      const date = toDate(m);
      if (date && !found.some((f) => Math.abs(f.index - m.index!) < 4)) found.push({index: m.index!, date});
    }
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.date);
}

// "MWF", "TTh", "MoWeFr", "Tue" -> day numbers, or null if the word isn't made only of days.
function parseDayWord(word: string): number[] | null {
  // "TUT" would otherwise read as Tue, Sun, Tue (and York's "TUTR" as Tue, Sun, Tue, Thu).
  if (componentCode(word.toUpperCase()) || COMPONENT_WORDS[word.toLowerCase()]) return null;
  let rest = word.toLowerCase();
  const days: number[] = [];
  while (rest) {
    const token = DAY_TOKENS.find(([t]) => rest.startsWith(t));
    if (!token) return null;
    days.push(token[1]);
    rest = rest.slice(token[0].length);
  }
  return days.length ? days : null;
}

// Day words at the end (or start) of a stretch of text: "001 LEC MWF" -> Mon, Wed, Fri.
function takeDays(text: string, fromEnd: boolean) {
  const words = text.split(/[\s,/&+]+/).filter(Boolean);
  if (fromEnd) words.reverse();
  const days = new Set<number>();
  let used = 0;
  for (const word of words) {
    const parsed = parseDayWord(word);
    if (!parsed) break;
    parsed.forEach((d) => days.add(d));
    used++;
  }
  return {days: [...days].sort((a, b) => a - b), used};
}

function to24(hour: number, minute: number, meridiem: string | undefined) {
  if (hour > 23 || minute > 59) return null;
  if (!meridiem) return hour * 60 + minute;
  if (hour < 1 || hour > 12) return null;
  const pm = meridiem.toLowerCase() === "p";
  return ((hour % 12) + (pm ? 12 : 0)) * 60 + minute;
}

// Start and end in minutes, filling in a missing AM/PM the way timetables are usually written.
function parseRange(m: RegExpMatchArray) {
  const [, h1, m1 = "0", ap1, h2, m2 = "0", ap2] = m;
  const startText = m[0].split(/-|to/i)[0];
  const endText = m[0].slice(startText.length);
  if (!NEEDS_MINUTES_OR_MERIDIEM.test(startText) && !NEEDS_MINUTES_OR_MERIDIEM.test(endText)) return null;

  let end = to24(+h2, +m2, ap2);
  let start = to24(+h1, +m1, ap1 ?? ap2);
  // "11:30-12:20PM": carrying PM back to the start would put it after the end.
  if (start !== null && end !== null && !ap1 && ap2 && start > end) {
    start = to24(+h1, +m1, ap2.toLowerCase() === "p" ? "a" : "p");
  }
  if (start === null || end === null) return null;
  // No AM/PM at all: nobody has class at 2 AM, so early hours are afternoon.
  if (!ap1 && !ap2) {
    if (+h1 < 8) start += 12 * 60;
    if (+h2 < 8 || (end < start && +h2 < 12)) end += 12 * 60;
  }
  if (end <= start || end > 24 * 60) return null;
  return {start, end};
}

// The class times on a line: a range ("10:30AM - 11:20AM"), or else a start and a length in
// minutes ("13:00 80"). The length must be a plausible class (20 minutes to 8 hours, in steps
// of 5), so other numbers after a time aren't read as one.
function findTimes(line: string) {
  for (const m of line.matchAll(TIME_RANGE)) {
    const times = parseRange(m);
    if (times) return {index: m.index!, length: m[0].length, ...times};
  }
  for (const m of line.matchAll(START_AND_LENGTH)) {
    const [, h, min, meridiem, length] = m;
    if (+length < 20 || +length > 480 || +length % 5) continue;
    let start = to24(+h, +min, meridiem);
    if (start === null) continue;
    if (!meridiem && +h < 8) start += 12 * 60; // as above: nobody has class at 2 AM
    if (start + +length > 24 * 60) continue;
    return {index: m.index!, length: m[0].length, start, end: start + +length};
  }
  return null;
}

const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

function findComponent(text: string) {
  for (const word of text.split(/[^A-Za-z]+/)) {
    const code = componentCode(word);
    if (code) return code;
    const named = COMPONENT_WORDS[word.toLowerCase()];
    if (named && word.length >= 3) return named;
  }
  return "";
}

// Course codes in a stretch of text, skipping component + section pairs like "LEC 001".
function findCodes(text: string) {
  return [...text.matchAll(CODE)]
    .filter((m) => !componentCode(m[1]))
    .map((m) => ({code: `${m[1]} ${m[2]}`, index: m.index!, end: m.index! + m[0].length}));
}

// A course title after its code: "CS 135 - Designing Functional Programs". Stops at a
// component ("Lecture") or section number, which aren't part of the title.
function titleAfter(text: string) {
  // York puts the credits first: "EECS 1012 3.00 Net-centric Introduction to Computing".
  const words = text.replace(/^\s*[-–—:|]?\s*\d{1,2}\.\d{2}\b/, "").split(/\s+/);
  const stop = words.findIndex((w) => componentCode(w) || COMPONENT_WORDS[w.toLowerCase()] || /^\d{3}$/.test(w));
  const title = (stop === -1 ? words : words.slice(0, stop))
    .join(" ")
    .replace(/^\s*[-–—:|]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[a-z]{3}/.test(title) || /^\d/.test(title)) return "";
  return title.slice(0, 120);
}

// A room right after the time: "MC 2065", "E7 4053", "TRS 1-067", "ENG LG14", "SLH D",
// "Science Hall 120", "Online", "TBA".
function findLocation(text: string) {
  const trimmed = text.replace(/^[\s\-|,]+/, "").replace(/^(?:room|location|where)\b\s*[:#]?\s*/i, "");
  const room = trimmed.match(/^([A-Z]{1,6}\d?\s?[A-Z]{0,3}\d{1,4}[A-Z]?(?:-\d{1,4}[A-Z]?)?)\b/);
  if (room) return room[1];
  // York's lecture halls are a building and a letter: "SLH D", "CLH A".
  const hall = trimmed.match(/^([A-Z]{2,5}\s[A-Z])(?=\s|$)/);
  if (hall) return hall[1];
  const named = trimmed.match(/^(online|tba|remote|virtual)\b/i);
  if (named) return named[1].toUpperCase() === "TBA" ? "TBA" : capitalize(named[1]);
  const building = trimmed.match(/^((?:[A-Z][A-Za-z.'&]*\s+){1,4}\d{1,4}[A-Z]?)\b(?![/\d])/);
  return building ? building[1].trim() : "";
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// The course named in a short piece of text, such as a calendar event's title ("CPS 109 -
// Lecture", "AP/EECS 1012 LAB 01"): its code, title and component, as far as they're there.
export function courseFromText(text: string) {
  const clean = text.replace(/\b[A-Z]{2}\/(?=[A-Z]{2,6}\s?\d)/g, "");
  const codes = findCodes(clean);
  const component = findComponent(clean);
  if (!codes.length) return {code: "", title: "", component};
  return {code: codes[0].code, title: titleAfter(clean.slice(codes[0].end)), component};
}

export function parseSchedule(input: string): ParseResult {
  const lines = input
    .replace(/[‐-―−]/g, "-")
    // York's faculty prefix: "AP/POLS 1000" is POLS 1000.
    .replace(/\b[A-Z]{2}\/(?=[A-Z]{2,6}\s?\d)/g, "")
    .replace(/ /g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/\t+/g, "  ").trim());

  const meetings: Meeting[] = [];
  const codesSeen = new Set<string>();
  let course = {code: "", title: ""};
  let component = "";
  // Meetings still waiting for their room or dates, which come after the times.
  let open: Meeting[] = [];
  let roomSlot: Meeting | null = null;

  for (const line of lines) {
    if (!line) continue;
    const times = findTimes(line);
    if (times) {
      const before = line.slice(0, times.index);
      let after = line.slice(times.index + times.length);
      let {days} = takeDays(before, true);
      let daysEndAt = before.length;
      if (days.length) {
        // Cut the day words off the end of `before`, so they aren't read as part of a code.
        const words = before.trimEnd().split(/([\s,/&+]+)/);
        let keep = words.length;
        while (keep > 0 && (parseDayWord(words[keep - 1]) || /^[\s,/&+]*$/.test(words[keep - 1]))) keep--;
        daysEndAt = words.slice(0, keep).join("").length;
      } else {
        // Days after the times instead ("10:30-11:20 MWF"): read them, then skip past them.
        const found = takeDays(after, false);
        days = found.days;
        after = after.trimStart().split(/[\s,/&+]+/).slice(found.used).join(" ");
      }
      if (!days.length) continue; // a time with no days, e.g. an exam slot or office hours note

      const lead = before.slice(0, daysEndAt);
      const codes = findCodes(lead);
      if (codes.length) {
        const last = codes[codes.length - 1];
        course = {code: last.code, title: titleAfter(lead.slice(last.end))};
        codesSeen.add(last.code);
        component = "";
      }
      component = findComponent(lead) || component;
      if (!course.code) continue;

      const dates = findDates(after);
      const meeting: Meeting = {
        code: course.code,
        title: course.title,
        component,
        days,
        start: hhmm(times.start),
        end: hhmm(times.end),
        location: findLocation(after),
        startsOn: dates[0] ?? null,
        endsOn: dates[1] ?? dates[0] ?? null,
      };
      meetings.push(meeting);
      open = dates.length ? [] : [...open, meeting];
      roomSlot = meeting.location ? null : meeting;
      continue;
    }

    const dates = findDates(line);
    if (dates.length && open.length) {
      for (const m of open) {
        m.startsOn = dates[0];
        m.endsOn = dates[1] ?? dates[0];
      }
      open = [];
      roomSlot = null;
      continue;
    }

    // A room on its own line, straight after its meeting's times.
    if (roomSlot && (CODE_ONLY_LINE.test(line) || /^(online|tba|remote|virtual)$/i.test(line))) {
      roomSlot.location = findLocation(line);
      roomSlot = null;
      continue;
    }

    const componentOnly = componentCode(line) ?? COMPONENT_WORDS[line.toLowerCase()];
    if (componentOnly) {
      component = componentOnly;
      roomSlot = null;
      continue;
    }

    const codes = findCodes(line);
    // A course starts the line, or follows a label: "Course: BIO 1100 - Cell Biology".
    const label = codes.length ? line.slice(0, codes[0].index) : "";
    if (codes.length && (codes[0].index < 3 || /^(?:course|class|subject)(?:\s+code)?\s*[:#-]?\s*$/i.test(label))) {
      course = {code: codes[0].code, title: titleAfter(line.slice(codes[0].end))};
      codesSeen.add(codes[0].code);
      component = findComponent(line.slice(codes[0].end)) || "";
      open = [];
      roomSlot = null;
    } else if (codes.length) {
      codes.forEach((c) => codesSeen.add(c.code));
    }
  }

  // The same meeting pasted twice (or listed once per week) only needs to be added once, and
  // one listed a row per day (York: LECT01 on M, then again on F) is one meeting on both days.
  const unique = new Map<string, Meeting>();
  for (const m of meetings) {
    const key = [m.code, m.component, m.start, m.end, m.location, m.startsOn, m.endsOn].join("|");
    const same = unique.get(key);
    if (!same) unique.set(key, m);
    else same.days = [...new Set([...same.days, ...m.days])].sort((a, b) => a - b);
  }

  const withTimes = new Set(meetings.map((m) => m.code));
  return {
    meetings: [...unique.values()],
    coursesWithoutTimes: [...codesSeen].filter((c) => !withTimes.has(c)),
  };
}

// "Mon Wed Fri", or "Weekdays" for all five.
export function describeDays(days: number[]) {
  if (days.join("") === "12345") return "Weekdays";
  return days.map((d) => DAY_NAMES[d]).join(" ");
}
