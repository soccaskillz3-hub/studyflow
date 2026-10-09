"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect, useRef, type RefObject} from "react";
import {useSwipe} from "../lib/useSwipe";

const arrow =
  "flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition hover:bg-white/[0.08] hover:text-white";

function Chevron({flip = false}: {flip?: boolean}) {
  return (
    <svg viewBox="0 0 12 12" className={`h-3 w-3 ${flip ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7.5 2.5L4 6l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Back / forward through days or weeks, with a jump back to the current one when away from it.
// With `swipeArea`, swiping sideways across that element (a finger, or two fingers on a
// trackpad) does the same as the arrows, and the content follows the gesture a little.
export default function CalendarNav({
  prev,
  next,
  home,
  homeLabel,
  atHome,
  prevLabel,
  nextLabel,
  swipeArea,
}: {
  prev: string;
  next: string;
  home: string;
  homeLabel: string; // "Today", "This week"
  atHome: boolean;
  prevLabel: string; // for screen readers: "Previous day"
  nextLabel: string;
  swipeArea?: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const noArea = useRef<HTMLElement>(null);
  const {settle} = useSwipe(swipeArea ?? noArea, {
    enabled: Boolean(swipeArea),
    follow: true,
    onSwipe: (direction) => router.push(direction > 0 ? next : prev, {scroll: false}),
  });

  // New links mean the new day or week has arrived: slide it into place.
  useEffect(() => {
    settle();
  }, [prev, next, settle]);

  return (
    <nav aria-label="Calendar navigation" className="flex items-center gap-1">
      {!atHome && (
        <Link
          href={home}
          scroll={false}
          className="mr-2 text-[11px] uppercase tracking-[0.25em] text-scene-soft transition hover:text-scene-ink"
        >
          {homeLabel}
        </Link>
      )}
      <Link href={prev} scroll={false} aria-label={prevLabel} className={arrow}>
        <Chevron />
      </Link>
      <Link href={next} scroll={false} aria-label={nextLabel} className={arrow}>
        <Chevron flip />
      </Link>
    </nav>
  );
}
