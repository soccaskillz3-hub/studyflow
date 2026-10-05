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

  const inputClass =
    "rounded-xl bg-zinc-800 px-4 py-2.5 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-4xl font-bold">StudyFlow</h1>

        <p className="mt-2 text-zinc-400">
          Your study. Your schedule. Your flow.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Today&apos;s Progress</h2>
            <p className="mt-4 text-3xl font-bold">{formatMinutes(doneMinutes)}</p>
            <p className="mt-1 text-zinc-400">
              of {formatMinutes(plannedMinutes)} planned · {percent}%
            </p>
            <div
              className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{width: `${percent}%`}}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Next Study Session</h2>
            {nextSession ? (
              <>
                <p className="mt-4 text-2xl font-bold">{nextSession.subject}</p>
                <p className="mt-1 text-zinc-400">
                  {formatTime(nextSession.start)} - {formatTime(nextSession.end)}
                </p>
              </>
            ) : studySessions.length > 0 ? (
              <>
                <p className="mt-4 text-2xl font-bold">All done 🎉</p>
                <p className="mt-1 text-zinc-400">Nothing left for today.</p>
              </>
            ) : (
              <>
                <p className="mt-4 text-2xl font-bold">Nothing planned</p>
                <p className="mt-1 text-zinc-400">Add a study session below.</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold">Today&apos;s Schedule</h2>

          <form onSubmit={addSession} className="mt-6 rounded-2xl bg-zinc-900 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={isBreak ? "Break" : "Subject, e.g. CS 135"}
                aria-label="Subject"
                className={`${inputClass} md:flex-1`}
              />
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  aria-label="Start time"
                  className={inputClass}
                />
                <span className="text-zinc-500">to</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-label="End time"
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-2 text-zinc-400">
                <input
                  type="checkbox"
                  checked={isBreak}
                  onChange={(e) => setIsBreak(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Break
              </label>
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                Add
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </form>

          <div className="mt-6">
            {loaded && sessions.length === 0 && (
              <p className="mt-3 rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-zinc-500">
                Your schedule is empty. Add your first session above.
              </p>
            )}

            {sessions.map((session) => {
              const done = completed.includes(session.id);
              return (
                <div
                  key={session.id}
                  className={`mt-3 flex items-stretch rounded-2xl transition-colors ${
                    done ? "bg-zinc-900/50" : "bg-zinc-900 hover:bg-zinc-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(session.id)}
                    aria-pressed={done}
                    className="flex flex-1 items-center justify-between p-6 text-left"
                  >
                    <div>
                      <p className={done ? "font-semibold line-through text-zinc-500" : "font-semibold"}>
                        {session.subject}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {formatTime(session.start)} - {formatTime(session.end)}
                      </p>
                    </div>

                    <p className="text-zinc-400">
                      {done ? "✓ Done" : formatMinutes(sessionMinutes(session))}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(session.id)}
                    aria-label={`Remove ${session.subject}`}
                    className="px-5 text-xl text-zinc-600 hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
