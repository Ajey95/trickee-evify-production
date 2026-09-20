# Trickee Cinematic Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the seven-chapter, scroll-driven Trickee public experience while preserving every existing authenticated route and backend integration.

**Architecture:** Keep `app/page.tsx` as a Server Component and render a focused marketing Client Component. A fixed, dynamically loaded React Three Fiber scene reads normalized scroll progress imperatively from Zustand; semantic DOM chapters, GSAP ScrollTrigger, Lenis, and CSS/SVG fallbacks provide the narrative and accessible rendering.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, React Three Fiber/drei/Three.js, GSAP ScrollTrigger, Lenis, Framer Motion, Zustand, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-trickee-cinematic-journey-design.md`

## Global Constraints

- Do not reuse Pioneer/Resn assets, copy, models, or code.
- Preserve the production backend proxy, authentication, dashboard routes, PWA, and public GPS Driver pages.
- Do not update React state per animation frame.
- Disable R3F below 768px and for reduced motion.
- Sound stays muted until a user explicitly enables it.
- Keep all product copy and controls code-native.

---

### Task 1: Define deterministic journey motion

**Files:**
- Create: `lib/journey-motion.mjs`
- Create: `tests/journey-motion.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `getChapterFrame(progress)`, `getLayerFrame(progress)`, `getRideFrame(progress)`, and `formatJourneyMetric(progress, target, suffix)`.

- [x] Write tests with literal boundary expectations for chapter clamping, the four prediction layers, the three phone states, and counter formatting.
- [x] Run `node --test tests/journey-motion.test.mjs` and confirm failure because the module does not exist.
- [x] Implement pure functions that clamp non-finite/out-of-range input and return stable frame values.
- [x] Rerun the focused test and then `npm test`.

### Task 2: Add the cinematic runtime dependencies and scene

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `components/marketing/journey-store.ts`
- Create: `components/marketing/CinematicScene.tsx`

**Interfaces:**
- Produces: `useJourneyStore` with `progress`, `chapter`, `setProgress(progress)` and a default `CinematicScene` component.
- Consumes: `getChapterFrame()` and browser WebGL support.

- [x] Install `three`, `@react-three/fiber`, `@react-three/drei`, `framer-motion`, and `zustand` with compatible stable versions.
- [x] Build a fixed route world with camera advance, a route line, vehicle marker, GPS pulse, particles, and battery cells.
- [x] Read store values inside `useFrame` through `useJourneyStore.getState()` so the render loop does not subscribe React to per-frame updates.
- [x] Provide a no-WebGL DOM fallback contract and accessible-hidden canvas.
- [x] Run TypeScript/build verification after the scene compiles.

### Task 3: Rebuild the semantic seven-chapter page

**Files:**
- Replace: `components/marketing/AnimatedLanding.tsx`
- Create: `components/marketing/chapters/HeroChapter.tsx`
- Create: `components/marketing/chapters/SignalGapChapter.tsx`
- Create: `components/marketing/chapters/PredictChapter.tsx`
- Create: `components/marketing/chapters/PrieChapter.tsx`
- Create: `components/marketing/chapters/RideChapter.tsx`
- Create: `components/marketing/chapters/TrustChapter.tsx`
- Create: `components/marketing/chapters/FinalChapter.tsx`
- Create: `components/marketing/JourneyChrome.tsx`
- Create: `components/marketing/IntroLoader.tsx`

**Interfaces:**
- Consumes: `useJourneyStore`, deterministic frame helpers, current Trickee image assets, `ThemeToggle`, and existing routes.
- Produces: semantic chapter IDs `ping`, `signal-gap`, `predict`, `prie`, `ride`, `trust`, `contact`.

- [x] Render the exact locked copy and section order from the spec.
- [x] Add the loader, quiet header, mobile menu, chapter rail, sound toggle, custom cursor, and CTA links.
- [x] Use `next/image` for hero, depot, and technician imagery with correct `sizes` and one priority image.
- [x] Implement code-native SVG route, dashboard, and phone interfaces; do not use concept screenshots as shipped UI.
- [x] Verify server-rendered HTML contains every section, heading, and destination link.

### Task 4: Implement the motion system and visual tokens

**Files:**
- Modify: `components/marketing/AnimatedLanding.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: chapter DOM attributes and `useJourneyStore.setProgress`.
- Produces: Lenis/GSAP timelines, CSS variables `--journey-progress`, `--pointer-x`, `--pointer-y`, and reduced-motion/mobile fallbacks.

- [x] Add design tokens for graphite, cyan, sunlight yellow, amber, coral, typography, borders, and motion timing.
- [x] Synchronize Lenis with ScrollTrigger and update the journey store from one master page trigger.
- [x] Implement pinned/scrubbed hero, seam comparison, four-layer prediction, PRIE dolly, three-state ride, counters, masks, sweeps, magnetic actions, and chapter rail.
- [x] Add passive pointer behavior, cleanup for all listeners/timelines, and no per-frame React state.
- [x] Add mobile static continuation and a complete `prefers-reduced-motion` override.

### Task 5: Verify and polish the complete application

**Files:**
- Modify only files required by failures found during QA.

**Interfaces:**
- Consumes: production build and local server.
- Produces: verified desktop/mobile/reduced-motion experience with no console errors.

- [x] Run `npm run lint`, `npm test`, `npm run test:public-pages`, and `npm run build` from `trcikee-animated`.
- [x] Start the production server on an isolated port and capture the full page at 1440×900 and 390×844 using Playwright because the Browser/IAB helper is unavailable.
- [x] Inspect generated section concepts and rendered screenshots with `view_image`; compare copy, composition, type, color, imagery, chapter rhythm, and responsive behavior.
- [x] Exercise Journey, PRIE, sound, theme, mobile menu, Enter operations, Request access, and public-policy links.
- [x] Fix every agency-signoff visual or interaction mismatch and rerun the full verification suite.
