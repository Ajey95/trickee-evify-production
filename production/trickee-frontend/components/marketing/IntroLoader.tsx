"use client";

import Image from "next/image";
import { useCallback, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { getLogoIntroPlan } from "@/lib/intro-motion.mjs";

export function IntroLoader({ onComplete }: { onComplete: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const finished = useRef(false);
  const previousOverflow = useRef("");

  const complete = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    document.body.style.overflow = previousOverflow.current;
    document.documentElement.dataset.trickeeIntro = "complete";
    onComplete();
  }, [onComplete]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    finished.current = false;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.trickeeIntro = "playing";
    const plan = getLogoIntroPlan(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const watchdog = window.setTimeout(complete, plan.watchdogMs);
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ onComplete: complete });
      timelineRef.current = timeline;
      if (plan.reducedMotion) {
        gsap.set(".intro-brand-image", { opacity: 1, scale: 1, filter: "none" });
        timeline.to(root, { opacity: 1, duration: plan.revealAt });
        return;
      }
      timeline.fromTo(".intro-halo", { scale: .65, opacity: 0 }, { scale: 1, opacity: .8, duration: 2.4, ease: "sine.out" }, .2);
      timeline.fromTo(".intro-ripple", { scale: .25, opacity: 0 }, { scale: .55, opacity: .55, duration: .45, stagger: .35, ease: "sine.out" }, .65);
      timeline.to(".intro-ripple", { scale: 1.4, opacity: 0, duration: 1.7, stagger: .35, ease: "power2.out" }, 1.1);
      timeline.fromTo(".intro-grid", { opacity: 0, scale: 1.12 }, { opacity: .6, scale: 1, duration: 1.4 }, 0);
      timeline.fromTo(".intro-orbit", { scale: .45, opacity: 0, rotate: -65 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.8, stagger: .15, ease: "power3.out" }, .1);
      timeline.fromTo(".intro-pulse", { scale: .1, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: "back.out(1.5)" }, .15);
      timeline.fromTo(".intro-route path, .intro-route circle", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, stagger: .16, ease: "power2.inOut" }, .35);
      timeline.to(".intro-pulse", { scale: 2.5, opacity: 0, duration: .9 }, 1.15);
      timeline.fromTo(".intro-brand-image", { opacity: 0, scale: .94, y: 9, filter: "blur(5px)" }, { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", duration: 1.35, ease: "power3.out" }, 1.25);
      timeline.to(".intro-route", { opacity: 0, duration: .65 }, 1.95);
      timeline.set(".intro-brand-shine", { opacity: .8 }, 2.05);
      timeline.fromTo(".intro-brand-shine i", { xPercent: -110 }, { xPercent: 110, duration: 1.65, ease: "sine.inOut" }, 2.05);
      timeline.to(".intro-brand-shine", { opacity: 0, duration: .3 }, 3.7);
      timeline.fromTo(".intro-caption span", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .12, ease: "power3.out" }, 2.4);
      timeline.to(".intro-orbit", { rotate: (index: number) => index % 2 ? -24 : 24, duration: 2.2, ease: "sine.inOut" }, 2.2);
      timeline.to(".intro-halo", { opacity: .4, scale: 1.08, duration: 1.5, ease: "sine.inOut" }, 2.7);
      timeline.fromTo(".journey-loader-bar i", { scaleX: 0 }, { scaleX: 1, duration: plan.revealAt, ease: "power1.inOut" }, 0);
      timeline.call(() => { root.dataset.logoPhase = "resolved"; }, [], plan.logoResolvedAt);
      timeline.call(() => { root.dataset.logoPhase = "exiting"; }, [], plan.revealAt);
      timeline.to(".intro-brand-stage", { y: -8, duration: plan.exitDuration, ease: "power2.inOut" }, plan.revealAt);
      timeline.to(root, { opacity: 0, scale: 1.012, duration: plan.exitDuration, ease: "power2.inOut" }, plan.revealAt);
    }, root);
    return () => {
      window.clearTimeout(watchdog);
      context.revert();
      timelineRef.current = null;
      document.body.style.overflow = previousOverflow.current;
    };
  }, [complete]);

  return (
    <div ref={rootRef} className="journey-loader custom-logo-intro" data-logo-phase="drawing" role="status" aria-label="Trickee logo reveal">
      <div className="intro-grid" aria-hidden="true" />
      <div className="intro-halo" aria-hidden="true" />
      <div className="intro-ripples" aria-hidden="true"><i className="intro-ripple" /><i className="intro-ripple" /></div>
      <div className="intro-orbits" aria-hidden="true"><i className="intro-orbit" /><i className="intro-orbit" /><i className="intro-orbit" /></div>
      <div className="intro-brand-stage">
        <div className="intro-brand-art">
          <div className="intro-pulse" aria-hidden="true" />
          <svg className="intro-route" viewBox="0 0 500 500" fill="none" aria-hidden="true">
            <path pathLength="1" d="M160 183C131 116 161 38 249 36C336 37 367 116 337 184L249 334L160 195H250V333" />
            <circle pathLength="1" cx="251" cy="121" r="46" />
            <path pathLength="1" d="M206 121H297M251 76V166M251 121L280 88M251 121L280 154M201 257H250" />
          </svg>
          <Image src="/trickee_logo.png" alt="Trickee" width={500} height={500} priority className="intro-brand-image" />
          <div className="intro-brand-shine" aria-hidden="true"><i /></div>
        </div>
        <div className="intro-caption" aria-hidden="true"><span>EVERY SIGNAL.</span><span>A SMARTER JOURNEY.</span></div>
      </div>
      <button type="button" className="journey-loader-skip" onClick={() => { timelineRef.current?.kill(); complete(); }}>Skip intro</button>
      <div className="journey-loader-meta" aria-hidden="true"><span>TRICKEE / ROUTE INTELLIGENCE</span><span className="journey-loader-bar"><i /></span><span>SIGNAL CONNECTED</span></div>
    </div>
  );
}
