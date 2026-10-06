"use client";

import {useEffect, useState, type FormEvent, type ReactNode} from "react";

type Session = {
  id: string;
  subject: string;
  start: string; // "HH:MM", 24-hour, from <input type="time">
  end: string;
  isBreak: boolean;
};

const STORAGE_KEY = "studyflow:v1";

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const sessionMinutes = (s: Session) => toMinutes(s.end) - toMinutes(s.start);

function SectionLabel({children}: {children: ReactNode}) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="shrink-0 text-[11px] uppercase tracking-[0.3em] text-white/80">{children}</h2>
      <span className="flex-1 border-t border-dashed border-white/25" />
    </div>
  );
}

// Hour ticks along the progress line: every hour, or every two for long days.
function hourTicks(planned: number) {
  if (planned === 0) return [0];
  const step = planned <= 300 ? 60 : 120;
  const ticks: number[] = [];
  for (let t = 0; t < planned; t += step) ticks.push(t);
  // Keep the end label from colliding with the last hour tick (which matters most on narrow screens).
  if (ticks.length > 1 && (planned - ticks[ticks.length - 1]) / planned < 0.18) ticks.pop();
  return [...ticks, planned];
}

function ProgressLine({done, planned}: {done: number; planned: number}) {
  const pct = planned === 0 ? 0 : (done / planned) * 100;
  return (
    <div className="relative mt-10 h-14">
      <div className="absolute inset-x-0 top-5 h-px bg-white/30" />
      <div
        className="absolute left-0 top-[19px] h-[3px] rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.7)] transition-all duration-700 ease-out"
        style={{width: `${pct}%`}}
      />
      <div
        className="absolute top-0 flex -translate-x-1/2 flex-col items-center transition-all duration-700 ease-out"
        style={{left: `${pct}%`}}
      >
        <span className="text-[10px] tracking-[0.2em] text-cyan-200">{Math.round(pct)}%</span>
        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
      </div>
      {hourTicks(planned).map((t, i, all) => {
        const left = planned === 0 ? 0 : (t / planned) * 100;
        // First and last labels align inward so they never spill past the line's ends.
        const align =
          i === 0 ? "items-start" : i === all.length - 1 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center";
        return (
          <div key={t} className={`absolute top-[17px] flex flex-col whitespace-nowrap ${align}`} style={{left: `${left}%`}}>
            <span className="h-[7px] w-px bg-white/40" />
            <span className="mt-2 text-[11px] text-white/60 tabular-nums">{formatMinutes(t)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [subject, setSubject] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [error, setError] = useState("");

  // Load the saved schedule once on the client (localStorage doesn't exist on the server).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
        setSessions(saved.sessions ?? []);
        setCompleted(saved.completed ?? []);
      }
    } catch {
      // Ignore unreadable storage and start with an empty schedule.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({sessions, completed}));
    } catch {
      // Storage may be unavailable (e.g. private mode); the app still works in-memory.
    }
  }, [sessions, completed, loaded]);

  const addSession = (e: FormEvent) => {
    e.preventDefault();
    const name = subject.trim() || (isBreak ? "Break" : "");
    if (!name) return setError("Give the session a name.");
    if (!start || !end) return setError("Pick a start and end time.");
    if (toMinutes(end) <= toMinutes(start)) return setError("End time must be after start time.");

    setSessions((prev) =>
      [...prev, {id: crypto.randomUUID(), subject: name, start, end, isBreak}].sort(
        (a, b) => toMinutes(a.start) - toMinutes(b.start),
      ),
    );
    setSubject("");
    setStart(end); // next session most likely starts where this one ended
    setEnd("");
    setIsBreak(false);
    setError("");
  };

  const removeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setCompleted((prev) => prev.filter((x) => x !== id));
  };

  // Clicking a session toggles it: complete on first click, undo on second.
  const toggle = (id: string) =>
    setCompleted((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const studySessions = sessions.filter((s) => !s.isBreak);
  const plannedMinutes = studySessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const doneMinutes = studySessions
    .filter((s) => completed.includes(s.id))
    .reduce((sum, s) => sum + sessionMinutes(s), 0);
  const percent = plannedMinutes === 0 ? 0 : Math.round((doneMinutes / plannedMinutes) * 100);
  const nextSession = studySessions.find((s) => !completed.includes(s.id));


  const doneCount = studySessions.filter((s) => completed.includes(s.id)).length;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const inputClass =
    "border-b border-white/30 bg-transparent px-1 py-2 text-white placeholder:text-white/45 outline-none transition focus:border-cyan-300 [color-scheme:dark]";

  return (
    <main className="sf-lift flex-1 font-mono text-white">
      <div className="mx-auto max-w-3xl px-5 pb-48 pt-10 sm:px-8 sm:pt-14">
        <header className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-semibold tracking-[0.4em] text-white">STUDYFLOW</p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/75" suppressHydrationWarning>
            {today}
          </p>
        </header>

        <section className="mt-14">
          <SectionLabel>Today&apos;s progress</SectionLabel>
          <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-2">
            <p className="text-6xl font-semibold leading-none tracking-tight tabular-nums sm:text-7xl">
              {formatMinutes(doneMinutes)}
            </p>
            <p className="pb-1.5 text-sm text-cyan-200 tabular-nums">of {formatMinutes(plannedMinutes)} planned</p>
          </div>
          <ProgressLine done={doneMinutes} planned={plannedMinutes} />
          <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-cyan-200">
            {studySessions.length === 0
              ? "No study sessions yet"
              : `${doneCount} of ${studySessions.length} sessions done · ${percent}%`}
          </p>
        </section>

        <section className="mt-16">
          <SectionLabel>Next up</SectionLabel>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            {nextSession ? (
              <>
                <p className="text-3xl font-semibold tracking-tight">{nextSession.subject}</p>
                <p className="text-sm text-cyan-200 tabular-nums">
                  {formatTime(nextSession.start)} – {formatTime(nextSession.end)}
                </p>
              </>
            ) : studySessions.length > 0 ? (
              <>
                <p className="text-3xl font-semibold tracking-tight">All done</p>
                <p className="text-sm text-white/70">Nothing left today. Rest well.</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-semibold tracking-tight text-white/85">Nothing planned</p>
                <p className="text-sm text-white/70">Add a session below.</p>
              </>
            )}
          </div>
        </section>

        <section className="mt-16">
          <SectionLabel>Today&apos;s schedule</SectionLabel>

          <form onSubmit={addSession} className="mt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={isBreak ? "Break" : "Subject, e.g. CS 135"}
                aria-label="Subject"
                className={`${inputClass} md:min-w-0 md:flex-1`}
              />
              <div className="flex items-end gap-3">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  aria-label="Start time"
                  className={`${inputClass} min-w-0 flex-1 tabular-nums`}
                />
                <span className="pb-2 text-xs text-white/50">to</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-label="End time"
                  className={`${inputClass} min-w-0 flex-1 tabular-nums`}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/70">
                  <input
                    type="checkbox"
                    checked={isBreak}
                    onChange={(e) => setIsBreak(e.target.checked)}
                    className="h-3.5 w-3.5 accent-cyan-300"
                  />
                  Break
                </label>
                <button
                  type="submit"
                  className="border border-cyan-300/70 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100 transition hover:bg-cyan-300/15 active:scale-[0.98]"
                >
                  Add
                </button>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          </form>

          <ul className="mt-8">
            {loaded && sessions.length === 0 && (
              <li className="border-y border-white/15 py-8 text-center text-sm text-white/60">
                Your schedule is empty. Add your first session above.
              </li>
            )}

            {sessions.map((session) => {
              const done = completed.includes(session.id);
              return (
                <li
                  key={session.id}
                  className="group flex items-stretch border-b border-white/15 transition-colors first:border-t hover:bg-white/[0.04]"
                >
                  <button
                    type="button"
                    onClick={() => toggle(session.id)}
                    aria-pressed={done}
                    className="flex flex-1 items-center gap-4 py-4 pl-2 text-left sm:gap-6"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                        done
                          ? "border-cyan-300 bg-cyan-300 text-slate-900"
                          : session.isBreak
                            ? "border-dashed border-white/50"
                            : "border-white/60 group-hover:border-cyan-300"
                      }`}
                    >
                      {done && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M2.5 6.5l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span
                      className={`hidden w-44 shrink-0 text-sm tabular-nums sm:block ${
                        done ? "text-white/40" : session.isBreak ? "text-white/60" : "text-cyan-200"
                      }`}
                    >
                      {formatTime(session.start)} – {formatTime(session.end)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate ${
                          done ? "text-white/45 line-through" : session.isBreak ? "text-white/70" : "text-white"
                        }`}
                      >
                        {session.subject}
                      </span>
                      <span className="mt-0.5 block text-xs text-cyan-200/90 tabular-nums sm:hidden">
                        {formatTime(session.start)} – {formatTime(session.end)}
                      </span>
                    </span>
                    <span className={`text-sm tabular-nums ${done ? "text-white/40" : "text-white/70"}`}>
                      {formatMinutes(sessionMinutes(session))}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(session.id)}
                    aria-label={`Remove ${session.subject}`}
                    className="px-4 text-lg text-white/40 transition hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
