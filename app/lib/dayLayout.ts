import type {ClassMeeting} from "./classes";
import type {Session} from "./schedule";
import {toMinutes} from "./time";

// Something on the calendar: a study session (or break), or a class imported from the
// user's class schedule.
export type Entry =
  | {kind: "session"; id: string; label: string; start: string; end: string; session: Session}
  | {kind: "class"; id: string; label: string; start: string; end: string; meeting: ClassMeeting};

export type Block = {entry: Entry; start: number; end: number; lane: number; lanes: number};

export const classLabel = (m: ClassMeeting) => [m.code, m.component].filter(Boolean).join(" ");

// A day's sessions and classes together, in start-time order.
export function dayEntries(sessions: Session[], classes: ClassMeeting[]): Entry[] {
  return [
    ...sessions.map((session) => ({
      kind: "session" as const,
      id: session.id,
      label: session.subject,
      start: session.start,
      end: session.end,
      session,
    })),
    ...classes.map((meeting) => ({
      kind: "class" as const,
      id: `class-${meeting.id}`,
      label: classLabel(meeting),
      start: meeting.start,
      end: meeting.end,
      meeting,
    })),
  ].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

// Place entries in side-by-side lanes so overlapping ones don't cover each other.
// Entries that overlap (directly or through a chain) form a cluster and share its lane count.
// Expects entries in start-time order.
export function layoutBlocks(entries: Entry[]): Block[] {
  const blocks: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = Math.max(...cluster.map((b) => b.lane)) + 1;
    cluster.forEach((b) => (b.lanes = lanes));
  };

  for (const entry of entries) {
    const start = toMinutes(entry.start);
    const end = toMinutes(entry.end);
    if (cluster.length && start >= clusterEnd) {
      closeCluster();
      cluster = [];
      laneEnds = [];
    }
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;

    const block = {entry, start, end, lane, lanes: 1};
    cluster.push(block);
    blocks.push(block);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) closeCluster();
  return blocks;
}

// The hours a timeline should show: a normal waking day (8 AM to 10 PM), stretched to fit
// everything in `spans` and the current time.
export function hourRange(spans: {start?: string; end?: string}[], now: number | null) {
  const starts = spans.filter((s) => s.start).map((s) => toMinutes(s.start!));
  const ends = spans.filter((s) => s.end).map((s) => toMinutes(s.end!));
  const first = Math.min(8, ...starts.map((m) => Math.floor(m / 60)), ...(now === null ? [] : [Math.floor(now / 60)]));
  const last = Math.max(22, ...ends.map((m) => Math.ceil(m / 60)), ...(now === null ? [] : [Math.floor(now / 60) + 1]));
  return {first, last};
}
