// Hands a just-finished session from the focus page to the dashboard, so the
// dashboard can animate its progress up from where it was. Lives in sessionStorage:
// it's read once and removed, and never outlives the tab.

export type Celebration = {subject: string; minutes: number};

const KEY = "studyflow:celebrate";

export function stashCelebration(celebration: Celebration) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(celebration));
  } catch {
    // The dashboard just shows the new total without the animation.
  }
}

export function takeCelebration(): Celebration | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
