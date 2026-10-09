import {requireUser} from "../lib/dal";

// The clock is part of the app, like the focus timer, and takes over the whole screen.
export default async function ClockLayout({children}: LayoutProps<"/clock">) {
  await requireUser();
  return children;
}
