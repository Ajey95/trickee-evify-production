"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Gauge,
  LineChart,
  Map,
  MessageSquareText,
  Navigation,
  RadioTower,
  Route,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const partners = ["Evify", "ABZO", "FleetOS", "Surat Ops", "Pilot Ready", "Live Range"];

const featureCards = [
  {
    icon: Route,
    title: "Range-aware routing",
    body: "Route choices shaped by battery state, traffic, terrain, and driver behavior.",
    href: "/routes",
  },
  {
    icon: BatteryCharging,
    title: "Charging decisions",
    body: "Clear charge-now, charge-during-wait, or deliver-direct guidance for active fleets.",
    href: "/decisions",
  },
  {
    icon: MessageSquareText,
    title: "Driver assistant",
    body: "Grounded answers for battery, route, charger, and trip questions.",
    href: "/ai",
  },
  {
    icon: RadioTower,
    title: "Live fleet map",
    body: "Moving vehicle context with charger zones, SOC risk, and operational visibility.",
    href: "/map",
  },
];

const metrics = [
  { value: 98802, suffix: "", label: "telemetry records analyzed" },
  { value: 99.6, suffix: "%", label: "SOC prediction accuracy target" },
  { value: 5, suffix: "", label: "pilot vehicles tracked" },
  { value: 3, suffix: "s", label: "decision demo target" },
];

const testimonials = [
  {
    quote: "The dashboard turns range anxiety into an operating decision.",
    name: "Fleet operations lead",
    role: "EV delivery pilot",
  },
  {
    quote: "Every route, nudge, and charge call feels grounded in the vehicle.",
    name: "Mobility analyst",
    role: "Urban fleet planning",
  },
  {
    quote: "The product finally speaks in actions, not raw telemetry.",
    name: "Pilot coordinator",
    role: "Field operations",
  },
];

const demoSteps = [
  {
    step: "01",
    title: "Vehicle signal",
    body: "SOC, current, speed, wait state, and location arrive together.",
    icon: ShieldCheck,
  },
  {
    step: "02",
    title: "Decision window",
    body: "Charging and route options are scored against time and battery margin.",
    icon: LineChart,
  },
  {
    step: "03",
    title: "Driver action",
    body: "The right nudge reaches the driver while the fleet view stays current.",
    icon: CheckCircle2,
  },
];

function MagneticLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      gsap.to(el, { x: x * 0.16, y: y * 0.22, duration: 0.35, ease: "power3.out" });
    };
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.45, ease: "elastic.out(1, 0.45)" });

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <Link
      ref={ref}
      href={href}
      className={
        variant === "primary"
          ? "magnetic inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-[#d7fff1] px-5 text-sm font-semibold text-[#07110f] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8af7d1]"
          : "magnetic inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/14 bg-white/[0.035] px-5 text-sm font-semibold text-white transition-colors hover:border-white/24 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8af7d1]"
      }
    >
      {children}
    </Link>
  );
}

