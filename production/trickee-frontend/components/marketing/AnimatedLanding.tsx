"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { getTextMotionPlan } from "@/lib/intro-motion.mjs";
import { getJourneyTargetId } from "@/lib/journey-navigation.mjs";
import { formatJourneyMetric, getLayerFrame, getRideFrame, getSceneFrame } from "@/lib/journey-motion.mjs";
import { FinalChapter } from "./chapters/FinalChapter";
import { HeroChapter } from "./chapters/HeroChapter";
import { PredictChapter } from "./chapters/PredictChapter";
import { PrieChapter } from "./chapters/PrieChapter";
import { RideChapter } from "./chapters/RideChapter";
import { SignalGapChapter } from "./chapters/SignalGapChapter";
import { TrustChapter } from "./chapters/TrustChapter";
import { IntroLoader } from "./IntroLoader";
import { JourneyAtmosphere } from "./JourneyAtmosphere";
import { JourneyChrome } from "./JourneyChrome";
import { MotionReel } from "./MotionReel";
import { useJourneyStore } from "./journey-store";

const CinematicScene = dynamic(() => import("./CinematicScene"), { ssr: false });

const layerReadouts = [
  ["7.4%", "grade ahead"],
  ["31°", "road temperature"],
  ["18 min", "traffic exposure"],
  ["24 min", "charge window"],
];

