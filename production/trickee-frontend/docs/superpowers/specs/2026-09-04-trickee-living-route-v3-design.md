# Trickee Living Route V3 Design

## Objective

Make the landing experience unmistakably animated from the first second and maintain one continuous visual story through every chapter. The route is the protagonist: it begins as a road signal, wraps the vehicle, becomes telemetry, resolves into prediction, enters PRIE, travels with the driver, and finishes as proof.

## Approved direction

The user requested that work continue without further questions. The selected direction is the generated `public/visuals/trickee-living-route-concept-v3.png`: black automotive campaign composition, large editorial type, sunlight-yellow route ribbon, cyan data particles, sparse chrome, and extreme depth.

## Motion architecture

- Add a deterministic scene-frame helper that maps global progress into six chapters, local chapter progress, transition intensity, route energy, telemetry density, camera travel, and scene palette.
- Drive one fixed React Three Fiber world from that helper without per-frame React state.
- Make the world visibly larger: an emissive route tube, a travelling photon pack, telemetry tunnel rings, roadside data towers, a larger vehicle marker, scan halo, and chapter-specific camera targets.
- Expose `--chapter-local`, `--transition-intensity`, `--route-energy`, `--scroll-velocity`, and pointer-parallax variables to CSS.
- Add a global transition layer containing velocity streaks, scan lines, a chapter aperture, and a route flare. It must remain decorative and pointer-transparent.

## Chapter choreography

1. **Ping:** The hero photograph pushes forward while the route draws from the foreground, energy packets race along it, cyan telemetry bursts around the truck, and the headline separates in depth.
2. **Signal Gap:** A hard vertical diagnostic seam wipes across the screen. Coral error traces stutter on one side while clean cyan traces stabilize on the other.
3. **Predict:** The route bends into a circular instrument. Each quarter-turn changes one intelligence layer and visibly pulses the dial.
4. **PRIE:** The circular instrument flattens into the operational surface; the console arrives in perspective, the route keeps moving, and metrics count into place.
5. **Ride:** The route dives into the phone and cycles through range, charging stop, and arrival confidence while the surrounding grid accelerates.
6. **Trust:** Data particles settle into real photographic proof, metrics resolve, and motion quiets before the final invitation.

## Visual system

- Background: true graphite black `#020609` with petrol-blue depth.
- Primary energy: sunlight yellow `#ffe000`, always the route/action color.
- Telemetry: electric cyan `#48dff4`.
- Errors: coral `#ff7066`, restricted to the signal-gap failure state.
- Typography remains Syne for editorial headings, Michroma for technical UI, and Manrope for body copy.
- No rounded SaaS cards, purple gradients, decorative badges, copied reference assets, or fake screenshot UI.

## Performance and accessibility

- Keep Three.js desktop-only and cap DPR at 1.5.
- Use memoized geometry and typed arrays; update refs imperatively inside `useFrame`.
- Disable WebGL and decorative transition motion below 768px and under `prefers-reduced-motion`.
- Preserve semantic chapter content, keyboard controls, muted-by-default audio, and every existing product route.

## Verification

- Unit-test the deterministic scene frame at boundaries and transition peaks.
- Run lint, unit tests, public-route tests, production build, and dependency audit.
- Browser-test desktop, mobile, and reduced-motion modes; verify no console errors.
- Compare the 1440×900 hero and each chapter against the V3 concept for copy, layout, type, palette, route prominence, depth, and responsive continuity.
