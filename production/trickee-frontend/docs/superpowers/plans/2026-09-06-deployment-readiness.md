# Deployment readiness implementation plan

**Goal:** Show the complete logo reveal before the site, keep text inside its layout, expose background routes through translucent surfaces, and verify frontend integration with the deployed backend.

**Architecture:** Keep the existing Next.js application and FastAPI API. Use the same-origin REST proxy and a separately configured direct WebSocket origin. Preserve the existing journey and role-based product routes.

**Scope:** User-requested fixes in `trcikee-animated`. The workspace is an extracted folder without Git metadata. Do not deploy or modify production records during verification.

- [x] Repair `components/marketing/IntroLoader.tsx`: account for media events occurring before hydration, display a fallback logo, contain the video on mobile, and reveal content on completion with bounded failure handling.
- [x] Repair `app/globals.css` and heading sizing: measure unbroken animated words, use container-relative font limits, provide glyph spacing, and reduce stage/card opacity and blur. Verify desktop, mobile, short screens, and reduced motion.
- [x] Add API regression tests exercising actual transpiled `lib/api.ts`: token refresh rotation, concurrent requests, 401 retry, transient refresh failure, response validation, and logout isolation. Fix cache invalidation independently from session reset.
- [x] Align REST and WebSocket settings in `next.config.mjs`, `.env.example`, and `hooks/useDriverLocationWS.ts`; verify every frontend endpoint against the deployed OpenAPI contract.
- [x] Run unit tests, ESLint, TypeScript, production build, public-page tests, and browser flows. Inspect screenshots and console logs. Record exact deployment configuration and any account-dependent verification still required in README.

**Verification commands:** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:public-pages`, `python tests/journey-browser.test.py`. Browser plugin is unavailable; use installed Python Playwright for rendered checks. Store temporary screenshots outside the repository.

Final-domain Google OAuth and production-account workflows remain deployment checks requiring account access. Local verification scope is recorded in README.md.
