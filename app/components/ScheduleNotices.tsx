"use client";

import {useState} from "react";
import {useSchedule} from "../lib/schedule";

const button = "text-xs uppercase tracking-[0.25em] transition";

// Messages about the schedule itself: a save that failed, or an old schedule from before
// accounts that can be brought into this one.
export default function ScheduleNotices() {
  const {error, dismissError, legacy, importLegacy, dismissLegacy} = useSchedule();
  const [importing, setImporting] = useState(false);

  if (!error && !legacy) return null;

  const count = legacy?.sessions.length ?? 0;
  const runImport = async () => {
    setImporting(true);
    await importLegacy();
    setImporting(false);
  };

  return (
    <div className="mt-8 space-y-3">
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-l-2 border-rose-300/80 py-1 pl-4">
          <p className="text-sm text-rose-200">{error}</p>
          <button type="button" onClick={dismissError} className={`${button} text-white/60 hover:text-white`}>
            Dismiss
          </button>
        </div>
      )}
      {legacy && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-l-2 border-scene py-1 pl-4">
          <p className="text-sm text-white/85">
            This browser has {count} {count === 1 ? "session" : "sessions"} saved from before accounts. Add{" "}
            {count === 1 ? "it" : "them"} to today?
          </p>
          <div className="flex items-center gap-5">
            <button type="button" onClick={dismissLegacy} disabled={importing} className={`${button} text-white/60 hover:text-white`}>
              No thanks
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={importing}
              className={`${button} border border-scene/70 px-4 py-1.5 font-semibold text-scene-ink hover:bg-scene/15 disabled:opacity-60`}
            >
              {importing ? "Adding…" : "Add to today"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
