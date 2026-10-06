export type Weather = "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog";

export const WEATHERS: Weather[] = ["clear", "cloudy", "rain", "storm", "snow", "fog"];

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

export async function fetchWeather(latitude: number, longitude: number, signal?: AbortSignal) {
  // Two decimals (~1 km) is plenty for weather and avoids sending a precise location.
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    current: "weather_code",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {signal});
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  const data: {current?: {weather_code?: number}} = await res.json();
  const code = data.current?.weather_code;
  if (typeof code !== "number") throw new Error("Weather response missing weather_code");
  return weatherFromCode(code);
}
