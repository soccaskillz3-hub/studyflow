"use client";

import type {ReactNode} from "react";
import {sessionMinutes, useSchedule} from "../lib/schedule";
import {formatMinutes, formatTime} from "../lib/time";

// Today's sessions as rows. Clicking a row toggles it done; `removable` adds a delete button per row.
export default function SessionList({empty, removable = false}: {empty: ReactNode; removable?: boolean}) {
  const {sessions, completed, loaded, toggle, removeSession} = useSchedule();

  return (
    <ul>
      {loaded && sessions.length === 0 && (
        <li className="border-y border-white/15 py-8 text-center text-sm text-white/60">{empty}</li>
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
              <span className={`text-sm tabular-nums ${done ? "text-white/40" : "text-white/70"} ${removable ? "" : "pr-2"}`}>
                {formatMinutes(sessionMinutes(session))}
              </span>
            </button>
            {removable && (
              <button
                type="button"
                onClick={() => removeSession(session.id)}
                aria-label={`Remove ${session.subject}`}
                className="px-4 text-lg text-white/40 transition hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
