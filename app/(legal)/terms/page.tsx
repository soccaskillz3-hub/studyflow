import type {Metadata} from "next";
import Link from "next/link";
import {CONTACT, POLICIES_UPDATED} from "../../lib/site";

export const metadata: Metadata = {title: "Terms of use · Zeflo"};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="sf-legal-meta">Last updated {POLICIES_UPDATED}</p>

      <p>
        These terms apply when you use Zeflo, the study planner at this website, including through an AI assistant you connect to it. By creating
        an account or using Zeflo, you agree to them.
      </p>

      <h2>Your account</h2>
      <p>
        You need to be 13 or older to use Zeflo. Keep your password to yourself, and you&apos;re responsible for what happens in your account.
        Tell us straight away if you think someone else has got into it.
      </p>

      <h2>Your content</h2>
      <p>
        Your classes, study sessions and everything else you put in Zeflo stay yours. You let Zeflo store them and show them back to you (and to
        any AI assistant you connect) only so the app can work. The <Link href="/privacy">privacy policy</Link> explains how they&apos;re
        handled.
      </p>

      <h2>Using Zeflo fairly</h2>
      <ul>
        <li>Don&apos;t try to get into other people&apos;s accounts or data, or get around Zeflo&apos;s security.</li>
        <li>Don&apos;t overload, disrupt or reverse-engineer the service, or use it to break the law.</li>
        <li>Don&apos;t use automated tools to access Zeflo, other than an AI assistant you&apos;ve connected through Zeflo&apos;s own connector.</li>
      </ul>

      <h2>AI assistants</h2>
      <p>
        If you connect an AI assistant, it acts on your instructions in your account. Its suggestions can be wrong, so check its plans, and
        remember that your school&apos;s official timetable and dates always come first. Your use of the assistant itself is covered by its
        own company&apos;s terms.
      </p>

      <h2>The service</h2>
      <p>
        Zeflo is free. It&apos;s provided as is: we work to keep it running and your data safe, but can&apos;t promise it will always be
        available or free of mistakes. Features may change, and we may suspend accounts that break these terms. You can stop using Zeflo and
        ask us to delete your account at any time.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, Zeflo isn&apos;t liable for indirect or consequential losses, such as a missed class, deadline or test,
        that come from using it or not being able to use it.
      </p>

      <h2>Changes</h2>
      <p>
        If these terms change, the date at the top changes too, and significant changes will be announced in the app first. Using Zeflo after a
        change means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Get in touch through <a href={CONTACT.href}>{CONTACT.label}</a>.
      </p>
    </>
  );
}
