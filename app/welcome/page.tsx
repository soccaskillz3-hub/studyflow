import Link from "next/link";
import SectionLabel from "../components/SectionLabel";

// The front door for people who aren't logged in. The proxy shows it at "/" (and sends
// logged-in visitors straight to Today instead).

const FEATURES = [
  {title: "Plan", text: "Lay out your day's study sessions and breaks on a calendar."},
  {title: "Focus", text: "Start a session for a full-screen timer, with breaks when you need them."},
  {title: "Track", text: "Watch today's progress fill in as you check sessions off."},
];

export default function WelcomePage() {
  return (
    <main className="sf-lift flex flex-1 flex-col font-mono text-white">
      <div className="mx-auto w-full max-w-3xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
        <header className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold tracking-[0.4em]">STUDYFLOW</span>
          <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-white/75 transition hover:text-white">
            Log in
          </Link>
        </header>

        <section className="mt-24 sm:mt-32">
          <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Plan your study day. Then actually do it.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
            A calm planner and focus timer that lives in a scene that follows your weather and time of day.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href="/signup"
              className="border border-scene/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15 active:scale-[0.98]"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="text-xs uppercase tracking-[0.25em] text-scene-soft underline decoration-scene/40 underline-offset-4 transition hover:text-scene-ink"
            >
              I already have one
            </Link>
          </div>
        </section>

        <section className="mt-24">
          <SectionLabel>What you get</SectionLabel>
          <ul className="mt-8 grid gap-8 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <p className="text-xs uppercase tracking-[0.3em] text-scene-ink">{f.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/80">{f.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-12 text-xs text-white/60">Your schedule and progress are private to your account.</p>
        </section>
      </div>
    </main>
  );
}
