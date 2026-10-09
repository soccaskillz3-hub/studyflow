"use client";

import {useCallback, useEffect, useRef, type RefObject} from "react";

// Swiping sideways to go to the next or previous thing (day, week, clock style), for:
//  - touch screens (phones, iPads): a quick sideways flick of a finger;
//  - trackpads: a two-finger sideways swipe, which arrives as horizontal wheel events.
// `direction` is 1 for next (content moves left, like turning a page) and -1 for previous.
// `onMove` reports how far the gesture has gone (in px, negative = towards next) so the
// content can follow it, and 0 when it ends. Or with `follow`, the swipe area itself moves a
// little with the gesture, and after a swipe waits on the far side, faded, until `settle()`
// (call it once the next thing has arrived) slides it into place.

type Options = {
  onSwipe: (direction: 1 | -1) => void;
  onMove?: (dx: number) => void;
  touch?: boolean; // false when the page handles touch itself (e.g. with pointer events)
  follow?: boolean;
  enabled?: boolean;
};

const TOUCH_MIN_PX = 50; // how far a finger must travel sideways
const TOUCH_MAX_MS = 800; // ...within this long, so a slow drag that's really a scroll doesn't count
const EDGE_PX = 24; // touches starting this close to the screen edge are the browser's back/forward gesture
const WHEEL_MIN_PX = 90; // how far a trackpad swipe must scroll sideways
const WHEEL_QUIET_MS = 220; // a pause this long ends one trackpad gesture (and its momentum)
const FOLLOW = 0.35; // with `follow`, how much the area moves with the gesture
const MAX_FOLLOW_PX = 70;
const ARRIVE_PX = 36; // ...and how far away the next thing starts before sliding in
const ARRIVE_TIMEOUT_MS = 2000; // if it hasn't arrived by then, slide back anyway

// Shared by every swipe area, because a swipe can replace the area itself (the day view is
// rebuilt for each day): the trackpad gesture still in progress, whose momentum mustn't count
// as a second swipe on the new area, and a swipe whose next thing hasn't slid in yet.
const wheel = {travelled: 0, fired: false, quiet: undefined as ReturnType<typeof setTimeout> | undefined};
let arrival: {direction: 1 | -1; at: number} | null = null;

// The trackpad handler of the swipe area on screen now (the latest one set up).
let currentWheel: ((e: WheelEvent) => void) | null = null;
let watched: {target: EventTarget; relay: (e: Event) => void} | null = null;

// A browser can keep sending a trackpad's wheel events to the element the cursor was over when
// the gesture began, until the mouse moves (Safari especially) — even after a swipe has replaced
// that element with the next day's or week's content. Those events then go to an element that's
// no longer on the page, so they never reach the swipe area, and swiping seems to stop working
// until the cursor moves. Listening on that element itself still hears them, and passes them on.
function watchTarget(target: EventTarget | null) {
  if (watched?.target === target) return;
  if (watched) watched.target.removeEventListener("wheel", watched.relay);
  watched = null;
  if (!target) return;
  const relay = (e: Event) => {
    // While it's still on the page, its events reach the swipe area by bubbling as usual.
    if (e.target instanceof Node && !e.target.isConnected) currentWheel?.(e as WheelEvent);
  };
  target.addEventListener("wheel", relay, {passive: true});
  watched = {target, relay};
}

// The nearest element under `target` (inside `root`) that scrolls sideways, if any. Swipes
// inside it scroll it, and only count as navigation once it can't scroll any further.
function sidewaysScroller(target: EventTarget | null, root: Element) {
  for (let el = target instanceof Element ? target : null; el && root.contains(el); el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return el;
  }
  return null;
}

const canScroll = (el: Element, direction: 1 | -1) =>
  direction > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 1;

