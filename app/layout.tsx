import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "./components/AppHeader";
import { SceneProvider } from "./lib/scene";
import { ScheduleProvider } from "./lib/schedule";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyFlow",
  description: "Plan your study day and track your progress.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SceneProvider>
          <ScheduleProvider>
            <main className="sf-lift flex-1 font-mono text-white">
              <div className="mx-auto max-w-3xl px-5 pb-48 pt-10 sm:px-8 sm:pt-14">
                <AppHeader />
                {children}
              </div>
            </main>
          </ScheduleProvider>
        </SceneProvider>
      </body>
    </html>
  );
}
