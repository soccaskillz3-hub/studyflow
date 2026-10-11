"use client";

import {useEffect} from "react";
import {forgetThisBrowser} from "../lib/account";

// Shown on the welcome page right after someone deletes their account. Also forgets what Zeflo
// kept in this browser (theme, sound, timer), as logging out does.
export default function AccountDeleted() {
  useEffect(forgetThisBrowser, []);
  return (
    <p role="status" className="mb-10 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-white/85">
      Your account and everything in it has been deleted. Thanks for studying with Zeflo.
    </p>
  );
}
