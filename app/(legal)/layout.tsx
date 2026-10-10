import Link from "next/link";

// A readable column over the scene for the privacy policy, terms and support pages. Open to
// everyone, logged in or not.
export default function LegalLayout({children}: {children: React.ReactNode}) {
  return (
    <main className="sf-lift flex flex-1 flex-col font-mono text-white">
      <div className="mx-auto w-full max-w-2xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold tracking-[0.4em]">
            ZEFLO
          </Link>
          <nav className="flex gap-5 text-[11px] uppercase tracking-[0.25em] text-white/65">
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/support" className="transition hover:text-white">
              Support
            </Link>
          </nav>
        </header>
        <article className="sf-legal mt-16 sm:mt-24">{children}</article>
      </div>
    </main>
  );
}
