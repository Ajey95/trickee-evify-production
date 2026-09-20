# Trickee audit and deployment plan

**Goal:** Audit the implemented EV fleet application, fix reproducible defects, test its production build, and publish the verified source to Vercel.

**Architecture:** Next.js App Router frontend proxies REST requests to the existing FastAPI service on Cloud Run. Authentication uses Google identity and backend-issued refresh sessions. Backend SQLAlchemy persistence and predictive services are tested with an isolated database before live read-only checks.

**Spec:** User attachment `C:/Users/BhaviChasvi/.codex/attachments/0524e13a-afea-4084-9d43-6807d7bfe7a3/pasted-text.txt`.

## Constraints and decisions

- Do not ask further questions; deployment is explicitly authorized.
- Educational games, Pippin, vowel training, and speech recording are not present in this EV product; report not applicable rather than inventing unrelated features.
- Distinguish real-backend tests, isolated database tests, and simulated failures. Never claim exhaustive production acceptance from a build alone.
- Never expose secrets or mutate real fleet records for tests.
- Existing files are an unpacked workspace without usable git metadata; preserve them and track changes directly.
- Browser plugin is not available; use the existing Python Playwright installation.

## Tasks

- [x] Inventory routes, controls, forms, APIs, authentication, animations, and deployment configuration.
- [x] Run `npm run lint`, `npm test`, `npm run test:public-pages`, and `npm run test:backend-contract`; retain actual results.
- [x] Test backend with isolated SQLite: `python -m pytest -q`; examine endpoint authorization, validation, persistence, and predictive behavior.
- [ ] Run actual browser journeys over public and authenticated routes, all applicable controls and forms, responsive sizes, failure handling, and console/network checks. Use isolated seeded backend for mutations.
- [x] Reproduce defects before fixing; add focused regression tests and rerun affected checks.
- [x] Run `npm run build`, start production server, and rerun public browser suite plus API proxy checks.
- [x] Deploy exact tested frontend source to Vercel using available authenticated access; set real backend and public origin configuration.
- [x] Verify published URL, asset loading, Google sign-in origin behavior, API proxy, and console health. Record any externally blocked acceptance checks.
- [x] Save detailed evidence/report outside application source and give concise truthful deployment status/link.

Deployment READY: https://trickee-animated.vercel.app. Production smoke 28/29 passed. Google OAuth origin authorization remains blocked/pending in Google Auth Platform; exhaustive acceptance is not claimed. See ../.codex-artifacts/full-audit-report.md from application root.
