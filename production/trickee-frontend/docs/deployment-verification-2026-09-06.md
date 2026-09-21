# Deployment verification - 6 September 2026

The frontend is integrated with the existing FastAPI backend. This verification does not deploy either service or mutate production records.

## Fresh verification results

| Check | Result |
| --- | --- |
| Live backend `/health` | HTTP 200; status ok; model V4.1 ready |
| Production frontend proxy `/api/backend/auth/signup-options` | HTTP 200, JSON response |
| Unauthenticated `/api/backend/auth/me` | HTTP 401 as expected |
| Frontend regression tests, including refresh rotation and logout races | 25 passed |
| Deployed OpenAPI contract | All 58 frontend method/path pairs match |
| Production browser suite | 9 passed; mobile/desktop text, logo sequencing, navigation, failure recovery |
| Backend pytest suite | 65 passed |
| ESLint | Passed |
| Public-page tests | 3 passed |
| Production build and TypeScript | Passed; all 27 static pages generated |
| Authenticated operator/admin routes | 17 passed with no API or runtime errors |
| Driver routes and admin restriction | Four routes passed; admin navigation redirected to driver |
| AI actions | All eight actions returned successful backend results |
| WebSocket | Ticket obtained through frontend proxy; authenticated live_map snapshot received |

## What the authenticated checks establish

The browser used the real Next.js API proxy and the actual FastAPI application with a temporary SQLite database and seeded driver/admin accounts. Locally signed test sessions exercised backend authorization; they did not perform Google token issuance. No API response stubs were used. Live LLM, maps, weather, and push credentials were disabled in this isolated backend: successful AI responses establish request/response integration and the backend's available deterministic behavior, not paid-provider availability. Database migrations against production PostgreSQL were not rerun.

The production server uses the live Cloud Run REST origin and a matching `wss://` origin; localhost test overrides were confined to the temporary development process.

The local Python environment emits dependency/deprecation warnings. Deploy the backend with its pinned requirements rather than copying the local environment.

## Before public launch

1. Deploy `trcikee-animated` as a Next.js application. Keep `NEXT_PUBLIC_BACKEND_URL=/api/backend` and point `BACKEND_URL` to the deployed FastAPI service.
2. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin and configure `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to match the backend's accepted OAuth client ID.
3. Add the final frontend origin to Google OAuth Authorized JavaScript origins.
4. On the final deployment, sign in with approved driver and operator/admin accounts and verify live data, role routing, token refresh, logout, and live-map updates. Confirm any external provider-dependent features with the configured production credentials.

Conclusion: backend integration is implemented and the tested application is suitable for deployment and final acceptance testing. Final-origin OAuth and production-account/provider checks remain necessary before calling the public launch fully verified.
