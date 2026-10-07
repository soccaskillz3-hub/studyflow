"use client";

import Link from "next/link";
import {useParams, useRouter} from "next/navigation";
import {useEffect, useState, type CSSProperties, type FormEvent} from "react";
import {stashCelebration} from "../../lib/celebrate";
import {sessionMinutes, useSchedule} from "../../lib/schedule";
import {success} from "../../lib/sounds";
import {useFocusTimer, type Phase} from "../../lib/timer";
import {formatMinutes, formatTime, fromMinutes, nowMinutes} from "../../lib/time";

const BREAK_PRESETS = [10, 20, 30];
const SPARKS = 14;

// Shown after "Done": a check that draws itself, a burst of sparks and what was earned.
function Celebration({subject, minutes}: {subject: string; minutes: number | null}) {
  return (
    <div className="flex flex-col items-center" role="status">
      <div className="relative h-36 w-36 sm:h-48 sm:w-48">
        {Array.from({length: SPARKS}, (_, i) => (
          <span
            key={i}
            className="sf-spark absolute left-1/2 top-1/2"
            style={{"--angle": `${(360 / SPARKS) * i}deg`, animationDelay: `${0.35 + (i % 3) * 0.05}s`} as CSSProperties}
          />
        ))}
        <svg viewBox="0 0 120 120" className="sf-check relative h-full w-full" fill="none" aria-hidden>
          <circle cx="60" cy="60" r="52" strokeWidth="2.5" className="sf-check-ring" />
          <path d="M38 61l15 15 30-32" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="sf-check-mark" />
        </svg>
      </div>
      <p className="sf-rise mt-8 font-display text-5xl leading-none sm:text-7xl" style={{animationDelay: "0.45s"}}>
        Nicely done
      </p>
      <p
        className="sf-rise sf-focus-label mt-4 text-[11px] uppercase tracking-[0.3em] sm:text-xs"
        style={{animationDelay: "0.6s"}}
      >
        {subject}
        {minutes ? ` · +${formatMinutes(minutes)} today` : ""}
      </p>
    </div>
  );
}

// "mm:ss", or "h:mm:ss" from an hour up.
function clock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// The serif's digits have different widths; fixed-width cells keep the time from jittering as it counts.
function BigTime({text, phase}: {text: string; phase: Phase}) {
  return (
    <p
      className={`sf-focus-time font-display leading-none ${phase === "break" ? "italic" : ""}`}
      data-phase={phase}
      aria-hidden
    >
      {[...text].map((ch, i) =>
        ch === ":" ? (
          <span key={i} className="sf-focus-colon inline-block w-[0.32em] text-center">
            :
          </span>
        ) : (
          <span key={i} className="inline-block w-[0.56em] text-center">
            {ch}
          </span>
        ),
      )}
    </p>
  );
}

function BreakPicker({onStart, onCancel}: {onStart: (minutes: number) => void; onCancel: () => void}) {
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");

  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    const minutes = Number(custom);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return setError("Pick 1 to 180 minutes.");
    onStart(minutes);
  };

  return (
    <div
      role="dialog"
      aria-label="Break length"
      className="sf-panel sf-pop w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border p-4 text-left font-mono"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">How long a break?</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {BREAK_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onStart(m)}
            className="rounded-lg bg-white/[0.07] py-3 text-sm text-white transition hover:bg-white/[0.14] active:scale-[0.98]"
          >
            {m} min
          </button>
        ))}
      </div>
      <form onSubmit={submitCustom} noValidate className="mt-3 flex items-end gap-3">
        <label className="flex-1">
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/55">Custom</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setError("");
            }}
            placeholder="Minutes"
            className="mt-1 w-full border-b border-white/30 bg-transparent px-1 py-1.5 text-white placeholder:text-white/40 outline-none transition focus:border-white/70 [color-scheme:dark]"
          />
        </label>
        <button
          type="submit"
          className="border border-white/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/10"
        >
          Start
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <button
        type="button"
        onClick={onCancel}
        className="mt-3 text-xs uppercase tracking-[0.25em] text-white/55 transition hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}

const controlClass = (primary = false) =>
  `min-w-28 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] transition active:scale-[0.98] ${
    primary
      ? "sf-focus-primary border"
      : "border border-white/30 text-white/85 hover:border-white/60 hover:text-white"
  }`;

