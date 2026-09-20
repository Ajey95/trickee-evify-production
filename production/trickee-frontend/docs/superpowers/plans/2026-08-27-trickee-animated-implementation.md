# Trickee Animated Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver an isolated, production-ready animated Trickee frontend that preserves the complete existing API-backed MVP.

**Architecture:** Keep the proven Next.js App Router route and data layer, add a marketing-only motion boundary for the cinematic landing page, and restyle shared UI primitives plus the authenticated shell so all product pages inherit a coherent visual system. Generated artwork is local and optimized through Next Image.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, GSAP ScrollTrigger, Lenis, Recharts, Leaflet, Node test runner, Playwright browser QA.

---

### Task 1: Establish regression contracts

**Files:**
- Create: `tests/animated-experience.test.mjs`
- Modify: `package.json`

1. Add source contracts for the required hero copy, locally generated visual, core sections, reduced-motion handling, and production API base.
2. Run the test and confirm it fails on the copied legacy implementation.

### Task 2: Build the cinematic public experience

**Files:**
- Create: `components/marketing/AnimatedLanding.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

1. Implement accessible header, sticky parallax hero, energy instrument, live metric rail, operations preview, product narratives, CTA, and footer.
2. Use the generated production asset through `next/image`.
3. Implement scoped Lenis/GSAP behavior and reduced-motion cleanup.
4. Run contract tests until green.

### Task 3: Unify the authenticated product shell

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/Topbar.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/ui/Card.tsx`
- Modify: `components/ui/Button.tsx`
- Modify: `components/ui/Badge.tsx`
- Modify: `tailwind.config.ts`

1. Apply the electric-terrain tokens and interaction language to shared primitives.
2. Replace placeholder brand marks with the real Trickee asset.
3. Preserve responsive role-based navigation and sign-out behavior.

### Task 4: Bring authentication into the same visual system

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/signup/page.tsx`

1. Add the generated visual treatment and product trust context.
2. Preserve all Google sign-in and approval states, field validation, and vehicle selection behavior.

### Task 5: Deployment hardening and documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Verify: `.env.example`, `next.config.mjs`, `vercel.json`, `lib/api.ts`

1. Document local setup, production API configuration, tests, and Vercel deployment.
2. Verify the public API health and signup-options contract.
3. Run lint, unit/contract tests, and a clean production build.

### Task 6: Browser QA and revision pass

**Files:**
- Test: all public and authenticated entry routes

1. Start the production build on an isolated local port.
2. Verify landing page identity, scroll animation, links, public policy routes, login/signup behavior, overlays, console, and network health.
3. Capture desktop and mobile screenshots and visually compare them with the concept.
4. Fix discovered issues, rerun the full suite, and record final status.

