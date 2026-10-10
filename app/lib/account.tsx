"use client";

import {createContext, useContext, type ReactNode} from "react";

export type Account = {id: string; email: string};

const AccountContext = createContext<Account | null>(null);

// The logged-in user, checked on the server by the root layout. Null when logged out.
export function AccountProvider({account, children}: {account: Account | null; children: ReactNode}) {
  return <AccountContext value={account}>{children}</AccountContext>;
}

export function useAccount() {
  return useContext(AccountContext);
}

// Everything Zeflo keeps in this browser (the keys still say "studyflow", the app's old name:
// renaming them would reset everyone's saved theme, sound and timer). Cleared when logging out, so the next person to
// log in here doesn't inherit any of it.
const LOCAL_KEYS = [
  "studyflow:v1",
  "studyflow:timer",
  "studyflow:theme",
  "studyflow:weather-override",
  "studyflow:time-override",
  "studyflow:sound-v2",
];

export function forgetThisBrowser() {
  try {
    LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem("studyflow:celebrate");
  } catch {
    // Storage unavailable: nothing was saved here to begin with.
  }
}
