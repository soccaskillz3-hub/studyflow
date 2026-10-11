"use client";

import {useRef, useState, type ReactNode} from "react";
import DatePicker from "../../components/DatePicker";
import SectionLabel from "../../components/SectionLabel";
import {isCalendarFile, parseCalendarFile} from "../../lib/calendarFile";
import {describeDays, parseSchedule, type Meeting, type ParseResult} from "../../lib/classSchedule";
import {useClasses, type ClassMeeting} from "../../lib/classes";
import {formatTime} from "../../lib/time";

const EXAMPLE = `CS 135 - Designing Functional Programs
5873  001  LEC  MWF 10:30AM - 11:20AM  MC 2065  09/08/2025 - 12/02/2025
5880  102  TUT  F 2:30PM - 3:20PM  MC 4021  09/08/2025 - 12/02/2025
MATH 137  LEC  TTh 1:00PM - 2:20PM  RCH 101`;

// Where to find your schedule, school by school. Anything else falls back to the general steps,
// a calendar file, or the AI helper.
const SCHOOLS: {id: string; name: string; example?: string; steps: ReactNode}[] = [
  {
    id: "waterloo",
    name: "Waterloo",
    steps: (
      <>
        On Quest, open <b className="font-normal text-white">Class Schedule</b> and choose{" "}
        <b className="font-normal text-white">List View</b>. Then select everything on the page (⌘A or Ctrl+A) and copy.
      </>
    ),
  },
  {
    id: "tmu",
    name: "TMU",
    example: `CPS 109 - Computer Science I
1234  011  Lecture  Mo 10:00AM - 11:50AM  KHE 225  Staff  09/08/2026 - 12/08/2026
1240  031  Laboratory  We 2:00PM - 3:50PM  ENG LG14  Staff  09/08/2026 - 12/08/2026`,
    steps: (
      <>
        On MyServiceHub, go to <b className="font-normal text-white">Manage Classes</b> →{" "}
        <b className="font-normal text-white">View My Classes</b> (the list, not My Weekly Schedule). Then select everything
        on the page (⌘A or Ctrl+A) and copy.
      </>
    ),
  },
  {
    id: "york",
    name: "York",
    example: `AP/ECON 1000 3.00 Introduction to Microeconomics
LECT 01  M  13:00  80  ACW 206  Keele
TUTR 01  F  11:30  50  SLH D  Keele`,
    steps: (
      <>
        On York&apos;s course timetables, copy each of your courses: the line with its code (like AP/ECON 1000 3.00) and the
        rows for your sections, with their <b className="font-normal text-white">Type, Day, Start Time, Duration</b> and{" "}
        <b className="font-normal text-white">Location</b>. If your schedule only shows as a calendar, use your AI below.
      </>
    ),
  },
  {
    id: "other",
    name: "Another school",
    steps: (
      <>
        Open your class schedule in your school&apos;s portal (a list view works best), select everything on the page (⌘A or
        Ctrl+A) and copy. If you can download it as a calendar file (.ics), upload that instead. Or let your AI do it, below.
      </>
    ),
  },
];

// For the AI helper: turns any schedule, even a screenshot, into lines the importer reads.
const AI_PROMPT = `Turn my class schedule into a list I can import into Zeflo. Write one line per weekly class meeting, in exactly this format, and nothing else:

COURSE TYPE DAYS START-END ROOM FIRST_DAY to LAST_DAY

- COURSE: the course code, like CPS 109
- TYPE: LEC, TUT, LAB or SEM (or TST for a test or exam)
- DAYS: the days it meets, like Mon Wed
- START-END: 12-hour times with AM/PM, like 10:00AM-11:50AM
- ROOM: the room, like KHE 225 (or Online, or TBA)
- FIRST_DAY to LAST_DAY: the first and last day it meets, as YYYY-MM-DD (leave this out if you don't know)

For example:
CPS 109 LEC Mon Wed 10:00AM-11:50AM KHE 225 2026-09-08 to 2026-12-08
CPS 109 LAB Fri 8:00AM-9:50AM ENG LG14 2026-09-08 to 2026-12-08

Here's my schedule:`;

