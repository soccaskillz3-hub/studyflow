import AppHeader from "../components/AppHeader";
import ScheduleNotices from "../components/ScheduleNotices";
import {requireUser} from "../lib/dal";

// The header and page column shared by Today and the Calendar pages. The focus timer
// lives outside this group so it can take over the whole screen.
export default async function MainLayout({children}: LayoutProps<"/">) {
  await requireUser();
  return (
    <main className="sf-lift flex-1 font-mono text-white">
      <div className="mx-auto max-w-3xl px-5 pb-48 pt-10 sm:px-8 sm:pt-14">
        <AppHeader />
        <ScheduleNotices />
        {children}
      </div>
    </main>
  );
}
