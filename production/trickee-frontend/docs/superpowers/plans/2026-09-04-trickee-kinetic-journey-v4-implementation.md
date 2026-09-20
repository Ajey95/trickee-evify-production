# Trickee Kinetic Journey V4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Trickee public landing page around accessible kinetic typography and stronger scroll-linked cinematic transitions.

**Architecture:** Add a deterministic text-token helper and a small semantic React primitive, then reuse it across all marketing headings. Extend the existing GSAP/Lenis controller and atmospheric layer so typography, chapter backgrounds, route energy, and pointer feedback share the same CSS-variable timeline without changing product routes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, GSAP ScrollTrigger, Lenis, React Three Fiber, CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-04-trickee-kinetic-journey-v4-design.md`

## Global Constraints

- Preserve all dashboard, authentication, GPS Driver, theme, and PWA behavior.
- Keep all visible copy code-native and semantic.
- Do not add scroll hijacking or animate React state per frame.
- Disable high-motion behavior below 768 px and under `prefers-reduced-motion`.
- Keep the palette locked to `#020609`, `#f4f7f6`, `#ffe000`, `#48dff4`, and signal-only `#ff7066`.

---

### Task 1: Accessible kinetic text model and component

**Files:**
- Create: `lib/kinetic-type.mjs`
- Create: `components/marketing/KineticText.tsx`
- Modify: `tests/journey-motion.test.mjs`

**Interfaces:**
- Produces: `tokenizeKineticText(text: string)` returning ordered words and character indices.
- Produces: `KineticText` rendering an accessible wrapper with decorative word and character spans.

- [ ] Add a test proving whitespace is normalized, punctuation is retained, and global character indices are stable.
- [ ] Run `node --test tests/journey-motion.test.mjs` and confirm failure because the helper does not exist.
- [ ] Implement `tokenizeKineticText` and `KineticText` with an `aria-label` on the wrapper and `aria-hidden` decorative spans.
- [ ] Run the focused test and confirm it passes.

### Task 2: Apply kinetic typography to the full journey

**Files:**
- Modify: `components/marketing/chapters/HeroChapter.tsx`
- Modify: `components/marketing/chapters/SignalGapChapter.tsx`
- Modify: `components/marketing/chapters/PredictChapter.tsx`
- Modify: `components/marketing/chapters/PrieChapter.tsx`
- Modify: `components/marketing/chapters/RideChapter.tsx`
- Modify: `components/marketing/chapters/TrustChapter.tsx`
- Modify: `components/marketing/chapters/FinalChapter.tsx`
- Create: `components/marketing/ChapterWord.tsx`

**Interfaces:**
- Consumes: `KineticText`.
- Produces: `data-kinetic-heading`, `data-kinetic-word`, `data-kinetic-char`, and chapter ghost-word hooks for GSAP.

- [ ] Replace heading internals with semantic kinetic spans while preserving exact user-facing copy.
- [ ] Add a decorative, reusable ghost word to each cinematic chapter.
- [ ] Correct corrupted degree, separator, dash, and copyright characters encountered in touched marketing files.
- [ ] Run the public-page test to verify all required text and routes remain present.

### Task 3: Orchestrate scroll, pointer, and transition motion

**Files:**
- Modify: `components/marketing/AnimatedLanding.tsx`
- Modify: `components/marketing/JourneyAtmosphere.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: kinetic data hooks and existing scene-frame CSS variables.
- Produces: character reveals, line drift, ghost-word travel, velocity typography, cursor states, and chapter edge wipes.

- [ ] Add GSAP character/word entrance timelines scoped through `gsap.context()`.
- [ ] Add scroll-linked horizontal type drift and chapter-word transforms.
- [ ] Add delegated pointer states for links and buttons and clear them during cleanup.
- [ ] Add the velocity-type atmospheric markup and responsive/reduced-motion CSS.
- [ ] Tune the hero composition at 1440×900 and the vertical story at 390×844.

### Task 4: Production and visual verification

**Files:**
- Modify only files required by verification findings.

**Interfaces:**
- Produces: a clean, production-buildable, visually inspected landing experience.

- [ ] Run `npm test`, `npm run test:public-pages`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Start the app and use Playwright as the browser fallback to capture 1440×900 and 390×844 screenshots.
- [ ] Inspect the concept and implementation screenshots with `view_image` in one QA pass.
- [ ] Verify chapter navigation, mobile menu, sound toggle, and reduced-motion mode.
- [ ] Remove temporary QA artifacts and document remaining intentional deviations, if any.