const button =
  "border border-scene/70 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15 active:scale-[0.98] disabled:opacity-50";
const quiet = "text-xs uppercase tracking-[0.25em] text-white/60 transition hover:text-white";

function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {month: "short", day: "numeric"});
}

function describeDates(m: Meeting) {
  if (!m.startsOn && !m.endsOn) return "Every week";
  if (m.startsOn === m.endsOn) return `Only ${formatDay(m.startsOn!)}`;
  return `${m.startsOn ? formatDay(m.startsOn) : "…"} – ${m.endsOn ? formatDay(m.endsOn) : "…"}`;
}

// One meeting as a row: course and component, days and times, room and dates.
function MeetingRow({meeting, showCode = true}: {meeting: Meeting; showCode?: boolean}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-5">
      {showCode && (
        <span className="w-28 shrink-0 truncate text-white">
          {meeting.code}
          {meeting.component && <span className="ml-2 text-xs text-white/60">{meeting.component}</span>}
        </span>
      )}
      {!showCode && <span className="w-12 shrink-0 text-xs text-white/60">{meeting.component || "Class"}</span>}
      <span className="shrink-0 text-sm text-scene-soft tabular-nums sm:w-72 sm:whitespace-nowrap">
        {describeDays(meeting.days)} · {formatTime(meeting.start)} – {formatTime(meeting.end)}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-white/60">
        {[meeting.location, describeDates(meeting)].filter(Boolean).join(" · ")}
      </span>
    </span>
  );
}

