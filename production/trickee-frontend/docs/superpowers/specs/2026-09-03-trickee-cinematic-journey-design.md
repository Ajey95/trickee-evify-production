# Trickee Cinematic Journey — Design Specification

## Approved intent

Rebuild the public Trickee experience as an original, continuous EV-intelligence journey using the craft language of award-winning scroll sites: one persistent visual world, pinned chapters, deliberate camera movement, text masks, responsive micro-interactions, and a clear narrative from GPS signal to operational trust. The reference technique is inspirational only; no Pioneer/Resn assets, models, copy, or code are reused.

## Visual direction

The accepted visual world combines the existing generated Trickee concepts in `public/visuals/` with two new concepts:

- `trickee-hero-fleet.png`: blue-hour Indian EV fleet hero and road-light language.
- `trickee-scroll-story-concept.png`: circular route instrument and chapter navigation.
- `trickee-ui-concept.png`: PRIE glass dashboard density and data hierarchy.
- `trickee-field-gallery-concept.png`, `trickee-depot.png`, `trickee-technician.png`: real-world fleet proof.
- `trickee-signal-gap-concept-v2.png`: approved split comparison composition.
- `trickee-mobile-ride-concept-v2.png`: approved phone/route composition.

The color lock is true near-black graphite (`#020609`/`#061018`) with white text, cyan telemetry (`#48dff4`), sunlight yellow (`#ffe000`), amber warning (`#ff9e4f`), and coral fault (`#ff7066`). Images keep their native blue-hour color without a color wash; edge masks may blend them into the canvas.

Typography uses Syne for large editorial statements, Manrope for readable product copy, and Michroma sparingly for chapter labels, instruments, and metrics. Corners stay mostly square or lightly rounded. The container model is full-bleed cinematic bands, not a marketing card grid.

## Locked journey and visible copy

Persistent header: Trickee brand, `Journey`, `Intelligence`, `PRIE`, `Results`, `Sign in`, `Enter operations`. Persistent chapter rail: `01 Ping`, `02 Signal gap`, `03 Predict`, `04 PRIE`, `05 Ride`, `06 Trust`.

1. Loader/intro: real Trickee mark assembles from a signal and route line; `Building your route intelligence.`; `Skip intro`.
2. Hero/Ping: `Your car already knows the way.`; `Trickee turns raw GPS movement into protected range, safer routing, and decisions your fleet can trust.`; CTAs `See the journey` and `Enter operations`.
3. Signal gap: `The signal gap.`; `BMS assumptions drift. GPS-first intelligence stays grounded in the road actually travelled.`; labels `BMS estimate` and `GPS-first`.
4. Predict: `The road speaks in signals.`; `Elevation`, `Weather`, `Traffic`, `Charging`; the route gains each layer as scroll advances.
5. PRIE dashboard: `Foresight, made operational.`; metrics `142 km`, `84%`, `18:42`, `92%` with truthful labels.
6. Mobile ride: `Every turn, already understood.`; `Protected range, the right charging stop, and arrival confidence — carried with the driver.`; state labels `Protected range`, `Charging stop`, `Arrival confidence`.
7. Trust/results: `Proof, in every kilometre.`; three restrained metrics already used by Trickee: `92% route confidence`, `+11 km range protected`, `20 Hz live signal`.
8. CTA/footer: `Move with foresight.`; `Enter operations`; `Request fleet access`; privacy, terms, and support links.

No new hero eyebrow, badge, proof row, or decorative product claim may be added.

## Motion and interaction

- Lenis drives inertial document scrolling and synchronizes GSAP ScrollTrigger.
- A fixed R3F canvas renders an original route world: moving camera, route tube/line, GPS pulse, vehicle marker, data particles, and battery-cell forms. Scroll progress is written to a store/ref, never React state per frame.
- Hero route draws toward the horizon while the camera advances and the vehicle marker pulses.
- Signal gap uses a moving seam: left-hand traces fragment with clipped jitter; right-hand cyan/yellow paths remain continuous.
- Predict is a pinned four-step sequence. Each layer snaps into the route with a short label reveal and instrument response.
- PRIE camera/dash composition scales toward the viewer; metrics count to their final values once.
- Phone tilts subtly with pointer movement; its route draws and screen states crossfade through three scroll segments.
- Chapter rail, active nav, masked headings, section sweeps, magnetic actions, and a restrained custom cursor provide continuous feedback.
- Ambient sound is optional, muted by default, generated only after user activation, and never autoplays.

## Responsive, accessibility, and performance

- Below 768px, the R3F canvas is not mounted. CSS/SVG route art and optimized local images preserve the complete story.
- `prefers-reduced-motion: reduce` removes smooth scrolling, pinning, scrubbed transforms, cursor effects, and looping decorative animation while keeping all content visible in order.
- Semantic headings/landmarks, skip link, visible focus, keyboard-operable navigation and sound toggle, descriptive image alt text, and at least 44px touch targets are mandatory.
- Only the hero image is priority-loaded. Other local images are lazy and rendered with `next/image` sizes.
- The marketing client boundary owns GSAP/Lenis/R3F; authenticated product routes and API/auth behavior remain unchanged.

## Acceptance

The delivered page must render all chapters, update the chapter rail while scrolling, support sound/menu/theme controls, preserve login/operations/public-policy navigation, build cleanly, and remain readable at 1440×900 and 390×844. Browser verification must inspect the opening viewport, each chapter, the CTA path, and reduced-motion/mobile behavior.

