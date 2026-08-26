import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Mail, ShieldCheck, Sparkles } from "lucide-react";

type PublicAppInfoPageProps = {
  title: string;
  summary: string;
  updated: string;
  appName: string;
  routePrefix: string;
  children: ReactNode;
};

type GpsDriverInfoPageProps = Omit<
  PublicAppInfoPageProps,
  "appName" | "routePrefix"
>;

export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/10 py-9 first:border-t-0 first:pt-0 sm:py-11">
      <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-7 text-white/62 sm:text-base sm:leading-8">
        {children}
      </div>
    </section>
  );
}
export function InfoList({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-3 pl-5 marker:text-[#8af7d1] [&>li]:pl-2">
      {children}
    </ul>
  );
}

export function PublicAppInfoPage({
  title,
  summary,
  updated,
  appName,
  routePrefix,
  children,
}: PublicAppInfoPageProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#030506] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-90" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_4%,rgba(95,245,204,0.15),transparent_25%),radial-gradient(circle_at_86%_24%,rgba(74,103,255,0.12),transparent_25%),linear-gradient(180deg,#030506_0%,#080b10_48%,#030506_100%)]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:72px_72px]" />
      </div>

      <header className="relative z-10 border-b border-white/8 bg-[#030506]/78 backdrop-blur-xl">
        <nav className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8" aria-label={`${appName} public pages`}>
          <Link
            href="/"
            className="flex items-center gap-3 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8af7d1]"
            aria-label="Trickee home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.04] text-[#8af7d1]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold tracking-[0.08em] text-white/86">TRICKEE</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-xs font-medium text-white/54 sm:text-sm">
            <Link className="transition hover:text-white focus-visible:text-white focus-visible:outline-none" href={`${routePrefix}/privacy`}>Privacy</Link>
            <Link className="transition hover:text-white focus-visible:text-white focus-visible:outline-none" href={`${routePrefix}/support`}>Support</Link>
            <Link className="transition hover:text-white focus-visible:text-white focus-visible:outline-none" href={`${routePrefix}/terms`}>Terms</Link>
          </div>
        </nav>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-white/48 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8af7d1]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Trickee
        </Link>

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16">
          <article className="min-w-0">
            <div className="border-l border-[#8af7d1]/50 pl-4 text-xs font-medium uppercase tracking-[0.14em] text-[#8af7d1]/86">
              {appName}
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/58 sm:text-lg">
              {summary}
            </p>
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.1em] text-white/34">
              Last updated {updated}
            </p>

            <div className="mt-14">{children}</div>
          </article>

          <aside className="lg:sticky lg:top-8 lg:self-start" aria-label={`${appName} contact information`}>
            <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.3)]">
              <ShieldCheck className="h-6 w-6 text-[#8af7d1]" aria-hidden="true" />
              <h2 className="mt-5 text-lg font-semibold text-white">Need help?</h2>
              <p className="mt-3 text-sm leading-6 text-white/52">
                Contact the Trickee team about privacy, account access, or trip-data concerns.
              </p>
              <a
                href="mailto:support@trickee.co.in"
                className="mt-5 inline-flex w-full items-center justify-between rounded-[8px] border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/82 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8af7d1]"
              >
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#8af7d1]" aria-hidden="true" />
                  Email support
                </span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </aside>
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 text-sm text-white/42 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Trickee. {appName} information.</p>
          <div className="flex flex-wrap gap-5">
            <Link className="hover:text-white" href={`${routePrefix}/privacy`}>Privacy</Link>
            <Link className="hover:text-white" href={`${routePrefix}/support`}>Support</Link>
            <Link className="hover:text-white" href={`${routePrefix}/terms`}>Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function GpsDriverInfoPage(props: GpsDriverInfoPageProps) {
  return (
    <PublicAppInfoPage
      {...props}
      appName="Trickee GPS Driver"
      routePrefix="/gpsdriver"
    />
  );
}