export function AnimatedLanding() {
  const rootRef = useRef<HTMLElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [introComplete, setIntroComplete] = useState(false);
  const [sceneEnabled, setSceneEnabled] = useState(false);
  const handleIntroComplete = useCallback(() => setIntroComplete(true), []);
  const handleJourneyNavigate = useCallback((href: string) => {
    const targetId = getJourneyTargetId(href);
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return false;

    window.history.pushState(null, "", href);
    if (lenisRef.current) {
      const scrollMargin = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
      lenisRef.current.scrollTo(target, { offset: -72 - scrollMargin, duration: 1.18 });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    }
    return true;
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 768px)");
    const updateScene = () => setSceneEnabled(desktop.matches && !reduced.matches);
    updateScene();
    desktop.addEventListener("change", updateScene);
    reduced.addEventListener("change", updateScene);
    return () => {
      desktop.removeEventListener("change", updateScene);
      reduced.removeEventListener("change", updateScene);
    };
  }, []);

  useLayoutEffect(() => {
    if (!introComplete) return;
    const root = rootRef.current;
    if (!root) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      root.dataset.motion = "reduced";
      return;
    }

    const textMotion = getTextMotionPlan(window.innerWidth);
    gsap.registerPlugin(ScrollTrigger);
    root.dataset.motion = "full";
    const lenis = new Lenis({
      duration: 1.18,
      smoothWheel: true,
      wheelMultiplier: 0.84,
      touchMultiplier: 1.05,
      anchors: { offset: -72 },
      easing: (time) => Math.min(1, 1.001 - 2 ** (-10 * time)),
    });
    lenisRef.current = lenis;
    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    const unsubscribe = lenis.on("scroll", ScrollTrigger.update);
    const cleanups: Array<() => void> = [];

    let introTimeline: gsap.core.Timeline | null = null;
    const context = gsap.context(() => {
      const chapterSections = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter]"));
      ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const sceneFrame = getSceneFrame(self.progress);
          const velocity = Math.min(1, Math.abs(self.getVelocity()) / 2200);
          root.style.setProperty("--journey-progress", self.progress.toFixed(4));
          root.style.setProperty("--chapter-local", String(sceneFrame.local));
          root.style.setProperty("--transition-intensity", String(sceneFrame.transition));
          root.style.setProperty("--route-energy", String(sceneFrame.routeEnergy));
          root.style.setProperty("--telemetry-density", String(sceneFrame.telemetry));
          root.style.setProperty("--scroll-velocity", velocity.toFixed(3));
          useJourneyStore.getState().setProgress(self.progress);
          const middle = window.innerHeight * 0.5;
          const active = chapterSections.findIndex((section) => {
            const box = section.getBoundingClientRect();
            return box.top <= middle && box.bottom > middle;
          });
          if (active >= 0) useJourneyStore.setState({ chapter: active });
          gsap.set("[data-page-progress]", { scaleX: self.progress });
        },
      });

      introTimeline = gsap.timeline({ paused: true });
      introTimeline.from("[data-journey-header]", { y: -84, opacity: 0, duration: 1, ease: "power4.out" }, 0);
      introTimeline.fromTo("[data-hero-copy] [data-kinetic-char]", {
        yPercent: textMotion.risePercent,
        rotateX: -64,
        rotateZ: (index) => (index % 2 ? 6 : -6),
        opacity: 0,
        filter: "blur(5px)",
      }, {
        yPercent: 0, rotateX: 0, rotateZ: 0, opacity: 1, filter: "blur(0px)",
        duration: textMotion.duration,
        stagger: textMotion.stagger,
        ease: "power2.out",
        onStart: () => { root.querySelector('[data-hero-copy] [data-kinetic-heading]')?.setAttribute('data-text-phase', 'revealing'); },
        onComplete: () => { root.querySelector('[data-hero-copy] [data-kinetic-heading]')?.setAttribute('data-text-phase', 'complete'); },
      }, 0.12);
      introTimeline.from("[data-hero-copy] > p, [data-hero-copy] .journey-hero-actions, .journey-live-readout", { y: 24, opacity: 0, duration: 0.9, stagger: 0.09, ease: "power3.out" }, 0.38);
      gsap.fromTo("[data-route-draw]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: "#ping", start: "top top", end: "bottom bottom", scrub: true } });
      gsap.to(".journey-hero-image", { scale: 1.34, yPercent: 12, xPercent: -3, filter: "saturate(1.12) contrast(1.12)", ease: "none", scrollTrigger: { trigger: "#ping", start: "top top", end: "bottom bottom", scrub: 1 } });
      gsap.to("[data-hero-copy]", { yPercent: -22, opacity: 0.12, ease: "none", scrollTrigger: { trigger: "#ping", start: "top top", end: "bottom bottom", scrub: 0.8 } });
      gsap.to(".journey-live-readout", { yPercent: -85, xPercent: -18, ease: "none", scrollTrigger: { trigger: "#ping", start: "top top", end: "bottom bottom", scrub: 1 } });

      if (window.matchMedia("(min-width: 768px)").matches) {
        chapterSections.slice(1).forEach((section) => {
          const stage = section.querySelector<HTMLElement>(".journey-sticky");
          if (!stage) return;
          gsap.fromTo(stage,
            { scale: 0.97, filter: "brightness(.68)" },
            { scale: 1, filter: "brightness(1)", ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "top top", scrub: 0.75 } },
          );
        });
      }

      ScrollTrigger.create({
        trigger: "#signal-gap",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const seam = 32 + self.progress * 36;
          root.style.setProperty("--signal-seam", `${seam}%`);
          root.style.setProperty("--signal-jitter", `${Math.sin(self.progress * 54) * 8}px`);
        },
      });

      gsap.to(".journey-route-instrument > svg", { rotate: 48, scale: 1.12, transformOrigin: "50% 50%", ease: "none", scrollTrigger: { trigger: "#predict", start: "top top", end: "bottom bottom", scrub: 1 } });
      gsap.to(".journey-layer-list", { yPercent: -18, ease: "none", scrollTrigger: { trigger: "#predict", start: "top top", end: "bottom bottom", scrub: 1 } });

      ScrollTrigger.create({
        trigger: "#predict",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const frame = getLayerFrame(self.progress);
          root.querySelectorAll<HTMLElement>("[data-layer]").forEach((layer) => layer.classList.toggle("is-active", Number(layer.dataset.layer) === frame.index));
          const value = root.querySelector<HTMLElement>("[data-layer-value]");
          const meta = root.querySelector<HTMLElement>("[data-layer-meta]");
          if (value) value.textContent = layerReadouts[frame.index][0];
          if (meta) meta.textContent = layerReadouts[frame.index][1];
          root.style.setProperty("--layer-progress", String((frame.index + frame.local) / 4));
        },
      });

      gsap.fromTo("[data-prie-console]", { scale: 0.94, rotateX: 4, yPercent: 4 }, { scale: 1, rotateX: 0, yPercent: 0, ease: "power2.inOut", scrollTrigger: { trigger: "#prie", start: "top top", end: "bottom bottom", scrub: 1 } });
      gsap.to("[data-prie-console]", { rotateY: -5, xPercent: 4, boxShadow: "0 70px 150px rgba(0,0,0,.72)", ease: "none", scrollTrigger: { trigger: "#prie", start: "center center", end: "bottom bottom", scrub: 1 } });
      ScrollTrigger.create({
        trigger: "#prie",
        start: "top 35%",
        end: "bottom 70%",
        onUpdate: (self) => {
          root.querySelectorAll<HTMLElement>("[data-counter]").forEach((counter) => {
            const target = Number(counter.dataset.counter);
            if (Number.isFinite(target) && counter.firstChild) counter.firstChild.textContent = formatJourneyMetric(self.progress, target);
          });
        },
      });

      ScrollTrigger.create({
        trigger: "#ride",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const frame = getRideFrame(self.progress);
          root.querySelectorAll<HTMLElement>("[data-ride-state]").forEach((state) => state.classList.toggle("is-active", Number(state.dataset.rideState) === frame.index));
          root.style.setProperty("--ride-progress", String(self.progress));
        },
      });
      gsap.fromTo("[data-phone-tilt]", { yPercent: 18, rotateZ: -7 }, { yPercent: -8, rotateZ: 2, ease: "none", scrollTrigger: { trigger: "#ride", start: "top bottom", end: "bottom top", scrub: 1 } });
      gsap.to(".journey-city-grid", { backgroundPosition: "360px 620px", scale: 1.35, ease: "none", scrollTrigger: { trigger: "#ride", start: "top bottom", end: "bottom top", scrub: 1 } });
      gsap.to(".journey-proof-images img", { scale: 1.16, yPercent: 7, ease: "none", scrollTrigger: { trigger: "#trust", start: "top bottom", end: "bottom top", scrub: 1 } });
      gsap.from(".journey-reel-item", { clipPath: "inset(0 100% 0 0)", stagger: 0.07, duration: 1.2, ease: "power4.inOut", scrollTrigger: { trigger: "#field-notes", start: "top 72%", once: true } });
      gsap.to(".journey-reel-image", { yPercent: 9, scale: 1.09, ease: "none", scrollTrigger: { trigger: "#field-notes", start: "top bottom", end: "bottom top", scrub: 1 } });
      gsap.to(".journey-reel-orbit", { rotate: 240, ease: "none", scrollTrigger: { trigger: "#field-notes", start: "top bottom", end: "bottom top", scrub: 1.4 } });

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.from(element, { y: 42, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 86%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-kinetic-heading]").forEach((element) => {
        const chars = element.querySelectorAll<HTMLElement>("[data-kinetic-char]");
        const words = element.querySelectorAll<HTMLElement>("[data-kinetic-word]");
        if (!element.closest("[data-hero-copy]")) {
          const reveal = gsap.fromTo(chars, {
            yPercent: textMotion.risePercent,
            rotateX: -58,
            rotateZ: (index) => (index % 3 - 1) * 5,
            opacity: 0,
            filter: "blur(4px)",
          }, {
            yPercent: 0, rotateX: 0, rotateZ: 0, opacity: 1, filter: "blur(0px)",
            paused: true,
            duration: textMotion.duration,
            stagger: textMotion.stagger,
            ease: "power2.out",
            onStart: () => { element.dataset.textPhase = 'revealing'; },
            onComplete: () => { element.dataset.textPhase = 'complete'; },
          });
          ScrollTrigger.create({
            trigger: element,
            start: "top 88%",
            end: "bottom top",
            onEnter: () => { reveal.restart(); },
            onEnterBack: () => { reveal.restart(); },
            onLeave: () => { reveal.progress(1); },
          });
        }
        // Horizontal movement stays inside the 16px gutter reserved by kinetic-copy.
        gsap.fromTo(words,
          { x: (index) => index % 2 ? textMotion.drift : -textMotion.drift },
          { x: (index) => index % 2 ? -textMotion.drift : textMotion.drift,
            ease: "none", scrollTrigger: { trigger: element.closest("section") ?? element, start: "top bottom", end: "bottom top", scrub: 1 },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-chapter-word]").forEach((element, index) => {
        const section = element.closest("section") ?? element;
        gsap.fromTo(element,
          { xPercent: index % 2 ? 28 : -28, rotateZ: index % 2 ? 2 : -2 },
          { xPercent: index % 2 ? -20 : 20, rotateZ: 0, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 1.2 } },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-magnetic]").forEach((element) => {
        const x = gsap.quickTo(element, "x", { duration: 0.38, ease: "power3" });
        const y = gsap.quickTo(element, "y", { duration: 0.38, ease: "power3" });
        const move = (event: PointerEvent) => {
          const bounds = element.getBoundingClientRect();
          x((event.clientX - bounds.left - bounds.width / 2) * 0.13);
          y((event.clientY - bounds.top - bounds.height / 2) * 0.18);
        };
        const leave = () => { x(0); y(0); };
        element.addEventListener("pointermove", move, { passive: true });
        element.addEventListener("pointerleave", leave);
        cleanups.push(() => { element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", leave); });
      });

      const phone = root.querySelector<HTMLElement>("[data-phone-tilt]");
      if (phone) {
        const move = (event: PointerEvent) => {
          const box = phone.getBoundingClientRect();
          const x = (event.clientX - box.left) / box.width - 0.5;
          const y = (event.clientY - box.top) / box.height - 0.5;
          gsap.to(phone, { rotateY: x * 8, rotateX: y * -7, duration: 0.5, ease: "power3.out", overwrite: "auto" });
        };
        const leave = () => gsap.to(phone, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "power3.out" });
        phone.addEventListener("pointermove", move, { passive: true });
        phone.addEventListener("pointerleave", leave);
        cleanups.push(() => { phone.removeEventListener("pointermove", move); phone.removeEventListener("pointerleave", leave); });
      }
    }, root);

    const revealIntro = () => introTimeline?.play();
    window.addEventListener("trickee:intro-reveal", revealIntro);
    if (["revealing", "complete"].includes(document.documentElement.dataset.trickeeIntro ?? "")) {
      revealIntro();
    }

    const cursor = root.querySelector<HTMLElement>("[data-journey-cursor]");
    const cursorX = cursor ? gsap.quickTo(cursor, "x", { duration: 0.22, ease: "power3" }) : null;
    const cursorY = cursor ? gsap.quickTo(cursor, "y", { duration: 0.22, ease: "power3" }) : null;
    const pointerMove = (event: PointerEvent) => {
      cursor?.classList.add("is-visible");
      cursorX?.(event.clientX);
      cursorY?.(event.clientY);
      root.style.setProperty("--pointer-x", `${event.clientX}px`);
      root.style.setProperty("--pointer-y", `${event.clientY}px`);
      root.style.setProperty("--pointer-nx", String(event.clientX / window.innerWidth - 0.5));
      root.style.setProperty("--pointer-ny", String(event.clientY / window.innerHeight - 0.5));
    };
    const pointerOver = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("a, button")) cursor?.classList.add("is-active");
    };
    const pointerOut = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("a, button")) cursor?.classList.remove("is-active");
    };
    root.addEventListener("pointermove", pointerMove, { passive: true });
    root.addEventListener("pointerover", pointerOver, { passive: true });
    root.addEventListener("pointerout", pointerOut, { passive: true });

    return () => {
      root.removeEventListener("pointermove", pointerMove);
      root.removeEventListener("pointerover", pointerOver);
      root.removeEventListener("pointerout", pointerOut);
      window.removeEventListener("trickee:intro-reveal", revealIntro);
      cleanups.forEach((cleanup) => cleanup());
      context.revert();
      unsubscribe();
      lenis.destroy();
      if (lenisRef.current === lenis) lenisRef.current = null;
      cancelAnimationFrame(rafId);
    };
  }, [introComplete]);

  return (
    <main ref={rootRef} className="journey-root" data-journey-root>
      {!introComplete ? <IntroLoader onComplete={handleIntroComplete} /> : null}
      <div
        data-journey-site
        aria-hidden={!introComplete}
        style={{ display: introComplete ? "contents" : "none" }}
      >
        <JourneyChrome onNavigate={handleJourneyNavigate} />
        <JourneyAtmosphere />
        {introComplete && sceneEnabled ? <CinematicScene /> : <div className="journey-canvas journey-canvas--static" aria-hidden="true" />}
        <div id="content">
          <HeroChapter onNavigate={handleJourneyNavigate} />
          <SignalGapChapter />
          <PredictChapter />
          <PrieChapter />
          <RideChapter />
          <TrustChapter />
          <MotionReel onNavigate={handleJourneyNavigate} />
          <FinalChapter />
        </div>
      </div>
    </main>
  );
}