export default function FocusPage() {
  const {id} = useParams<{id: string}>();
  const router = useRouter();
  const {sessions, completed, loaded, toggle} = useSchedule();
  const session = sessions.find((s) => s.id === id);
  const timer = useFocusTimer(session ? session.id : null, session ? sessionMinutes(session) : 0);
  const [picking, setPicking] = useState(false);
  // After "Done": celebrate, fade out, then land on Today where the progress animates up.
  const [celebrating, setCelebrating] = useState<{minutes: number | null} | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  useEffect(() => {
    if (!celebrating) return;
    const fade = setTimeout(() => setLeaving(true), 1900);
    const go = setTimeout(() => router.push("/"), 2400);
    return () => {
      clearTimeout(fade);
      clearTimeout(go);
    };
  }, [celebrating, router]);

  const {phase} = timer;
  const shownMs = phase === "break" ? timer.breakLeftMs : timer.focusLeftMs;
  const totalMs = phase === "break" ? timer.breakMs : timer.focusMs;
  const progress = totalMs ? 1 - shownMs / totalMs : 0;

  // Show the countdown in the tab title, so it's visible from other tabs.
  useEffect(() => {
    if (!session) return;
    const previous = document.title;
    document.title = `${clock(shownMs)} · ${phase === "break" ? "Break" : session.subject}`;
    return () => {
      document.title = previous;
    };
  }, [shownMs, phase, session]);

  // Space pauses and resumes focus (unless typing in the break picker).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (celebrating || e.key !== " " || (e.target as HTMLElement).closest("input, button, [role=dialog]")) return;
      e.preventDefault();
      if (phase === "focus") timer.pause();
      else if (phase === "paused") timer.resume();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, timer, celebrating]);

  const finish = () => {
    if (!session || celebrating) return;
    success();
    // Only newly finished sessions add progress; re-finishing one just celebrates.
    const fresh = !completed.includes(session.id);
    if (fresh) {
      toggle(session.id);
      stashCelebration({subject: session.subject, minutes: sessionMinutes(session)});
    }
    timer.clear();
    setPicking(false);
    setCelebrating({minutes: fresh ? sessionMinutes(session) : null});
  };

  if (!loaded) return <div className="sf-focus fixed inset-0" />;

  if (!session) {
    return (
      <div className="sf-focus fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center font-mono text-white">
        <p className="text-sm text-white/70">That session isn&apos;t on today&apos;s schedule anymore.</p>
        <Link href="/calendar" className="text-xs uppercase tracking-[0.25em] text-white underline underline-offset-4">
          Back to calendar
        </Link>
      </div>
    );
  }

  // When the current phase is expected to end, in clock time (wrapping past midnight).
  const endsAt = formatTime(fromMinutes((nowMinutes() + Math.ceil(shownMs / 60_000)) % (24 * 60)));
  const label = {
    focus: `Focus · ${session.subject}`,
    paused: `Paused · ${session.subject}`,
    break: "Break",
    complete: `${session.subject} · complete`,
  }[phase];
  const caption = {
    focus: `Ends around ${endsAt}`,
    paused: "Press space or Resume to keep going",
    break: `Back to ${session.subject} around ${endsAt}`,
    complete: "Nice work. Mark it done, or keep going.",
  }[phase];

  return (
    <div
      className={`sf-focus fixed inset-0 flex flex-col font-mono text-white transition-opacity duration-500 ${leaving ? "opacity-0" : ""}`}
      data-phase={celebrating ? "complete" : phase}
    >
      <header className="flex items-center justify-between gap-4 px-5 pt-6 sm:px-10 sm:pt-8">
        <Link
          href="/calendar"
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/70 transition hover:text-white"
        >
          <span aria-hidden>←</span> Calendar
        </Link>
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/60 tabular-nums">
          {formatTime(session.start)} – {formatTime(session.end)}
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        {celebrating ? (
          <Celebration subject={session.subject} minutes={celebrating.minutes} />
        ) : (
          <>
            <p className="sf-focus-label text-[11px] uppercase tracking-[0.4em] sm:text-xs" aria-live="polite">
              {label}
            </p>
            <h1 className="sr-only">
              {label}: {clock(shownMs)} left
            </h1>
            <BigTime text={clock(shownMs)} phase={phase} />
            <div className="mt-6 h-px w-[min(28rem,80vw)] bg-white/15">
              <div className="sf-focus-bar h-px transition-[width] duration-300 ease-linear" style={{width: `${progress * 100}%`}} />
            </div>
            <p className="mt-4 text-xs text-white/60 sm:text-sm">{caption}</p>
          </>
        )}
      </main>

      <footer className="flex flex-col items-center gap-4 px-5 pb-10 sm:pb-14">
        {picking && (
          <BreakPicker
            onStart={(m) => {
              timer.startBreak(m);
              setPicking(false);
            }}
            onCancel={() => setPicking(false)}
          />
        )}
        {!picking && !celebrating && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {phase === "focus" && (
              <>
                <button type="button" onClick={timer.pause} className={controlClass()}>
                  Pause
                </button>
                <button type="button" onClick={() => setPicking(true)} className={controlClass(true)}>
                  Break?
                </button>
                <button type="button" onClick={finish} className={controlClass()}>
                  Done
                </button>
              </>
            )}
            {phase === "paused" && (
              <>
                <button type="button" onClick={timer.resume} className={controlClass(true)}>
                  Resume
                </button>
                <button type="button" onClick={() => setPicking(true)} className={controlClass()}>
                  Break?
                </button>
                <button type="button" onClick={finish} className={controlClass()}>
                  Done
                </button>
              </>
            )}
            {phase === "break" && (
              <button type="button" onClick={timer.endBreak} className={controlClass(true)}>
                End break
              </button>
            )}
            {phase === "complete" && (
              <>
                <button type="button" onClick={finish} className={controlClass(true)}>
                  Mark done
                </button>
                <button type="button" onClick={() => timer.addFocus(10)} className={controlClass()}>
                  +10 min
                </button>
              </>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