function Importer() {
  const {addMeetings} = useClasses();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{text: string; error?: boolean} | null>(null);
  const [school, setSchool] = useState("");
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  // Show what was found. From a calendar file, events that don't name a course (the gym, a
  // weekly call) start unticked: they're probably not classes.
  const show = (found: ParseResult, fromCalendar: boolean) => {
    setResult(found);
    setSkipped(new Set(fromCalendar ? found.meetings.flatMap((m, i) => (/\d/.test(m.code) ? [] : [i])) : []));
    setMessage(null);
  };

  const read = () => (isCalendarFile(text) ? show(parseCalendarFile(text), true) : show(parseSchedule(text), false));

  const upload = async (chosen: File | undefined) => {
    if (!chosen) return;
    if (chosen.size > 5_000_000) return setMessage({text: "That file is too big to be a class schedule.", error: true});
    const contents = await chosen.text();
    if (!isCalendarFile(contents)) {
      return setMessage({text: "That doesn't look like a calendar file. It should end in .ics.", error: true});
    }
    show(parseCalendarFile(contents), true);
  };

  // If the browser won't allow copying, the prompt is selected instead, ready for ⌘C.
  const promptBox = useRef<HTMLTextAreaElement>(null);
  const copyPrompt = () =>
    navigator.clipboard.writeText(AI_PROMPT).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => promptBox.current?.select(),
    );

  const chosen = result ? result.meetings.filter((_, i) => !skipped.has(i)) : [];
  const undated = chosen.some((m) => !m.startsOn && !m.endsOn);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Classes the paste gave no dates for run between the term dates, if those were filled in.
      const meetings = chosen.map((m) =>
        m.startsOn || m.endsOn ? m : {...m, startsOn: termStart || null, endsOn: termEnd || null},
      );
      const added = await addMeetings(meetings);
      setMessage({
        text:
          added === 0
            ? "Those classes are already on your calendar."
            : `Added ${added} ${added === 1 ? "class" : "classes"} to your calendar.`,
      });
      setText("");
      setResult(null);
    } catch {
      setMessage({text: "Couldn't save your classes. Check your connection and try again.", error: true});
    }
    setSaving(false);
  };

  return (
    <>
      <p className="max-w-2xl text-sm leading-relaxed text-white/75">
        Copy your class schedule from your school&apos;s portal and paste it below. Where do you go?
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Your school">
        {SCHOOLS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={school === s.id}
            onClick={() => setSchool(school === s.id ? "" : s.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              school === s.id ? "border-scene/70 bg-scene/15 text-white" : "border-white/20 text-white/70 hover:border-white/40 hover:text-white"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
      {school && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">{SCHOOLS.find((s) => s.id === school)?.steps}</p>
      )}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={8}
        placeholder={SCHOOLS.find((s) => s.id === school)?.example ?? EXAMPLE}
        aria-label="Your class schedule"
        spellCheck={false}
        className="mt-5 w-full resize-y rounded-md border border-white/25 bg-slate-950/30 p-3 text-xs leading-relaxed text-white outline-none backdrop-blur-sm transition placeholder:text-white/35 focus:border-scene [text-shadow:none]"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-white/50">
          Only what you paste is read. Nothing is saved until you add it.{" "}
          <button type="button" onClick={() => file.current?.click()} className="text-white/70 underline decoration-white/30 underline-offset-4 transition hover:text-white">
            Or upload a calendar file (.ics)
          </button>
          <input
            ref={file}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = ""; // so choosing the same file again still reads it
            }}
          />
        </p>
        <button type="button" onClick={read} disabled={!text.trim()} className={button}>
          Find classes
        </button>
      </div>

      <details className="group mt-6 max-w-2xl rounded-xl border border-scene/30 bg-scene/[0.06] [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm text-white/85">
          <span className="text-scene-ink" aria-hidden>
            ✦
          </span>
          <span className="flex-1">Portal looks different? Let your AI read it.</span>
          <span className="text-white/50 transition group-open:rotate-90" aria-hidden>
            →
          </span>
        </summary>
        <div className="border-t border-scene/20 px-4 pb-4 pt-3 text-sm leading-relaxed text-white/75">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Copy the prompt below.</li>
            <li>
              Paste it into ChatGPT, Claude or any AI, then add your schedule: paste the text, or attach a{" "}
              <span className="text-white">screenshot</span> of it.
            </li>
            <li>Copy what it writes back, paste it in the box above, and choose Find classes.</li>
          </ol>
          <textarea
            ref={promptBox}
            readOnly
            value={AI_PROMPT}
            rows={6}
            aria-label="The prompt for your AI"
            onFocus={(e) => e.currentTarget.select()}
            className="mt-4 w-full resize-y rounded-md border border-white/15 bg-slate-950/30 p-3 text-xs leading-relaxed text-white/70 outline-none [text-shadow:none] focus:border-scene"
          />
          <button type="button" onClick={copyPrompt} className={`mt-3 ${button}`}>
            {copied ? "Copied" : "Copy the prompt"}
          </button>
        </div>
      </details>

      {message && (
        <p role="status" className={`mt-5 text-sm ${message.error ? "text-rose-300" : "text-scene-soft"}`}>
          {message.text}
        </p>
      )}

      {result && result.meetings.length === 0 && (
        <div role="status" className="mt-6 border-l-2 border-amber-200/70 py-1 pl-4 text-sm leading-relaxed text-white/85">
          {result.coursesWithoutTimes.length > 0 ? (
            <>
              Found {result.coursesWithoutTimes.join(", ")}, but no class times. A transcript lists your courses and
              grades, not when they meet, so paste your class schedule instead.
            </>
          ) : (
            <>
              No classes found. Look for lines with a course, days and times, like &ldquo;CS 135 LEC MWF 10:30AM -
              11:20AM&rdquo;, or let your AI turn your schedule into those lines (just above).
            </>
          )}
        </div>
      )}

      {result && result.meetings.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/80">
            Found {result.meetings.length} {result.meetings.length === 1 ? "class" : "classes"} · untick any that are
            wrong
          </p>
          <ul className="mt-4">
            {result.meetings.map((m, i) => (
              <li key={i} className="border-b border-white/15 first:border-t">
                <label className="flex cursor-pointer items-center gap-4 py-3 pl-1">
                  <input
                    type="checkbox"
                    checked={!skipped.has(i)}
                    onChange={() =>
                      setSkipped((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className="h-3.5 w-3.5 shrink-0 accent-scene"
                  />
                  <MeetingRow meeting={m} />
                </label>
              </li>
            ))}
          </ul>

          {undated && (
            <div className="mt-6">
              <p className="text-sm text-white/75">
                Some classes didn&apos;t come with dates, so they&apos;d show every week. Add your term&apos;s first and
                last day of classes to limit them (optional):
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
                <DatePicker value={termStart} onChange={setTermStart} label="First day of classes" placeholder="First day" max={termEnd || undefined} />
                <span>to</span>
                <DatePicker value={termEnd} onChange={setTermEnd} label="Last day of classes" placeholder="Last day" min={termStart || undefined} align="right" />
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-5">
            <button type="button" onClick={() => setResult(null)} className={quiet}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving || chosen.length === 0} className={button}>
              {saving ? "Adding…" : `Add ${chosen.length} to calendar`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Imported classes grouped by course, each meeting removable, plus a way to clear them all
// (e.g. at the end of term).
function YourClasses() {
  const {classes, loaded, removeMeetings} = useClasses();
  const [confirmAll, setConfirmAll] = useState(false);
  const [error, setError] = useState("");

  if (!loaded || classes.length === 0) {
    return <p className="border-y border-white/15 py-8 text-center text-sm text-white/60">No classes yet. Paste your schedule above.</p>;
  }

  const courses = new Map<string, ClassMeeting[]>();
  for (const c of [...classes].sort((a, b) => a.code.localeCompare(b.code) || a.start.localeCompare(b.start))) {
    courses.set(c.code, [...(courses.get(c.code) ?? []), c]);
  }

  const remove = async (ids: string[]) => {
    setError("");
    try {
      await removeMeetings(ids);
    } catch {
      setError("Couldn't remove that. Please try again.");
    }
  };

  return (
    <>
      <ul>
        {[...courses].map(([code, meetings]) => (
          <li key={code} className="border-b border-white/15 py-4 first:border-t">
            <p className="text-white">
              {code}
              {meetings[0].title && <span className="ml-3 text-sm text-white/60">{meetings[0].title}</span>}
            </p>
            <ul className="mt-2">
              {meetings.map((m) => (
                <li key={m.id} className="group flex items-center gap-4 py-1.5 pl-1">
                  <MeetingRow meeting={m} showCode={false} />
                  <button
                    type="button"
                    onClick={() => remove([m.id])}
                    aria-label={`Remove ${m.code} ${m.component}`}
                    className="px-2 text-lg text-white/40 transition hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <p className="mt-4 flex justify-end gap-5">
        {confirmAll ? (
          <>
            <button type="button" onClick={() => setConfirmAll(false)} className={quiet}>
              Keep them
            </button>
            <button
              type="button"
              onClick={() => remove(classes.map((c) => c.id)).then(() => setConfirmAll(false))}
              className="text-xs uppercase tracking-[0.25em] text-rose-300 transition hover:text-rose-200"
            >
              Yes, remove all
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmAll(true)} className={quiet}>
            Remove all classes
          </button>
        )}
      </p>
    </>
  );
}

export default function ClassesPage() {
  return (
    <>
      <section className="mt-12">
        <SectionLabel>Import your classes</SectionLabel>
        <div className="mt-6">
          <Importer />
        </div>
      </section>

      <section id="your-classes" className="mt-16 scroll-mt-8">
        <SectionLabel>Your classes</SectionLabel>
        <div className="mt-6">
          <YourClasses />
        </div>
      </section>
    </>
  );
}
