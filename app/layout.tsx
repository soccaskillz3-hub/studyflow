import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Jost } from "next/font/google";
import "./globals.css";
import { AccountProvider } from "./lib/account";
import { ClassesProvider } from "./lib/classes";
import { getUser } from "./lib/dal";
import { SceneProvider } from "./lib/scene";
import { ScheduleProvider } from "./lib/schedule";
import { SettingsSync } from "./lib/settingsSync";
import { SoundProvider } from "./lib/sound";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display faces for the focus timer, one per theme for a different feel in each: a thin,
// airy geometric sans by the ocean, and a chunky, soft, storybook serif in the forest
// (see --font-timer in globals.css).
const jost = Jost({
  variable: "--font-jost",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyFlow",
  description: "Plan your study day and track your progress.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jost.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AccountProvider account={user}>
          <SceneProvider>
            <SoundProvider>
              {user && <SettingsSync key={user.id} userId={user.id} />}
              {/* Keyed by account, so nothing from one login carries over to the next. */}
              <ScheduleProvider key={user?.id ?? "guest"} userId={user?.id ?? null}>
                <ClassesProvider key={user?.id ?? "guest"} userId={user?.id ?? null}>
                  {children}
                </ClassesProvider>
              </ScheduleProvider>
            </SoundProvider>
          </SceneProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