export function useSwipe(area: RefObject<HTMLElement | null>, options: Options) {
  // Always call the latest callbacks without re-adding listeners on every render.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const enabled = options.enabled ?? true;
  const touch = options.touch ?? true;
  const node = useRef<HTMLElement | null>(null);
  const arriving = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shift = useCallback((px: number, opacity: number, animate: boolean) => {
    const el = node.current;
    if (!el) return;
    el.style.transition = animate ? "transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 450ms ease" : "none";
    el.style.transform = px ? `translateX(${px}px)` : "";
    el.style.opacity = opacity === 1 ? "" : String(opacity);
  }, []);

  const settle = useCallback(() => {
    if (!arriving.current) return;
    clearTimeout(arriving.current);
    arriving.current = null;
    arrival = null;
    requestAnimationFrame(() => shift(0, 1, true));
  }, [shift]);

  useEffect(() => {
    const root = area.current;
    if (!root || !enabled) return;
    node.current = root;

    // Swiped here from a previous area that's since been replaced: start on the far side, so
    // settle() slides this one in.
    if (arrival && latest.current.follow && performance.now() - arrival.at < ARRIVE_TIMEOUT_MS) {
      shift(arrival.direction * ARRIVE_PX, 0.25, false);
      arriving.current = setTimeout(settle, ARRIVE_TIMEOUT_MS);
    }

    const move = (dx: number) => {
      latest.current.onMove?.(dx);
      if (!latest.current.follow || arriving.current) return;
      const px = Math.max(-MAX_FOLLOW_PX, Math.min(MAX_FOLLOW_PX, dx * FOLLOW));
      shift(px, 1 - Math.abs(px) / (MAX_FOLLOW_PX * 3), dx === 0);
    };
    const swipe = (direction: 1 | -1) => {
      if (latest.current.follow) {
        shift(direction * ARRIVE_PX, 0.25, false);
        arriving.current = setTimeout(settle, ARRIVE_TIMEOUT_MS);
        arrival = {direction, at: performance.now()};
      }
      latest.current.onSwipe(direction);
    };

    // ---------- Touch ----------
    let start: {x: number; y: number; t: number; scroller: Element | null; scrollLeft: number} | null = null;
    let sideways = false;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX) {
        start = null;
        return;
      }
      const scroller = sidewaysScroller(e.target, root);
      start = {x: t.clientX, y: t.clientY, t: performance.now(), scroller, scrollLeft: scroller?.scrollLeft ?? 0};
      sideways = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Decide once whether this is a sideways gesture or a vertical scroll.
      if (!sideways && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) sideways = true;
      if (sideways && (!start.scroller || start.scroller.scrollLeft === start.scrollLeft)) move(dx);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Inside something that scrolls sideways, the swipe was for scrolling it if it moved.
      const scrolled = start.scroller !== null && Math.abs(start.scroller.scrollLeft - start.scrollLeft) > 1;
      const quick = performance.now() - start.t < TOUCH_MAX_MS;
      const swiped = sideways && !scrolled && quick && Math.abs(dx) > TOUCH_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5;
      start = null;
      if (swiped) swipe(dx < 0 ? 1 : -1);
      else move(0);
    };
    const onTouchCancel = () => {
      start = null;
      move(0);
    };

    // ---------- Trackpad ----------
    // One swipe per gesture: once it's fired, the rest of it (momentum included) is ignored.

    const onWheel = (e: WheelEvent) => {
      // Mostly vertical: a normal scroll. Ctrl + wheel: a pinch to zoom.
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      watchTarget(e.target);
      const direction = e.deltaX > 0 ? 1 : -1;
      const scroller = sidewaysScroller(e.target, root);
      if (scroller && canScroll(scroller, direction)) return;

      clearTimeout(wheel.quiet);
      wheel.quiet = setTimeout(() => {
        wheel.travelled = 0;
        wheel.fired = false;
        if (!arriving.current) move(0);
      }, WHEEL_QUIET_MS);
      if (wheel.fired) return;

      wheel.travelled += e.deltaX;
      move(-wheel.travelled);
      if (Math.abs(wheel.travelled) > WHEEL_MIN_PX) {
        wheel.fired = true;
        latest.current.onMove?.(0);
        swipe(wheel.travelled > 0 ? 1 : -1);
      }
    };

    // Otherwise a sideways trackpad swipe also goes back or forward in the browser's history.
    const html = document.documentElement;
    const previousOverscroll = html.style.overscrollBehaviorX;
    html.style.overscrollBehaviorX = "none";

    if (touch) {
      root.addEventListener("touchstart", onTouchStart, {passive: true});
      root.addEventListener("touchmove", onTouchMove, {passive: true});
      root.addEventListener("touchend", onTouchEnd, {passive: true});
      root.addEventListener("touchcancel", onTouchCancel, {passive: true});
    }
    root.addEventListener("wheel", onWheel, {passive: true});
    currentWheel = onWheel;
    return () => {
      if (currentWheel === onWheel) currentWheel = null;
      if (arriving.current) clearTimeout(arriving.current);
      html.style.overscrollBehaviorX = previousOverscroll;
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchCancel);
      root.removeEventListener("wheel", onWheel);
    };
  }, [area, enabled, touch, shift, settle]);

  return {settle};
}
