import Link from "next/link";

// A narrow column over the scene for the account pages (sign up, log in, password reset).
export default function AuthLayout({children}: {children: React.ReactNode}) {
  return (
    <main className="sf-lift flex flex-1 flex-col font-mono text-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 pb-24 pt-10 sm:pt-14">
        <Link href="/" className="text-sm font-semibold tracking-[0.4em] text-white">
          ZEFLO
        </Link>
        <div className="mt-16 sm:mt-24">{children}</div>
      </div>
    </main>
  );
}
