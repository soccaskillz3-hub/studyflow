"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useCallback, useRef, useState} from "react";
import MuteButton from "./MuteButton";
import SettingsMenu from "./SettingsMenu";
import {formatDay} from "../lib/days";
import {useSchedule} from "../lib/schedule";
import {useDismiss} from "../lib/useDismiss";

const CALENDAR_PAGES = [
  {href: "/calendar/week", label: "Week view", hint: "The whole week at a glance"},
  {href: "/calendar", label: "Day view", hint: "One day, hour by hour"},
  {href: "/calendar/schedule", label: "Schedule", hint: "List and add today's sessions"},
];

const tabClass = (active: boolean) =>
  `-mb-px flex items-center gap-2 border-b-2 pb-3 text-[11px] uppercase tracking-[0.2em] transition sm:text-xs sm:tracking-[0.3em] ${
    active ? "border-scene text-scene-ink" : "border-transparent text-white/60 hover:text-white"
  }`;

// "Calendar" opens a menu of the calendar pages instead of navigating straight away.
function CalendarMenu({pathname}: {pathname: string}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const active = pathname.startsWith("/calendar");
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={tabClass(active)}
      >
        Calendar
        <svg
          viewBox="0 0 12 12"
          className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="sf-panel sf-pop absolute left-0 top-full z-40 mt-2 w-60 rounded-xl border p-1.5 [text-shadow:none]">
          {CALENDAR_PAGES.map((page) => {
            const current = pathname === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                onClick={() => setOpen(false)}
                aria-current={current ? "page" : undefined}
                className={`block rounded-lg px-3 py-2.5 transition ${
                  current ? "sf-panel-active" : "hover:bg-white/[0.08]"
                }`}
              >
                <span className="block text-xs uppercase tracking-[0.25em] text-white">
                  {page.label}
                </span>
                <span className="mt-1 block text-xs text-white/60">{page.hint}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  // The visitor's own day, known only once mounted: the server runs on UTC, which can already be
  // tomorrow (or still yesterday). It also turns over at midnight while the page is open.
  const {today: day} = useSchedule();
  const today = day ? formatDay(day, {weekday: "long", month: "short", day: "numeric"}) : "";
  // Phones don't have room for the full weekday next to the settings button.
  const todayShort = day ? formatDay(day, {weekday: "short", month: "short", day: "numeric"}) : "";

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.3em] text-white sm:tracking-[0.4em]">
          STUDYFLOW
        </Link>
        <div className="flex items-center gap-4 sm:gap-5">
          {/* The narrowest phones don't have room for the date next to the buttons. */}
          <p className="whitespace-nowrap text-[11px] uppercase tracking-[0.2em] text-white/75 max-[359px]:hidden sm:tracking-[0.3em]">
            <span className="hidden sm:inline">{today}</span>
            <span className="sm:hidden">{todayShort}</span>
          </p>
          <Link
            href="/clock"
            aria-label="Open the clock"
            title="Clock"
            className="-m-2 flex h-9 w-9 items-center justify-center rounded-md text-white/75 transition hover:bg-white/[0.06] hover:text-white"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="8" cy="8" r="5.8" />
              <path d="M8 4.8V8l2.2 1.4" />
            </svg>
          </Link>
          <MuteButton />
          <SettingsMenu />
        </div>
      </header>

      <nav aria-label="Sections" className="mt-8 flex gap-5 border-b border-white/15 sm:gap-8">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={tabClass(pathname === "/")}>
          Dashboard
        </Link>
        <CalendarMenu pathname={pathname} />
        <Link
          href="/progress"
          aria-current={pathname === "/progress" ? "page" : undefined}
          className={tabClass(pathname === "/progress")}
        >
          Progress
        </Link>
      </nav>
    </>
  );
}
