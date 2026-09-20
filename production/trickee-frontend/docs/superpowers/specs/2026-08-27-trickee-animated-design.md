# Trickee Animated — Experience Design Specification

## Product intent

Trickee Animated is a production frontend for the existing Trickee EV intelligence platform. It preserves every authenticated route and API workflow while replacing the visual system with a premium, cinematic experience inspired by the pacing and layered movement of Shunya Chakra. It does not copy that site's content, imagery, or identity.

## Approved direction

The design language is **Midnight Electric Terrain**: a deep graphite operating environment lit by electric cyan telemetry, acid-lime route energy, and restrained amber warnings. Generated campaign imagery shows a practical electric delivery vehicle in an Indian city at blue hour. Topographic lines, road grids, circular range instruments, and live signal particles create depth without obscuring product information.

## Primary journey

1. A floating glass navigation introduces the Trickee mark and routes to the product story, intelligence section, sign-in, and operations workspace.
2. A tall sticky hero creates a controlled scroll sequence: background scale, telemetry ring rotation, metric-chip drift, and headline motion.
3. An operations pulse makes the product tangible through battery, protected range, route confidence, live fleet, and alert metrics.
4. Alternating editorial sections explain range prediction, safer routing, and grounded decisions with animated cards and visual data motifs.
5. A final conversion section leads users to authentication while the complete dashboard remains available behind the existing role guard.

## Application shell

- Desktop: 240px navigation rail, compact 68px status header, spacious but dense working canvas.
- Mobile: fixed bottom navigation, safe-area support, touch targets at least 44px.
- Cards: near-black glass surfaces, 8–12px radii, one-pixel borders, restrained lift and directional light on hover.
- Typography: Space Grotesk for editorial headings and Inter for product UI, both delivered by Next font optimization.
- Motion: GSAP/ScrollTrigger plus Lenis on the marketing page; CSS motion for app-shell affordances. All motion is disabled or simplified for `prefers-reduced-motion`.

## Color system

- Canvas: `#03070b`
- Raised canvas: `#081017`
- Card: `#0b141c`
- Border: `rgba(180, 224, 232, 0.14)`
- Primary text: `#f3f8f7`
- Secondary text: `#8fa3aa`
- Electric cyan: `#48dff4`
- Energy lime: `#b8f20c`
- Safety amber: `#f3b84b`
- Fault coral: `#ff7066`

## Motion grammar

- Hero scale and vertical parallax track scroll progress; no uncontrolled autoplay takeover.
- Energy rings rotate slowly in opposing directions.
- Firefly-like telemetry particles drift on independent paths.
- Section content reveals through opacity and 24–40px translation.
- Interactive cards use a 2–4px lift, border illumination, and one highlight sweep.
- Navigation and primary actions use crisp 160–240ms feedback.

## Accessibility and performance

- Semantic landmarks and heading order are preserved.
- Visible keyboard focus and WCAG-conscious text contrast are mandatory.
- Production imagery is delivered through `next/image`, responsive `sizes`, and priority only for the LCP hero.
- Large animation libraries are confined to the marketing page client boundary.
- The experience remains coherent without JavaScript motion and on narrow screens.

## Functional invariants

- Production API base remains `https://trickee-backend-397358873357.asia-southeast1.run.app/api/v1`.
- Google authentication, access requests, refresh/logout, role routing, dashboard data calls, websocket tickets, public policy pages, and PWA registration remain intact.
- Vercel deployment configuration and backend proxy rewriting remain valid.

