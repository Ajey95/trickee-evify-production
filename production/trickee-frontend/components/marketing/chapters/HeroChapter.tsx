import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { ChapterWord } from "../ChapterWord";
import { KineticText } from "../KineticText";

type HeroChapterProps = {
  onNavigate: (href: string) => boolean;
};

export function HeroChapter({ onNavigate }: HeroChapterProps) {
  return (
    <section id="ping" data-chapter="0" className="journey-track journey-hero" aria-labelledby="hero-title">
      <div className="journey-sticky journey-hero-stage">
        <ChapterWord tone="yellow">ROUTE</ChapterWord>
        <div className="journey-hero-media">
          <Image src="/visuals/trickee-hero-fleet.png" alt="Electric delivery vehicle following a lit route through an Indian city at blue hour" fill priority sizes="100vw" className="journey-hero-image" />
        </div>
        <div className="journey-hero-edge" aria-hidden="true" />
        <svg className="journey-hero-route" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
          <path className="journey-route-shadow" d="M40 790C260 710 350 820 575 690S835 530 1005 610s250-70 405-245" />
          <path data-route-draw d="M40 790C260 710 350 820 575 690S835 530 1005 610s250-70 405-245" />
          <circle cx="1005" cy="610" r="8" /><circle className="journey-ping-ring" cx="1005" cy="610" r="34" />
        </svg>
        <div className="journey-hero-telemetry" aria-hidden="true">
          {Array.from({ length: 26 }, (_, index) => <i key={index} style={{ "--packet": index } as CSSProperties} />)}
        </div>
        <div className="journey-hero-copy" data-hero-copy>
          <KineticText as="h1" id="hero-title" text="Your car already knows the way." accent="." />
          <p>Trickee turns raw GPS movement into protected range, safer routing, and decisions your fleet can trust.</p>
          <div className="journey-hero-actions">
            <a href="#signal-gap" className="journey-primary-action" data-magnetic onClick={(event) => { if (onNavigate("#signal-gap")) event.preventDefault(); }}>See the journey <ArrowDown /></a>
            <Link href="/fleet" className="journey-text-action" data-magnetic>Enter operations <ArrowUpRight /></Link>
          </div>
        </div>
        <div className="journey-live-readout" aria-label="Live route intelligence preview">
          <span>Protected range</span><strong>142 <small>km</small></strong><i>GPS signal live</i>
        </div>
        <div className="journey-scroll-cue" aria-hidden="true"><span>Scroll to drive</span><i /></div>
      </div>
    </section>
  );
}
