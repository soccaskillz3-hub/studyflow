import type {Metadata} from "next";
import Link from "next/link";
import {CONTACT, POLICIES_UPDATED} from "../../lib/site";

export const metadata: Metadata = {title: "Privacy policy · Zeflo"};

// What Zeflo keeps, why, who else handles it, and how to remove it. Keep this true to the app:
// update it (and POLICIES_UPDATED) whenever what's collected or who receives it changes.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="sf-legal-meta">Last updated {POLICIES_UPDATED}</p>

      <p>
        Zeflo is a study planner. This page explains what it keeps about you, why, who else handles it, and how to remove it. The short version:
        Zeflo keeps only what it needs to show you your schedule, doesn&apos;t sell it, doesn&apos;t show ads, and doesn&apos;t track you.
      </p>

      <h2>What Zeflo keeps</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address and password. The password is stored only in scrambled (hashed) form, so no one can
          read it, including us.
        </li>
        <li>
          <strong>Your classes:</strong> the timetable you import or enter: course codes and names, class times and days, locations, term dates,
          and tests and exams.
        </li>
        <li>
          <strong>Your study sessions:</strong> the sessions you plan (name, day and time) and when you finish them, which Zeflo uses to show your
          progress and streak.
        </li>
        <li>
          <strong>Your settings:</strong> your theme, scene, sound and timer choices.
        </li>
      </ul>

      <h2>What Zeflo doesn&apos;t keep</h2>
      <ul>
        <li>
          <strong>Your location.</strong> If you allow it, your browser looks up the weather and sunrise and sunset times for the scene. It sends an
          approximate location (rounded to about a kilometre) straight to the weather service, Open-Meteo. It never reaches Zeflo&apos;s servers
          and isn&apos;t saved. If you don&apos;t allow it, the scene uses a default sky.
        </li>
        <li>
          <strong>Your conversations with an AI assistant.</strong> If you connect one, Zeflo only sees the requests it makes to your schedule,
          never your chat.
        </li>
        <li>
          <strong>Analytics or tracking.</strong> Zeflo has no ads, analytics or tracking cookies. It uses only the cookies that keep you logged
          in, and stores your preferences in your browser so the app loads quickly.
        </li>
      </ul>

      <h2>Why</h2>
      <p>
        Only to run Zeflo for you: to show your schedule and progress on any device you log in on, and to let an AI assistant you connect plan
        your study time. Zeflo doesn&apos;t sell your information, use it for advertising, or use it to train AI models.
      </p>

      <h2>Connected AI assistants</h2>
      <p>
        You can connect your own AI assistant, such as Claude, to your Zeflo account. You choose this yourself, and see exactly what
        it can do before you allow it. Once connected, it can read your classes, tests, study sessions and progress, and add, change or remove
        study sessions. It can&apos;t change your classes or settings, or see your password. What the assistant&apos;s company does with what it
        reads is covered by its own privacy policy. You can disconnect it any time from Settings → Your AI in Zeflo.
      </p>

      <h2>Who else handles it</h2>
      <p>Zeflo uses a few services to run, which handle your information only to provide them:</p>
      <ul>
        <li>
          <strong>Supabase</strong> stores your account and data, and handles logging in.
        </li>
        <li>
          <strong>Vercel</strong> hosts the website. Like any website host, it briefly logs requests, including IP addresses, to keep the
          service running and secure.
        </li>
        <li>
          <strong>Open-Meteo</strong> provides the weather for the scene, as described above.
        </li>
      </ul>
      <p>
        These services may store data outside your country. Zeflo won&apos;t share your information with anyone else unless the law requires
        it.
      </p>

      <h2>How long it&apos;s kept</h2>
      <p>
        As long as you have an account. Sessions and classes you delete are removed straight away, and so is everything in your account when
        you delete it.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Change or delete any class, study session or setting in the app at any time.</li>
        <li>Disconnect any AI assistant from Settings → Your AI.</li>
        <li>Logging out clears what Zeflo kept in that browser.</li>
        <li>Delete your account and everything in it from Settings → Delete account. It happens straight away and can&apos;t be undone.</li>
        <li>
          To get a copy of your data, get in touch through <a href={CONTACT.href}>{CONTACT.label}</a>. We&apos;ll check the account is yours
          first.
        </li>
      </ul>

      <h2>Age</h2>
      <p>
        Zeflo is for students aged 13 and up. If you&apos;re younger than the age where you can agree to this yourself where you live, ask a
        parent or guardian before signing up.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, the date at the top changes too. For a significant change, Zeflo will tell you in the app first.</p>

      <h2>Contact</h2>
      <p>
        Questions about your privacy? Get in touch through <a href={CONTACT.href}>{CONTACT.label}</a>. See also the{" "}
        <Link href="/terms">terms of use</Link>.
      </p>
    </>
  );
}
