import type {Metadata} from "next";
import Link from "next/link";
import {CONTACT} from "../../lib/site";

export const metadata: Metadata = {title: "Support · Zeflo"};

export default function SupportPage() {
  return (
    <>
      <h1>Support</h1>
      <p>
        Something not working, or an idea for Zeflo? Get in touch through <a href={CONTACT.href}>{CONTACT.label}</a> and you&apos;ll hear back, usually within a couple of
        days.
      </p>

      <h2>Connecting your AI</h2>
      <ul>
        <li>
          <strong>Claude:</strong> in Zeflo, open Settings → Your AI and follow the steps there. It works on Claude&apos;s free plan too.
        </li>
        <li>
          <strong>ChatGPT:</strong> coming soon. We&apos;re working on it.
        </li>
        <li>
          <strong>To disconnect</strong> an assistant, open Settings → Your AI in Zeflo and choose Disconnect next to it.
        </li>
      </ul>

      <h2>Common questions</h2>
      <ul>
        <li>
          <strong>Sessions my AI added don&apos;t show up.</strong> Switch back to the Zeflo tab, or reload the page. Zeflo checks for changes
          when you come back to it.
        </li>
        <li>
          <strong>Can my AI change my classes?</strong> No. It can read them and plan study sessions around them, but only you can change your
          classes, in Zeflo itself.
        </li>
        <li>
          <strong>The scene shows the wrong weather.</strong> Zeflo needs your browser&apos;s permission to find your local weather. You can also
          choose the weather and time of day yourself in Settings → Theme.
        </li>
        <li>
          <strong>Deleting your account:</strong> open Settings and choose Delete account, under your email. Everything in it is removed
          straight away. If you can&apos;t log in any more, get in touch through <a href={CONTACT.href}>{CONTACT.label}</a> instead.
        </li>
      </ul>

      <p>
        See also the <Link href="/privacy">privacy policy</Link> and <Link href="/terms">terms of use</Link>.
      </p>
    </>
  );
}
