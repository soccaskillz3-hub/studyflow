export type Theme = "ocean" | "forest";

export const THEMES: {id: Theme; label: string; description: string}[] = [
  {id: "ocean", label: "Ocean", description: "Open sky over rolling water. Waves, wind and gulls."},
  {id: "forest", label: "Forest", description: "Sunbeams through the trees, with birdsong and wildlife."},
];

export const THEME_IDS = THEMES.map((t) => t.id);
