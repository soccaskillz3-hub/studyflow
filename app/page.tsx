"use client";

import {useEffect, useState, type FormEvent} from "react";

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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const panelClass =
    "rounded-2xl border border-white/[0.07] bg-slate-950/40 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md";
  const labelClass = "text-xs font-medium uppercase tracking-[0.18em] text-slate-400";
  const inputClass =
    "rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-sky-300/40 focus:bg-white/[0.06] [color-scheme:dark]";

  return (
    <main className="flex-1 text-slate-100">
      <div className="mx-auto max-w-3xl px-5 pb-40 pt-14 sm:px-8 sm:pt-20">
        <header>
          <p className={labelClass} suppressHydrationWarning>
            {today}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">StudyFlow</h1>
          <p className="mt-2 text-slate-400">Your study. Your schedule. Your flow.</p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <section className={`${panelClass} p-6`}>
            <h2 className={labelClass}>Today&apos;s Progress</h2>
            <p className="mt-4 text-3xl font-semibold tabular-nums">{formatMinutes(doneMinutes)}</p>
            <p className="mt-1 text-sm text-slate-400 tabular-nums">
              of {formatMinutes(plannedMinutes)} planned · {percent}%
            </p>
            <div
              className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-300 shadow-[0_0_12px_rgba(125,211,252,0.5)] transition-all duration-700 ease-out"
                style={{width: `${percent}%`}}
              />
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <h2 className={labelClass}>Next Study Session</h2>
            {nextSession ? (
              <>
                <p className="mt-4 text-2xl font-semibold">{nextSession.subject}</p>
                <p className="mt-1 text-sm text-slate-400 tabular-nums">
                  {formatTime(nextSession.start)} – {formatTime(nextSession.end)}
                </p>
              </>
            ) : studySessions.length > 0 ? (
              <>
                <p className="mt-4 text-2xl font-semibold">All done</p>
                <p className="mt-1 text-sm text-slate-400">Nothing left for today. Rest well.</p>
              </>
            ) : (
              <>
                <p className="mt-4 text-2xl font-semibold text-slate-300">Nothing planned</p>
                <p className="mt-1 text-sm text-slate-400">Add a study session below.</p>
              </>
            )}
          </section>
        </div>

        <section className="mt-14">
          <h2 className="text-lg font-semibold tracking-tight">Today&apos;s Schedule</h2>

          <form onSubmit={addSession} className={`${panelClass} mt-4 p-4`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={isBreak ? "Break" : "Subject, e.g. CS 135"}
                aria-label="Subject"
                className={`${inputClass} md:min-w-0 md:flex-1`}
              />
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  aria-label="Start time"
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <span className="text-sm text-slate-500">to</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-label="End time"
                  className={`${inputClass} min-w-0 flex-1`}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    checked={isBreak}
                    onChange={(e) => setIsBreak(e.target.checked)}
                    className="h-4 w-4 accent-sky-300"
                  />
                  Break
                </label>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-sky-100 active:scale-[0.98]"
                >
                  Add
                </button>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          </form>

          <ul className="mt-4 space-y-2">
            {loaded && sessions.length === 0 && (
              <li className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                Your schedule is empty. Add your first session above.
              </li>
            )}

            {sessions.map((session) => {
              const done = completed.includes(session.id);
              return (
                <li
                  key={session.id}
                  className={`${panelClass} group flex items-stretch transition-colors ${
                    done ? "opacity-60" : "hover:border-white/[0.14] hover:bg-slate-900/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(session.id)}
                    aria-pressed={done}
                    className="flex flex-1 items-center gap-4 p-5 text-left"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                        done
                          ? "border-teal-300 bg-teal-300 text-slate-900"
                          : session.isBreak
                            ? "border-dashed border-slate-500"
                            : "border-slate-500 group-hover:border-sky-300"
                      }`}
                    >
                      {done && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2.5 6.5l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-medium ${
                          done ? "text-slate-400 line-through" : session.isBreak ? "text-slate-300" : ""
                        }`}
                      >
                        {session.subject}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-400 tabular-nums">
                        {formatTime(session.start)} – {formatTime(session.end)}
                      </p>
                    </div>

                    <p className="text-sm text-slate-400 tabular-nums">
                      {formatMinutes(sessionMinutes(session))}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(session.id)}
                    aria-label={`Remove ${session.subject}`}
                    className="px-4 text-lg text-slate-600 opacity-100 transition hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
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
