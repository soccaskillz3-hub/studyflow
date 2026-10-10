"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {use, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from "react";
import {AnalogFace, ClassicFace, OrbitFace, SunFace, WordsFace, type FaceProps} from "../components/clock/faces";
import MuteButton from "../components/MuteButton";
import SettingsMenu from "../components/SettingsMenu";
import {stashCelebration} from "../lib/celebrate";
import {CLOCK_STYLES, usePrefs, type ClockStyle} from "../lib/prefs";
import {useScene} from "../lib/scene";
import {sessionMinutes, useSchedule} from "../lib/schedule";
import {success} from "../lib/audio/sfx";
import {formatTime, nowMinutes, toMinutes} from "../lib/time";
import {useSwipe} from "../lib/useSwipe";

const IDLE_MS = 4000;
const SWIPE_PX = 60;

// The time, updated on each new second.
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      id = setTimeout(tick, 1000 - d.getMilliseconds() + 5);
    };
    id = setTimeout(tick, 0);
    return () => clearTimeout(id);
  }, []);
  return now;
}

// While the clock is open, the scene behind it draws in (see :root[data-immersive] in globals.css).
function useImmersive() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.immersive = "";
    return () => {
      delete html.dataset.immersive;
    };
  }, []);
}

function usePrefersSmoothMotion() {
  const [smooth, setSmooth] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSmooth(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return smooth;
}

// A clock left on shouldn't let the screen go to sleep. Where the browser allows it, hold a
// screen wake lock while the page is showing (it's released when the tab is hidden, so take it
// again on return).
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
          if (!active) lock.release();
        }
      } catch {
        // Not allowed (e.g. low battery): the screen just sleeps as usual.
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, []);
}

// After a few seconds without the mouse or keyboard, the controls fade so only the clock is left.
function useIdle() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let id = setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      clearTimeout(id);
      id = setTimeout(() => setIdle(true), IDLE_MS);
    };
    const events = ["pointermove", "pointerdown", "keydown", "focusin"] as const;
    events.forEach((e) => window.addEventListener(e, wake));
    return () => {
      clearTimeout(id);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, []);
  return idle;
}

function Face({style, ...props}: FaceProps & {style: ClockStyle}) {
  const {sun} = useScene();
  const {prefs} = usePrefs();
  switch (style) {
    case "classic":
      return <ClassicFace {...props} seconds={prefs?.clockSeconds ?? false} />;
    case "analog":
      return <AnalogFace {...props} />;
    case "words":
      return <WordsFace {...props} />;
    case "orbit":
      return <OrbitFace {...props} />;
    case "sun":
      return <SunFace {...props} sun={sun} />;
  }
}

