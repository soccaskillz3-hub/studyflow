import {requireUser} from "../lib/dal";

// The focus timer works on the logged-in user's sessions.
export default async function FocusLayout({children}: LayoutProps<"/focus">) {
  await requireUser();
  return children;
}
