"use client";

import {useSound} from "../lib/sound";

// Quick sound on/off in the header; volumes live in Settings → Sound.
export default function MuteButton() {
  const {settings, update} = useSound();
  const on = settings.enabled;

  return (
    <button
      type="button"
      aria-label={on ? "Mute sound" : "Turn sound on"}
      aria-pressed={!on}
      title={on ? "Mute sound" : "Turn sound on"}
      onClick={() => update({enabled: !on})}
      className="-m-2 flex h-9 w-9 items-center justify-center rounded-md text-white/75 transition hover:bg-white/[0.06] hover:text-white"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5Z" fill="currentColor" fillOpacity="0.15" />
        {on ? (
          <>
            <path d="M10.5 5.8a3.2 3.2 0 0 1 0 4.4" />
            <path d="M12.3 4a5.8 5.8 0 0 1 0 8" />
          </>
        ) : (
          <path d="M10.6 6.2l3.4 3.6M14 6.2l-3.4 3.6" />
        )}
      </svg>
    </button>
  );
}
