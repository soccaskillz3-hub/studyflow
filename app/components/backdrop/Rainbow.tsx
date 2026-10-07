import type {TimeOfDay} from "../../lib/weather";

// A rainbow after the rain: fades in, lingers and fades out (see .sf-rainbow). Drawn in the
// sky layer of each theme, so trees and water stay in front of it. No rainbows at night.
export default function Rainbow({time}: {time: TimeOfDay}) {
  if (time === "night") return null;
  return <div className={`sf-rainbow sf-rainbow-${time} absolute`} />;
}
