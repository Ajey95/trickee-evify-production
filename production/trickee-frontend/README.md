# Trickee Animated

Next.js frontend for Trickee EV fleet intelligence, with a cinematic public journey and API-backed operations workspace. See verification scope and the final-domain checks below before deploying.

## Included product surface

- Seven-chapter cinematic public journey: Ping, Signal Gap, Predict, PRIE, Ride, Trust, and the final fleet-access invitation
- A GSAP/Lenis scroll timeline, Framer Motion controls, procedural React Three Fiber world, route-draw effects, live metric counters, and code-native product UI
- Responsive static fallbacks for touch devices and a complete reduced-motion path with WebGL disabled
- Google sign-in, access requests, role mapping, token refresh, and logout
- Fleet, vehicle, driver, trip, map, route, charging-decision, schedule, impact, scorecard, reports, alerts, AI, observability, data-quality, model-health, and admin routes
- Public GPS Driver privacy, terms, and support pages
- PWA manifest/service worker and responsive desktop/mobile navigation

## Backend

- Health: `https://trickee-backend-397358873357.asia-south1.run.app/health`
- API docs: `https://trickee-backend-397358873357.asia-south1.run.app/docs`
- Frontend API base: `https://trickee-backend-397358873357.asia-south1.run.app/api/v1`

Browser requests use the same-origin `/api/backend` path, which `next.config.mjs` securely rewrites to the production service. This works on localhost, Vercel previews, and custom domains without requiring browser CORS access. Copy `.env.example` to `.env.local` only when an explicit override is needed.

The live map connects directly to the backend WebSocket service using a short-lived ticket. `NEXT_PUBLIC_WS_URL` defaults to the WebSocket equivalent of `BACKEND_URL`; it must be an absolute `ws://` or `wss://` origin, never `/api/backend`. Local development also uses the deployed backend by default. To run your own backend, set `BACKEND_URL=http://127.0.0.1:8000` and restart Next.js.

Authentication rotates refresh tokens, deduplicates concurrent refreshes, retries a rejected access token once, and preserves the refresh session during temporary server failures. API errors remain visible. The AI workspace does not substitute fabricated drivers, telemetry, or answers when the backend is unavailable.

## Local verification

```bash
npm ci
npm run lint
npm test
npm run test:backend-contract
npm run test:public-pages
npm run build
npm start
```

Node.js 20 or newer is recommended.

With the application running on `http://127.0.0.1:3000`, run `python tests/journey-browser.test.py` using Python with Playwright and its Chromium browser installed. Set `TEST_BASE_URL` to check another origin. These nine browser tests cover the custom transparent-logo animation, automatic reveal after the logo resolves, failed-logo recovery, animated character visibility, chapter/header navigation, mobile navigation, and headings at 320, 390, 768, 1280, and 1920 pixels. The backend-contract command is read-only: it downloads OpenAPI and checks 58 frontend method/path pairs without executing mutations.

## Vercel deployment

1. Import this folder as a new Vercel project.
2. Keep Framework Preset set to Next.js and Root Directory set to this folder.
3. Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` matching a client ID allowed by the backend's `GOOGLE_OAUTH_CLIENT_IDS`.
4. Set `NEXT_PUBLIC_SITE_URL` to your final HTTPS frontend origin. Set `BACKEND_URL` if using another API deployment. Keep `NEXT_PUBLIC_BACKEND_URL=/api/backend`. Set `NEXT_PUBLIC_WS_URL` only if the WebSocket origin differs from the backend.
5. Deploy. `vercel.json` uses `npm run build` and the standard `.next` output.

Before promoting a deployment, run the full verification commands above and confirm Google OAuth allows the final Vercel origin.

In Google Cloud Console, add the exact final frontend origin to the web OAuth client's **Authorized JavaScript origins**. Configure any preview origin you intend to use for sign-in as well. Rebuild after changing `NEXT_PUBLIC_*` settings. This app uses Next.js rewrites and must be deployed as a Next.js application, not as a static export.

After deploying, sign in with approved driver and operator/admin accounts. Confirm role routing, fleet data, live-map updates, refresh after access-token expiry, and logout. Check access-request approval with a designated test account. These final-domain Google OAuth and production-account workflows require your account access; automated local tests do not certify them.

## September 6 verification scope

- Replaced the video with a custom GSAP reveal of the actual transparent Trickee logo: traced route, orbital signals, and a metallic highlight. The fully resolved logo holds before the site opens. Reduced-motion users see a brief static logo, and a watchdog prevents asset failures from trapping the user. Character reveals and scroll-driven word movement remain enabled, with responsive font sizing and reserved movement space to prevent clipping.
- Heading sizes adapt to the available container width and longest word. PRIE copy and console use separate columns. Cards and stages are more transparent, and route lines are more visible.
- Passed 25 frontend unit/regression tests, three public-page tests, nine journey browser tests, ESLint, TypeScript, and the production build.
- Checked production health/model readiness, the live signup-options response through the Next.js proxy, and all 58 frontend API method/path pairs against deployed OpenAPI.
- Passed all 65 tests in `../trickee-evify-production/production/backend/tests` using the available local Python environment. That environment emits dependency/deprecation warnings; deploy the backend with its pinned requirements.
- Exercised 17 operator/admin routes against an isolated FastAPI backend with seeded test data. All eight AI actions returned successful backend results: assistant, notification preview, route explanation, battery insight, charger recommendation, driver profile, fleet summary, and coaching. Also verified local access-request creation/approval, four driver routes, and rejection of driver access to admin pages, with no API or runtime errors in the final role/action run. An authenticated WebSocket delivered a `live_map` snapshot with the seeded vehicle. Google token issuance and external-provider availability were not tested by this isolated run.
- No deployment was performed and no production records were created or changed during verification.

## Design references

- Accepted experience specification: `docs/superpowers/specs/2026-09-03-trickee-cinematic-journey-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-03-trickee-cinematic-journey-implementation.md`
- Generated production hero: `public/visuals/trickee-hero-fleet.png`
- Trust chapter: `public/visuals/trickee-depot.png` and `public/visuals/trickee-technician.png`
- Mobile ride concept: `public/visuals/trickee-mobile-ride-concept-v2.png`
- Route motion study: `public/visuals/trickee-living-route-concept-v3.png`
