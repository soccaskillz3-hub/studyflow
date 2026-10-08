"use client";

import {useState} from "react";
import SectionLabel from "../../../components/SectionLabel";
import {describeDays, parseSchedule, type Meeting, type ParseResult} from "../../../lib/classSchedule";
import {useClasses, type ClassMeeting} from "../../../lib/classes";
import {formatTime} from "../../../lib/time";

const EXAMPLE = `CS 135 - Designing Functional Programs
5873  001  LEC  MWF 10:30AM - 11:20AM  MC 2065  09/08/2025 - 12/02/2025
5880  102  TUT  F 2:30PM - 3:20PM  MC 4021  09/08/2025 - 12/02/2025
MATH 137  LEC  TTh 1:00PM - 2:20PM  RCH 101`;

const button =
  "border border-scene/70 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15 active:scale-[0.98] disabled:opacity-50";
const quiet = "text-xs uppercase tracking-[0.25em] text-white/60 transition hover:text-white";
const dateInput =
  "border-b border-white/30 bg-transparent px-1 py-1.5 text-sm text-white outline-none transition focus:border-scene [color-scheme:dark]";

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

  const read = () => {
    setResult(parseSchedule(text));
    setSkipped(new Set());
    setMessage(null);
  };

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
        Copy your class schedule from your school&apos;s portal and paste it below. On Waterloo Quest, open{" "}
        <span className="text-white">Class Schedule</span>, choose <span className="text-white">List View</span>, then
        select everything on the page (⌘A or Ctrl+A) and copy.
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={8}
        placeholder={EXAMPLE}
        aria-label="Your class schedule"
        spellCheck={false}
        className="mt-5 w-full resize-y rounded-md border border-white/25 bg-slate-950/30 p-3 text-xs leading-relaxed text-white outline-none backdrop-blur-sm transition placeholder:text-white/35 focus:border-scene [text-shadow:none]"
      />
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-xs text-white/50">Only what you paste is read. Nothing is saved until you add it.</p>
        <button type="button" onClick={read} disabled={!text.trim()} className={button}>
          Find classes
        </button>
      </div>

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
              11:20AM&rdquo;.
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
                <input type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} aria-label="First day of classes" className={dateInput} />
                <span>to</span>
                <input type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} aria-label="Last day of classes" className={dateInput} />
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

      <section className="mt-16">
        <SectionLabel>Your classes</SectionLabel>
        <div className="mt-6">
          <YourClasses />
        </div>
      </section>
    </>
  );
}
