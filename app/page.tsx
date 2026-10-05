"use client";

import {useState} from "react";

const schedule = [
  {
    id: 1,
    subject: "CS 135",
    time: "3:00 PM - 4:00 PM",
    duration: "1 hour",
    minutes: 60,
    isBreak: false,
  },
  {
    id: 2,
    subject: "MATH 135",
    time: "4:30 PM - 6:00 PM",
    duration: "1.5 hours",
    minutes: 90,
    isBreak: false,
  },
  {
    id: 3,
    subject: "Break",
    time: "6:00 PM - 6:30 PM",
    duration: "30 minutes",
    minutes: 30,
    isBreak: true,
  },
];

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function Home() {
  const [completed, setCompleted] = useState<number[]>([]);

  // Clicking a session toggles it: complete on first click, undo on second.
  const toggle = (id: number) =>
    setCompleted((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const studySessions = schedule.filter((s) => !s.isBreak);
  const plannedMinutes = studySessions.reduce((sum, s) => sum + s.minutes, 0);
  const doneMinutes = studySessions
    .filter((s) => completed.includes(s.id))
    .reduce((sum, s) => sum + s.minutes, 0);
  const percent = plannedMinutes === 0 ? 0 : Math.round((doneMinutes / plannedMinutes) * 100);
  const nextSession = studySessions.find((s) => !completed.includes(s.id));

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
                <p className="mt-1 text-zinc-400">{nextSession.time}</p>
              </>
            ) : (
              <>
                <p className="mt-4 text-2xl font-bold">All done 🎉</p>
                <p className="mt-1 text-zinc-400">Nothing left for today.</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold">Today&apos;s Schedule</h2>

          <div className="mt-6">
            {schedule.map((session) => {
              const done = completed.includes(session.id);
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => toggle(session.id)}
                  aria-pressed={done}
                  className={`mt-3 block w-full rounded-2xl p-6 text-left transition-colors ${
                    done ? "bg-zinc-900/50" : "bg-zinc-900 hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={done ? "font-semibold line-through text-zinc-500" : "font-semibold"}>
                        {session.subject}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">{session.time}</p>
                    </div>

                    <p className="text-zinc-400">{done ? "✓ Done" : session.duration}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
