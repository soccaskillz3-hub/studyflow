"use client";

import {useRouter} from "next/navigation";
import {useRef, useState} from "react";
import {usePrefs} from "../lib/prefs";
import type {Session} from "../lib/schedule";
import {formatMinutes, toMinutes} from "../lib/time";

type Mode = "timer" | "clock";

const MODES: {id: Mode; label: string; hint: string}[] = [
  {id: "timer", label: "Study timer", hint: "Counts this session down, with breaks when you want them"},
  {id: "clock", label: "Clock", hint: "A calm clock over the scene, no countdown"},
];

const MODE_NAME: Record<Mode, string> = {timer: "the study timer", clock: "the clock"};

function TimerPreview({minutes}: {minutes: number}) {
  return (
    <span className="flex h-16 flex-col items-center justify-center" aria-hidden>
      <span className="font-display text-3xl leading-none text-white">{formatMinutes(minutes).replace(" ", "")}</span>
      <span className="mt-2 h-px w-16 bg-white/20">
        <span className="block h-px w-2/5 bg-scene shadow-[0_0_8px_var(--accent-glow)]" />
      </span>
    </span>
  );
}

function ClockPreview() {
  return (
    <span className="flex h-16 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 40 40" className="h-14 w-14">
        <circle cx="20" cy="20" r="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
        {Array.from({length: 12}, (_, i) => (
          <line
            key={i}
            x1="20"
            y1="3.5"
            x2="20"
            y2={i % 3 === 0 ? 6.5 : 5}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={i % 3 === 0 ? 1 : 0.6}
            transform={`rotate(${i * 30} 20 20)`}
          />
        ))}
        <line x1="20" y1="20" x2="20" y2="11" stroke="white" strokeWidth="1.6" strokeLinecap="round" transform="rotate(-50 20 20)" />
        <line x1="20" y1="20" x2="20" y2="7" stroke="white" strokeWidth="1" strokeLinecap="round" transform="rotate(60 20 20)" />
        <line x1="20" y1="23" x2="20" y2="6" className="stroke-scene" strokeWidth="0.6" transform="rotate(150 20 20)" />
        <circle cx="20" cy="20" r="1.4" className="fill-scene" />
      </svg>
    </span>
  );
}

const choiceButton =
  "group flex flex-col items-center rounded-xl bg-white/[0.05] p-4 text-center transition hover:bg-white/[0.1] focus-visible:bg-white/[0.1] active:scale-[0.99]";

// "Start?" for a session. Opens the study timer or the clock, whichever the person has made
// their default (Settings → Focus), or asks which one. The first time they pick, it also asks
// once whether to remember that choice; either answer means it's never asked again.
export default function StartButton({session, className}: {session: Session; className: string}) {
  const router = useRouter();
  const {prefs, setPrefs} = usePrefs();
  const dialog = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<Mode | null>(null);

  const go = (mode: Mode) => {
    dialog.current?.close();
    router.push(mode === "timer" ? `/focus/${session.id}` : `/clock?session=${session.id}`);
  };

  const start = () => {
    const mode = prefs?.startMode ?? "ask";
    if (mode !== "ask") return go(mode);
    setPicked(null);
    dialog.current?.showModal();
  };

  const choose = (mode: Mode) => {
    // Still loading the account's prefs: just go, and ask about a default another time.
    if (!prefs || prefs.startDefaultAsked) return go(mode);
    setPicked(mode);
  };

  const answer = (makeDefault: boolean) => {
    if (!picked) return;
    setPrefs({startDefaultAsked: true, ...(makeDefault ? {startMode: picked} : {})});
    go(picked);
  };

  const minutes = toMinutes(session.end) - toMinutes(session.start);

  return (
    <>
      <button type="button" onClick={start} aria-haspopup="dialog" className={className}>
        Start?
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`start-title-${session.id}`}
        // Clicking the dimmed backdrop (the dialog element itself, outside the panel) closes it.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="sf-panel sf-pop m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border p-0 font-mono text-white [text-shadow:none] backdrop:bg-slate-950/55 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-5">
          {picked === null ? (
            <>
              <p id={`start-title-${session.id}`} className="text-[11px] uppercase tracking-[0.3em] text-white/70">
                Start {session.subject} with
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {MODES.map((m) => (
                  <button key={m.id} type="button" onClick={() => choose(m.id)} className={choiceButton} autoFocus={m.id === "timer"}>
                    {m.id === "timer" ? <TimerPreview minutes={minutes} /> : <ClockPreview />}
                    <span className="mt-3 text-xs uppercase tracking-[0.25em] text-scene-ink">{m.label}</span>
                    <span className="mt-1.5 text-[11px] leading-snug text-white/60">{m.hint}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="mt-4 text-[11px] uppercase tracking-[0.25em] text-white/50 transition hover:text-white"
              >
                Cancel
              </button>
            </>
          ) : (
            <div className="sf-rise">
              <p id={`start-title-${session.id}`} className="text-base leading-snug text-white">
                Open {MODE_NAME[picked]} every time you press Start?
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  autoFocus
                  onClick={() => answer(true)}
                  className="flex-1 whitespace-nowrap border border-scene/70 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-scene-ink transition hover:bg-scene/15"
                >
                  Make it my default
                </button>
                <button
                  type="button"
                  onClick={() => answer(false)}
                  className="flex-1 whitespace-nowrap border border-white/25 px-3 py-2.5 text-[11px] uppercase tracking-[0.15em] text-white/80 transition hover:border-white/50 hover:text-white"
                >
                  Ask each time
                </button>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-white/50">
                You can always change this in Settings → Focus.
              </p>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
