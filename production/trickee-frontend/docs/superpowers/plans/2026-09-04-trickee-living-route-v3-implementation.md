# Trickee Living Route V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the current Trickee landing into a visibly continuous living-route experience with stronger WebGL, DOM, and scroll choreography.

**Architecture:** Extend the pure motion model first, then consume it inside the fixed React Three Fiber world and the GSAP master timeline. A decorative DOM transition layer shares CSS variables with the WebGL scene so section changes feel like one system while semantic content remains independent.

**Tech Stack:** Next.js 16, React 19, TypeScript, GSAP ScrollTrigger, Lenis, React Three Fiber, Drei, Three.js, Zustand, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-trickee-living-route-v3-design.md`

## Global Constraints

- Preserve every authenticated route, public GPS page, API integration, theme, and PWA behavior.
- Do not copy Pioneer/Resn code, models, copy, or media.
- Do not update React state per animation frame.
- Disable WebGL and high-motion overlays below 768px and for reduced motion.
- Keep sound muted until explicit user activation.

---

### Task 1: Extend the deterministic motion model

**Files:**
- Modify: `tests/journey-motion.test.mjs`
- Modify: `lib/journey-motion.mjs`

**Interfaces:**
- Produces: `getSceneFrame(progress)` returning `{ chapter, local, transition, routeEnergy, telemetry, camera }`.

- [ ] Write literal boundary tests for chapter locality, calm chapter centers, energetic boundaries, route energy, telemetry density, and camera travel.
- [ ] Run the focused test and confirm RED because `getSceneFrame` is missing.
- [ ] Implement `getSceneFrame` using clamped deterministic values.
- [ ] Rerun focused and complete unit tests.

### Task 2: Build the living route WebGL world

**Files:**
- Modify: `components/marketing/CinematicScene.tsx`

**Interfaces:**
- Consumes: `getSceneFrame(progress)` and `useJourneyStore.getState().progress`.
- Produces: route tube, photon stream, tunnel rings, data towers, vehicle scan, chapter lighting, and cinematic camera travel.

- [ ] Replace the small line treatment with a memoized tube route and travelling photon group.
- [ ] Add telemetry particles, tunnel rings, roadside towers, vehicle halo, and chapter-color lighting.
- [ ] Drive all motion through refs inside `useFrame`; keep DPR capped and canvas decorative.
- [ ] Run TypeScript and unit tests.

### Task 3: Add the global transition and hero energy layers

**Files:**
- Create: `components/marketing/JourneyAtmosphere.tsx`
- Modify: `components/marketing/AnimatedLanding.tsx`
- Modify: `components/marketing/chapters/HeroChapter.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: master scroll trigger and CSS variables.
- Produces: velocity streaks, scan surface, chapter aperture, route flare, hero data packets, and stronger chapter morphs.

- [ ] Render one accessible-hidden transition layer with deterministic streak elements.
- [ ] Update the master trigger with chapter-local, transition, route-energy, velocity, and parallax CSS variables.
- [ ] Add hero telemetry nodes and animate headline/image/route as independent depth planes.
- [ ] Add chapter entry wipes and stronger pinned transforms while preserving mobile/reduced-motion static layouts.

### Task 4: Verify agency-signoff fidelity

**Files:**
- Modify only files required by QA findings.

**Interfaces:**
- Produces: a clean production bundle and verified desktop/mobile/reduced-motion experience.

- [ ] Run lint, unit tests, public-route tests, TypeScript, build, and production dependency audit.
- [ ] Capture desktop 1440×900, mobile 390×844, and reduced-motion screenshots with Playwright fallback.
- [ ] Compare concept and implementation for copy, layout, type, palette, route prominence, asset treatment, motion, and responsive behavior.
- [ ] Fix every visible mismatch and rerun the complete verification suite.
