export type Weather = "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog";
export type TimeOfDay = "sunrise" | "day" | "dusk" | "night";

export const WEATHERS: Weather[] = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
export const TIMES: TimeOfDay[] = ["sunrise", "day", "dusk", "night"];

export type SunTimes = {sunrise: number; sunset: number}; // epoch ms

// Maps WMO weather interpretation codes (used by Open-Meteo) to a backdrop scene.
// https://open-meteo.com/en/docs#weather_variable_documentation
export function weatherFromCode(code: number): Weather {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code === 2 || code === 3) return "cloudy";
  return "clear";
}

const HOUR = 60 * 60 * 1000;

// Sunrise glow runs from 45 min before to 75 min after sunrise; dusk from 1 h before
// to 45 min after sunset. Without real sun times, assume 6:30 AM and 7:00 PM locally.
export function timeOfDay(now: Date, sun?: SunTimes | null): TimeOfDay {
  let rise = sun?.sunrise;
  let set = sun?.sunset;
  if (rise === undefined || set === undefined) {
    rise = new Date(now).setHours(6, 30, 0, 0);
    set = new Date(now).setHours(19, 0, 0, 0);
  }
  const t = now.getTime();
  if (t >= rise - 0.75 * HOUR && t < rise + 1.25 * HOUR) return "sunrise";
  if (t >= rise + 1.25 * HOUR && t < set - HOUR) return "day";
  if (t >= set - HOUR && t < set + 0.75 * HOUR) return "dusk";
  return "night";
}

export async function fetchWeather(latitude: number, longitude: number, signal?: AbortSignal) {
  // Two decimals (~1 km) is plenty for weather and avoids sending a precise location.
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    current: "weather_code",
    daily: "sunrise,sunset",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "1",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {signal});
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  const data: {
    current?: {weather_code?: number};
    daily?: {sunrise?: number[]; sunset?: number[]};
  } = await res.json();

  const code = data.current?.weather_code;
  if (typeof code !== "number") throw new Error("Weather response missing weather_code");
  const sunrise = data.daily?.sunrise?.[0];
  const sunset = data.daily?.sunset?.[0];
  const sun: SunTimes | null =
    typeof sunrise === "number" && typeof sunset === "number"
      ? {sunrise: sunrise * 1000, sunset: sunset * 1000}
      : null;

  return {weather: weatherFromCode(code), sun};
}
