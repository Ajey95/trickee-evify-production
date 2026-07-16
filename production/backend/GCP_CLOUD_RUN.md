# GCP Cloud Run Deployment

The backend is a Dockerized FastAPI app and can run on Cloud Run.

## Prerequisites

- Google Cloud CLI installed and authenticated.
- A GCP project with billing enabled.
- A production PostgreSQL `DATABASE_URL` such as Supabase or Cloud SQL.
- Production secrets available in a local env file or added manually to Secret Manager.

## One-command deploy

From `production/backend`:

```powershell
.\scripts\deploy_cloud_run.ps1 `
  -ProjectId "YOUR_GCP_PROJECT_ID" `
  -Region "asia-south1" `
  -ServiceName "trickee-backend" `
  -EnvFile "C:\path\to\trickee-evify-production.env"
```

The script:

- enables Cloud Run, Cloud Build, Artifact Registry, and Secret Manager APIs;
- uploads sensitive env values into Secret Manager;
- deploys this backend from the local Dockerfile;
- sets non-secret production runtime variables on the Cloud Run service.

## Runtime notes

- Cloud Run sets `PORT=8080`; the Dockerfile already respects `PORT`.
- `ENVIRONMENT=production` requires `DATABASE_URL` to be Postgres.
- `LEGACY_AUTH_ENABLED=true` is kept because the mobile driver app still uses the existing email/password login flow.
- Keep `.env`, `*.env`, and `trickee-evify-production.env` out of Git.

## After deploy

Use the printed Cloud Run URL as the mobile backend origin, or map a custom domain and update:

```ts
production/trickee-driver-mobile/src/config/index.ts
```

Then rebuild and upload a new Android AAB.
