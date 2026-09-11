import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="text-xl font-bold text-ink">Not available</h1>
      <p className="max-w-sm text-sm text-ink-faint">
        This record doesn&apos;t exist or isn&apos;t in your authorised scope. If you believe this is
        an error, check that you&apos;re signed in as the right regional manager.
      </p>
      <Link href="/" className="btn-primary mt-2">
        Back to overview
      </Link>
    </main>
  );
}
