# Trickee Kinetic Journey V4 Design

## Objective

Turn the existing Trickee landing page into a motion-first editorial experience in which typography, the living yellow route, and the electric fleet imagery behave as one continuous scene. The result must feel immediately animated, remain understandable as a product story, and preserve every dashboard, authentication, GPS Driver, PWA, and theme route.

## Approved direction

The user asked for implementation without further questions. The selected reference set combines the complete composition in `public/visuals/trickee-living-route-concept-v3.png` with the darker atmospheric study in `public/visuals/trickee-kinetic-hero-concept-v4.png` and the existing downstream Trickee concept images. It keeps the graphite-black, sunlight-yellow, and electric-cyan identity while simplifying the first viewport around a huge headline, a right-weighted vehicle, one route ribbon, and restrained navigation.

## Experience structure

1. **Ping** — the headline resolves line by line and character by character while the vehicle image pushes forward and the living route draws across the viewport.
2. **Signal gap** — the page splits at a diagnostic seam while the section title assembles from unstable characters into a clean line.
3. **Predict** — route intelligence layers rotate through a circular instrument and a huge ghost word crosses behind the content.
4. **PRIE** — the route flattens into the operational surface while the heading and interface rise on separate depth planes.
5. **Ride** — the phone travels through the route while type and city grid counter-scroll.
6. **Trust** — motion decelerates into photographic proof and oversized closing type.
7. **Contact** — the final invitation opens into a quiet, high-contrast action surface.

## Typography and motion system

- Use Syne for primary editorial type, Michroma for technical labels and controls, and Manrope for readable body copy.
- Render semantic headings as code-native text with an accessible full-string label and decorative per-character spans.
- Animate hero characters on load, section characters on entry, and headline lines horizontally as each pinned chapter progresses.
- Add one restrained ghost word per chapter and a fixed velocity-type layer visible only during chapter transitions.
- Use GSAP ScrollTrigger for scroll-position choreography, Lenis for smoothing, and CSS variables for velocity, pointer parallax, route energy, and transition intensity.
- Do not use full-page scroll hijacking. The existing pinned narrative remains navigable with native anchors and keyboard controls.

## Visual system

- Background: true graphite black `#020609` with petrol-blue depth.
- Primary energy/action: sunlight yellow `#ffe000`.
- Telemetry: electric cyan `#48dff4`.
- Error state only: coral `#ff7066`.
- Container model: full-bleed cinematic stages, open typography, one operational console, one phone frame, and a minimal right chapter rail. No card grid or decorative badges.
- Media: preserve the existing generated fleet, depot, and technician imagery; use masks, edge fades, and depth transforms instead of color-washing the images.

## Responsive and accessibility requirements

- Keep WebGL desktop-only and cap device pixel ratio at 1.5.
- Keep headings semantic and readable when JavaScript is disabled.
- Remove per-character transforms, custom cursor, fixed atmosphere, pinned tracks, and continuous animations under `prefers-reduced-motion`.
- Collapse choreography into a readable vertical story below 768 px without horizontal overflow.
- Keep all interactive targets keyboard accessible and preserve the skip link.

## Verification

- Unit-test deterministic kinetic-token generation before implementing the component.
- Run lint, unit tests, public-page tests, TypeScript checks, and a production build.
- Capture and inspect desktop 1440×900 and mobile 390×844 browser screenshots.
- Compare the hero render against `public/visuals/trickee-kinetic-hero-concept-v4.png` for composition, copy, type scale, palette, route prominence, chrome, and image treatment.
- Exercise chapter anchor navigation, the sound control, the mobile menu, and reduced-motion rendering.