function ProductScene() {
  return (
    <div className="landing-scene relative mx-auto h-[420px] w-full max-w-[640px] overflow-hidden rounded-[8px] border border-white/10 bg-[#080c11] shadow-[0_44px_120px_rgba(0,0,0,0.48)] lg:h-[520px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(106,245,207,0.2),transparent_32%),radial-gradient(circle_at_78%_70%,rgba(78,122,255,0.18),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.08),transparent_36%)]" />
      <div className="absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,0.32)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.32)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="absolute left-6 right-6 top-6 flex items-center justify-between border-b border-white/10 pb-4 text-xs text-white/54">
        <span>TRICKEE OPS</span>
        <span className="font-mono text-[#8af7d1]">LIVE</span>
      </div>

      <div className="absolute left-6 top-24 w-[44%] rounded-[8px] border border-white/10 bg-black/28 p-4 backdrop-blur">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Range</span>
          <Gauge className="h-4 w-4 text-[#8af7d1]" />
        </div>
        <div className="mt-4 text-5xl font-semibold text-white">72</div>
        <div className="mt-1 text-xs text-white/48">km protected</div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-[4px] bg-white/10">
          <div className="h-full w-[72%] rounded-[4px] bg-[#8af7d1]" />
        </div>
      </div>

      <div className="absolute right-6 top-24 w-[42%] rounded-[8px] border border-white/10 bg-black/24 p-4 backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Navigation className="h-4 w-4 text-[#9eb6ff]" />
          Route choice
        </div>
        <div className="mt-5 space-y-3">
          {["Ring Road", "Market Link", "Depot cut"].map((route, index) => (
            <div key={route} className="flex items-center justify-between rounded-[6px] border border-white/8 bg-white/[0.035] px-3 py-2 text-xs">
              <span className="text-white/72">{route}</span>
              <span className={index === 0 ? "text-[#8af7d1]" : "text-white/38"}>{index === 0 ? "Best" : `${index + 6}%`}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-7 left-6 right-6 rounded-[8px] border border-white/10 bg-[#071016]/86 p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Charge during pickup</div>
            <div className="mt-1 text-xs text-white/48">14 min window · 180 m charger · safer arrival buffer</div>
          </div>
          <Zap className="h-5 w-5 text-[#d7fff1]" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          {["SOC +13%", "ETA held", "Risk low"].map((item) => (
            <div key={item} className="rounded-[6px] border border-white/8 bg-white/[0.04] px-3 py-2 text-center text-white/68">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.85 });
    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    const rafId = requestAnimationFrame(raf);
    lenis.on("scroll", ScrollTrigger.update);

    const context = gsap.context(() => {
      gsap.from("[data-hero]", {
        y: 36,
        opacity: 0,
        duration: 1.05,
        stagger: 0.12,
        ease: "power4.out",
      });

      gsap.to(".landing-ambient", {
        yPercent: 8,
        ease: "none",
        scrollTrigger: { trigger: ".landing-hero", start: "top top", end: "bottom top", scrub: true },
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 34,
          opacity: 0,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 82%" },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-counter]").forEach((el) => {
        const target = Number(el.dataset.counter || "0");
        const state = { value: 0 };
        gsap.to(state, {
          value: target,
          duration: 1.4,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 84%" },
          onUpdate: () => {
            el.textContent = target % 1 === 0 ? Math.round(state.value).toLocaleString("en-IN") : state.value.toFixed(1);
          },
        });
      });

      gsap.to(".landing-demo-track", {
        xPercent: -18,
        ease: "none",
        scrollTrigger: {
          trigger: ".landing-demo",
          start: "top 70%",
          end: "bottom 20%",
          scrub: 0.8,
        },
      });
    }, rootRef);

    return () => {
      context.revert();
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <main ref={rootRef} className="min-h-screen overflow-hidden bg-[#030506] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-90">
        <div className="landing-ambient absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(95,245,204,0.16),transparent_26%),radial-gradient(circle_at_82%_24%,rgba(74,103,255,0.13),transparent_24%),linear-gradient(180deg,#030506_0%,#080b10_44%,#030506_100%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:72px_72px]" />
      </div>

      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/8 bg-[#030506]/72 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Trickee home">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.04] text-[#8af7d1]">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-white/86">TRICKEE</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-white/54 md:flex">
            <a href="#platform" className="transition hover:text-white">Platform</a>
            <a href="#demo" className="transition hover:text-white">Demo</a>
            <a href="#proof" className="transition hover:text-white">Proof</a>
            <Link href="/fleet" className="transition hover:text-white">Dashboard</Link>
          </div>
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-white/82 transition hover:bg-white/[0.08]"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <section className="landing-hero relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[0.92fr_1fr] lg:gap-14 lg:pt-24">
        <div className="max-w-3xl">
          <div data-hero className="mb-6 inline-flex items-center gap-2 border-l border-[#8af7d1]/50 pl-3 text-[11px] font-medium uppercase text-[#8af7d1]/86">
            EV operations intelligence
          </div>
          <h1 data-hero className="max-w-4xl text-5xl font-semibold leading-[0.98] text-white sm:text-6xl lg:text-7xl xl:text-[5.75rem]">
            Fleet decisions that arrive before the risk.
          </h1>
          <p data-hero className="mt-7 max-w-xl text-base leading-7 text-white/58 sm:text-lg">
            Trickee turns live EV telemetry into confident routing, charging, and driver guidance for high-velocity delivery teams.
          </p>
          <div data-hero className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MagneticLink href="/signup">
              Start pilot <ArrowRight className="h-4 w-4" />
            </MagneticLink>
            <MagneticLink href="/fleet" variant="secondary">
              Open dashboard
            </MagneticLink>
          </div>
        </div>
        <div data-hero className="relative">
          <ProductScene />
        </div>
      </section>

      <section id="proof" className="relative z-10 border-y border-white/8 bg-white/[0.018] py-8">
        <div className="mx-auto max-w-7xl overflow-hidden px-5 sm:px-8">
          <div className="landing-demo-track flex min-w-max items-center gap-12 text-sm font-medium uppercase text-white/36">
            {[...partners, ...partners].map((partner, index) => (
              <span key={`${partner}-${index}`}>{partner}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div data-reveal className="max-w-3xl">
          <p className="text-sm font-medium uppercase text-[#8af7d1]/70">Command layer</p>
          <h2 className="mt-5 text-5xl font-semibold leading-[0.96] text-white sm:text-6xl lg:text-7xl">
            One cockpit for battery, route, and pickup reality.
          </h2>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link
                data-reveal
                key={feature.title}
                href={feature.href}
                className={`group rounded-[8px] border border-white/10 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#8af7d1]/38 hover:bg-white/[0.055] ${index === 0 ? "md:row-span-2 md:p-8" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-white/10 bg-black/22 text-[#8af7d1]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-white/28 transition group-hover:translate-x-1 group-hover:text-[#8af7d1]" />
                </div>
                <h3 className="mt-8 text-2xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-4 max-w-lg text-sm leading-7 text-white/52">{feature.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="demo" className="landing-demo relative z-10 border-y border-white/8 bg-[#06090d] py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-reveal className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-sm font-medium uppercase text-[#9eb6ff]/76">Live sequence</p>
            <h2 className="mt-5 text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl">
              From signal to action in one flow.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/54">
              The operator sees the window, the driver gets the next move, and the fleet keeps momentum.
            </p>
            <div className="mt-8 flex gap-3">
              <MagneticLink href="/map" variant="secondary">
                View map <Map className="h-4 w-4" />
              </MagneticLink>
              <MagneticLink href="/impact" variant="secondary">
                View impact
              </MagneticLink>
            </div>
          </div>

          <div className="space-y-4">
            {demoSteps.map(({ step, title, body, icon: TypedIcon }) => {
              return (
                <div data-reveal key={title} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-6">
                  <div className="flex items-start gap-5">
                    <span className="font-mono text-xs text-white/34">{step}</span>
                    <TypedIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#8af7d1]" />
                    <div>
                      <h3 className="text-xl font-semibold">{title}</h3>
                      <p className="mt-3 text-sm leading-7 text-white/50">{body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {metrics.map((metric) => (
            <div data-reveal key={metric.label} className="rounded-[8px] border border-white/10 bg-white/[0.03] p-6">
              <div className="text-4xl font-semibold text-white">
                <span data-counter={metric.value}>0</span>
                {metric.suffix}
              </div>
              <p className="mt-4 text-sm leading-6 text-white/48">{metric.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:pb-32">
        <div data-reveal className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase text-[#8af7d1]/70">Field notes</p>
            <h2 className="mt-4 text-4xl font-semibold sm:text-6xl">Built for operations teams.</h2>
          </div>
          <Link href="/reports" className="hidden rounded-[8px] border border-white/12 px-4 py-3 text-sm text-white/72 transition hover:bg-white/[0.06] md:inline-flex">
            Reports
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((item) => (
            <div data-reveal key={item.name} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-6 transition hover:border-white/18 hover:bg-white/[0.052]">
              <p className="text-xl leading-8 text-white/82">“{item.quote}”</p>
              <div className="mt-8 border-t border-white/10 pt-5">
                <div className="text-sm font-semibold text-white">{item.name}</div>
                <div className="mt-1 text-sm text-white/42">{item.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-10 sm:px-8">
        <div data-reveal className="overflow-hidden rounded-[8px] border border-white/10 bg-[linear-gradient(135deg,rgba(138,247,209,0.14),rgba(158,182,255,0.1)_45%,rgba(255,255,255,0.035))] p-8 sm:p-12 lg:p-16">
          <div className="max-w-4xl">
            <h2 className="text-5xl font-semibold leading-[0.96] sm:text-6xl lg:text-8xl">
              Give every EV trip a sharper margin.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/58">
              Launch the pilot workspace, review live movement, and bring charging decisions into daily fleet rhythm.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <MagneticLink href="/signup">
                Begin pilot <ArrowRight className="h-4 w-4" />
              </MagneticLink>
              <MagneticLink href="/ai" variant="secondary">
                Open assistant
              </MagneticLink>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-white/42 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="font-semibold text-white/72">TRICKEE</div>
        <div className="flex flex-wrap gap-5">
          <Link href="/fleet" className="hover:text-white">Fleet</Link>
          <Link href="/map" className="hover:text-white">Map</Link>
          <Link href="/routes" className="hover:text-white">Routes</Link>
          <Link href="/gpsdriver/privacy" className="hover:text-white">GPS Driver privacy</Link>
          <Link href="/gpsdriver/support" className="hover:text-white">Support</Link>
          <Link href="/gpsdriver/terms" className="hover:text-white">Terms</Link>
          <Link href="/login" className="hover:text-white">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}
