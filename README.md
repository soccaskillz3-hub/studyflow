# StudyFlow

**Your study. Your schedule. Your flow.**

StudyFlow is a calm daily study planner. Lay out today's sessions, run a full-screen focus timer for each one, and watch your progress fill in — all floating over a living scene, an ocean or a forest, that follows the real weather and time of day where you are, with sound to match.

<p>
  <img src="docs/screenshots/forest-day.jpg" alt="Today in the forest theme on a clear day, with light falling through the trees" width="49%">
  <img src="docs/screenshots/ocean-night.jpg" alt="Today in the ocean theme on a clear night" width="49%">
</p>
<p>
  <img src="docs/screenshots/forest-snow.jpg" alt="The forest at sunrise with snow settled on the trees" width="49%">
  <img src="docs/screenshots/ocean-rainbow.jpg" alt="A rainbow over the ocean after the rain clears" width="49%">
</p>

## Features

### Plan and focus

- **Today** — your progress for the day (study time done out of time planned, breaks excluded), what's next, and today's sessions. Click a session to tick it off.
- **Calendar** — an hour-by-hour **day view** with a live "now" line. Click any open time to add a session there; overlapping sessions sit side by side. **Schedule** lists every session with an add form.
- **Focus timer** — press **Start?** on a session for a full-screen countdown of its length. Pause with the button or the space bar, take a break (10, 20, 30 minutes or your own length), add 10 more minutes when time's up, and press **Done** for a little celebration. The timer survives reloads and leaving the page, and the tab title shows the time left.
- **Custom time picker** — hour, minute and AM/PM columns with keyboard support.
- **Saved automatically** — everything is kept in your browser (`localStorage`).

<p>
  <img src="docs/screenshots/calendar.jpg" alt="The calendar's day view with the current session highlighted" width="49%">
  <img src="docs/screenshots/settings.jpg" alt="Settings, with the theme cards and the weather and time of day dropdown" width="49%">
</p>

### Themes

Pick a theme in **Settings → Theme & scene**:

- **Ocean** — open sky over rolling, animated water.
- **Forest** — layered trees under an overhanging canopy, with light shafts falling through the gaps, drifting dust, fireflies after dark, and **wildlife that comes and goes**: birds, butterflies and a rabbit by day, deer at dawn and dusk, bats at dusk, and an owl and a fox at night.

Each theme has its own **timer font** for a completely different feel — a thin, airy sans by the ocean; a soft, chunky storybook serif in the forest — and the app's **accent colour** (progress bar, buttons, the timer) changes with the scene, picked to stand out against that sky.

<p>
  <img src="docs/screenshots/timer-ocean.jpg" alt="The focus timer in the ocean theme" width="49%">
  <img src="docs/screenshots/timer-forest.jpg" alt="The focus timer in the forest theme, with snow piling up" width="49%">
</p>

### Weather and time of day

- **Four times of day** — sunrise, day, dusk and night, from your local sunrise and sunset.
- **Six weathers** — clear, cloudy, rain, storm (lightning, with thunder that follows it), snow and fog, from your current local weather.
- **Snow builds up** gradually: it settles on the ground and the trees over a couple of minutes, and piles up along the bottom of the timer while you focus.
- **A rainbow** appears for a while when rain or a storm clears.
- Choose **Auto** to follow your location, or pick any weather and time yourself.

### Sound

Every scene has its own soundscape, all synthesized in the browser (there are no audio files): waves, wind, rain and thunder; gulls, a buoy bell and a foghorn at sea; rustling leaves, birdsong, a woodpecker, crickets, frogs and owls in the forest. Animals you can see make their own sounds — the owl hoots, the deer's footsteps crunch through the leaves.

Turn sound on or off with the speaker button, and set **Master**, **Ambience**, **Wildlife** and **Timer chime** volumes in **Settings → Sound**. Browsers only allow audio after you interact with the page, so sound starts on your first click.

Everything cross-fades as it changes, and motion is reduced or turned off if your system asks for reduced motion.

## Getting started

Requires [Node.js](https://nodejs.org) 20.9 or newer.

```bash
git clone https://github.com/soccaskillz3-hub/studyflow.git
cd studyflow
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Your browser will ask for your location so the scene can match your weather; if you decline, StudyFlow falls back to a clear sky and your device's clock.

| Command         | What it does               |
| --------------- | -------------------------- |
| `npm run dev`   | Start the dev server       |
| `npm run build` | Production build           |
| `npm start`     | Serve the production build |
| `npm run lint`  | Run ESLint                 |

In development, `window.__studyflowSound` in the browser console exposes the audio mixer for debugging. It's left out of production builds.

## How weather and time work

When you allow location access, StudyFlow asks [Open-Meteo](https://open-meteo.com) for the current weather code and today's sunrise and sunset, then refreshes every 30 minutes. Your coordinates are rounded to two decimal places (about 1 km) before being sent, and nothing else leaves your browser — there's no account, server or database.

- **Weather** comes from Open-Meteo's [WMO weather codes](https://open-meteo.com/en/docs#weather_variable_documentation), grouped into the six scenes.
- **Time of day**: sunrise runs from 45 minutes before to 75 minutes after sunrise; dusk from an hour before to 45 minutes after sunset; day and night fill the rest. Without location, sunrise and sunset are assumed to be 6:30 AM and 7:00 PM.

Open-Meteo's free API is for non-commercial use, which suits a personal project like this.

## Built with

- [Next.js 16](https://nextjs.org) (App Router) and [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org) and [Tailwind CSS 4](https://tailwindcss.com)
- The Web Audio API for every sound
- [Geist](https://vercel.com/font), [Jost](https://fonts.google.com/specimen/Jost) and [Fraunces](https://fonts.google.com/specimen/Fraunces)
- [Open-Meteo](https://open-meteo.com) for weather, sunrise and sunset

## Project structure

```
app/
├── (main)/                     # Pages that share the header
│   ├── page.tsx                # Today: progress, next up, today's sessions
│   └── calendar/
│       ├── page.tsx            # Day view
│       └── schedule/page.tsx   # Schedule: add form and full list
├── focus/[id]/page.tsx         # Full-screen focus timer
├── layout.tsx                  # Fonts, metadata and the app-wide providers
├── globals.css                 # Theme, scene palettes and animations
├── components/
│   ├── backdrop/               # The scene behind everything
│   │   ├── Backdrop.tsx        # Picks the theme, cross-fades, rainbows
│   │   ├── OceanScene.tsx      # Sky over water
│   │   ├── ForestScene.tsx     # Trees, light shafts, fireflies, snow
│   │   ├── ForestWildlife.tsx  # Animals and when they visit
│   │   ├── WeatherLayers.tsx   # Rain, lightning, snow and fog (shared)
│   │   └── forestShapes.ts     # Generated tree, canopy and fern shapes
│   ├── SettingsMenu.tsx        # Theme & scene, Sound
│   ├── MuteButton.tsx
│   ├── TimePicker.tsx
│   └── …                       # Header, session form and list
└── lib/
    ├── scene.tsx               # Theme, live weather and time of day
    ├── sound.tsx               # Sound settings, starts the soundscape
    ├── audio/
    │   ├── engine.ts           # The Web Audio graph, volumes, noise
    │   ├── soundscape.ts       # Ambient beds and calls for each scene
    │   └── sfx.ts              # One-off sounds: animals, thunder, chimes
    ├── schedule.tsx            # Sessions and what's done
    ├── timer.ts                # The focus timer
    ├── weather.ts              # Open-Meteo request, weather codes, time of day
    └── time.ts                 # "HH:MM" helpers
```
