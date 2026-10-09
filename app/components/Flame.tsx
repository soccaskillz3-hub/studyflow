// The streak flame: filled and glowing once something's done today, an outline until then.
export default function Flame({lit, className = "h-3.5 w-3.5"}: {lit: boolean; className?: string}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={`${className} ${lit ? "text-scene drop-shadow-[0_0_6px_var(--accent-glow)]" : "text-white/50"}`}
      fill={lit ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={lit ? 0 : 1.3}
      strokeLinejoin="round"
    >
      <path d="M8 1.5c.4 2.2 2.1 3.4 3.3 4.9 1.1 1.4 1.7 2.8 1.7 4.2A5 5 0 0 1 8 15a5 5 0 0 1-5-4.4c0-1.6.8-3 1.9-3.9-.1 1.2.3 2.2 1.2 2.7C6 6.6 6.6 3.7 8 1.5z" />
    </svg>
  );
}