function Chevron({flip = false}: {flip?: boolean}) {
  return (
    <svg viewBox="0 0 12 12" className={`h-4 w-4 ${flip ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7.5 2.5L4 6l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const iconButton =
  "-m-2 flex h-9 w-9 items-center justify-center rounded-md text-white/75 transition hover:bg-white/[0.06] hover:text-white";

// A full-screen clock over the scene, for when you just want the time and the view. Swipe,
// drag, use the arrow keys or the dots to change its style; the choice is saved to the account
// (and can also be changed in Settings → Focus). Opened from a session's Start?, it also shows
// that session, with a Done button.
export default function ClockPage({searchParams}: PageProps<"/clock">) {
  const {session: sessionId} = use(searchParams);
  const router = useRouter();
  const now = useNow();
  const smooth = usePrefersSmoothMotion();
  const idle = useIdle();
  useWakeLock();
  useImmersive();
  const {prefs, setPrefs} = usePrefs();
  const {sessions, completed, toggle} = useSchedule();
  const session = typeof sessionId === "string" ? sessions.find((s) => s.id === sessionId) : undefined;
  const [drag, setDrag] = useState<{x: number; dx: number} | null>(null);
  const [trackpadDx, setTrackpadDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  const index = Math.max(
    0,
    CLOCK_STYLES.findIndex((s) => s.id === prefs?.clockStyle),
  );
  const current = CLOCK_STYLES[index];
  const goTo = (i: number) => {
    const next = CLOCK_STYLES[Math.min(CLOCK_STYLES.length - 1, Math.max(0, i))];
    if (next.id !== current.id) setPrefs({clockStyle: next.id});
  };

  // Two-finger swipes on a trackpad. (Fingers on a touch screen and mouse drags are handled by
  // the pointer events below, so the clock can follow them all the way.)
  const atEdge = (dx: number) => (dx > 0 && index === 0) || (dx < 0 && index === CLOCK_STYLES.length - 1);
  useSwipe(stage, {
    enabled: now !== null && prefs !== null, // the stage only exists once these have loaded
    touch: false,
    onMove: (dx) => setTrackpadDx(atEdge(dx) ? dx / 4 : dx),
    onSwipe: (direction) => goTo(index + direction),
  });

  // Arrow keys change the style.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, [role=dialog], dialog")) return;
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The time in the tab title, so it's there from other tabs too.
  useEffect(() => {
    if (!now) return;
    const previous = document.title;
    document.title = `${formatTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)} · Zeflo`;
    return () => {
      document.title = previous;
    };
  }, [now]);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a")) return;
    stage.current?.setPointerCapture(e.pointerId);
    setDrag({x: e.clientX, dx: 0});
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    // Past the first or last style, the track gives a little and springs back.
    setDrag({x: drag.x, dx: atEdge(dx) ? dx / 4 : dx});
  };
  const onPointerUp = () => {
    if (!drag) return;
    if (drag.dx < -SWIPE_PX) goTo(index + 1);
    else if (drag.dx > SWIPE_PX) goTo(index - 1);
    setDrag(null);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const finish = () => {
    if (!session || leaving) return;
    success();
    if (!completed.includes(session.id)) {
      toggle(session.id);
      stashCelebration({subject: session.subject, minutes: sessionMinutes(session)});
    }
    setLeaving(true);
    setTimeout(() => router.push("/"), 500);
  };

  // Wait for the time and the saved style, so the clock fades in once, in the right style.
  if (!now || !prefs) return <div className="sf-clock fixed inset-0" />;

  const offset = drag?.dx ?? trackpadDx;
  const fade = `transition-opacity duration-700 ${idle && !drag ? "opacity-0" : "opacity-100"}`;
  const sessionLeft = session ? Math.max(0, toMinutes(session.end) - nowMinutes(now)) : 0;
  // To the second (not the minute), so the line creeps forward instead of jumping once a minute.
  const nowExact = nowMinutes(now) + now.getSeconds() / 60;
  const sessionProgress = session
    ? Math.min(1, Math.max(0, (nowExact - toMinutes(session.start)) / sessionMinutes(session)))
    : 0;

  return (
    <div
      className={`sf-clock fixed inset-0 flex flex-col font-mono text-white transition-opacity duration-500 ${
        idle && !drag ? "cursor-none" : ""
      } ${leaving ? "opacity-0" : ""}`}
    >
      <header className={`sf-clock-enter-late relative z-10 flex items-center justify-between gap-4 px-5 pt-6 sm:px-10 sm:pt-8 ${fade}`}>
        <Link href="/" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/70 transition hover:text-white">
          <span aria-hidden>←</span> Dashboard
        </Link>
        <div className="flex items-center gap-5">
          <button type="button" onClick={toggleFullscreen} aria-label="Full screen" title="Full screen" className={iconButton}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
            </svg>
          </button>
          <MuteButton />
          <SettingsMenu />
        </div>
      </header>

      <main
        ref={stage}
        className="sf-clock-enter relative flex-1 touch-pan-y select-none overflow-clip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-roledescription="carousel"
        aria-label="Clock styles"
      >
        <h1 className="sr-only">
          {formatTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)}
        </h1>
        <div
          className={`flex h-full ${offset ? "" : "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"}`}
          style={{transform: `translateX(calc(${-index * 100}% + ${offset}px))`}}
        >
          {CLOCK_STYLES.map((s, i) => (
            <section
              key={s.id}
              aria-roledescription="slide"
              aria-label={`${s.label}, ${i + 1} of ${CLOCK_STYLES.length}`}
              aria-hidden={i !== index}
              className="flex h-full w-full shrink-0 items-center justify-center px-5"
            >
              {/* Only the styles in view (or next to it, mid-swipe) are drawn. */}
              {Math.abs(i - index) <= 1 && (
                <div className={`transition-[opacity,transform] duration-700 ${i === index ? "scale-100 opacity-100" : "scale-[0.92] opacity-30"}`}>
                  {/* Keyed by motion: the sweeping hands start in step with the time when they appear. */}
                  <Face key={String(smooth)} style={s.id} now={now} smooth={smooth} />
                </div>
              )}
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous clock style"
          className={`absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-0 sm:left-6 ${fade}`}
        >
          <Chevron />
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === CLOCK_STYLES.length - 1}
          aria-label="Next clock style"
          className={`absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-0 sm:right-6 ${fade}`}
        >
          <Chevron flip />
        </button>
      </main>

      <footer className="sf-clock-enter-late relative z-10 flex flex-col items-center gap-5 px-5 pb-8 sm:pb-12">
        {session && (
          <div className="flex w-[min(26rem,100%)] items-center gap-4 rounded-full border border-white/15 bg-slate-950/35 py-2 pl-5 pr-2 backdrop-blur-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white/90">
                {session.subject}
                <span className="text-white/50">
                  {" "}
                  · {completed.includes(session.id) ? "done" : sessionLeft > 0 ? `until ${formatTime(session.end)}` : "time's up"}
                </span>
              </p>
              <div className="mt-1.5 h-px bg-white/15">
                <div
                  className="h-px origin-left bg-scene shadow-[0_0_6px_var(--accent-glow)] transition-transform duration-1000 ease-linear motion-reduce:transition-none"
                  style={{transform: `scaleX(${sessionProgress})`}}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={finish}
              className="shrink-0 rounded-full border border-scene/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15"
            >
              Done
            </button>
          </div>
        )}

        <div className={`flex flex-col items-center gap-3 ${fade}`}>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/80" aria-live="polite">
            {current.label}
            <span className="ml-2 normal-case tracking-normal text-white/45 max-sm:hidden">{current.hint}</span>
            {/* Classic's seconds: a line that fills each minute, or small numbers. Kept quiet. */}
            {current.id === "classic" && (
              <button
                type="button"
                onClick={() => setPrefs({clockSeconds: !prefs.clockSeconds})}
                aria-pressed={prefs.clockSeconds}
                className="ml-3 normal-case tracking-normal text-white/30 underline decoration-white/15 underline-offset-4 transition hover:text-white/75 hover:decoration-white/40"
              >
                {prefs.clockSeconds ? "seconds as a line" : "show seconds"}
              </button>
            )}
          </p>
          <div className="flex items-center gap-2.5">
            {CLOCK_STYLES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${s.label} clock`}
                aria-current={i === index ? "true" : undefined}
                className="group flex h-6 items-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-500 ${
                    i === index ? "w-6 bg-scene shadow-[0_0_8px_var(--accent-glow)]" : "w-1.5 bg-white/35 group-hover:bg-white/70"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
