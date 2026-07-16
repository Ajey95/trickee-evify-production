# GCP Cloud Run Deployment

The backend is a Dockerized FastAPI app and can run on Cloud Run.

## Prerequisites

- Google Cloud CLI installed and authenticated.
- A GCP project with billing enabled.
- A production PostgreSQL `DATABASE_URL` on GCP.
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

If the database is Cloud SQL and you want Cloud Run to attach the Cloud SQL connector, pass the instance connection name:

```powershell
.\scripts\deploy_cloud_run.ps1 `
  -ProjectId "YOUR_GCP_PROJECT_ID" `
  -Region "asia-south1" `
  -ServiceName "trickee-backend" `
  -EnvFile "C:\path\to\trickee-evify-production.env" `
  -CloudSqlInstance "YOUR_GCP_PROJECT_ID:asia-south1:YOUR_SQL_INSTANCE"
```

When `-CloudSqlInstance` is set, the deploy script rewrites `DATABASE_URL` for the Cloud SQL Unix socket before storing it in Secret Manager. The source env file can still contain the normal public-IP Postgres URL.

The script:

- enables Cloud Run, Cloud Build, Artifact Registry, and Secret Manager APIs;
- uploads sensitive env values into Secret Manager;
- deploys this backend from the local Dockerfile;
- sets non-secret production runtime variables on the Cloud Run service;
- ignores old Supabase env values because the GCP deployment uses Firebase auth and GCP Postgres.

## Runtime notes

- Cloud Run sets `PORT=8080`; the Dockerfile already respects `PORT`.
- `ENVIRONMENT=production` requires `DATABASE_URL` to be Postgres.
- `FIREBASE_AUTH_ENABLED=true` and `FIREBASE_FCM_ENABLED=true` are the GCP auth/notification path.
- `LEGACY_AUTH_ENABLED=true` is kept only for the existing mobile driver email/password login until the app is migrated to Firebase sign-in.
- Keep `.env`, `*.env`, and `trickee-evify-production.env` out of Git.

## After deploy

Use the printed Cloud Run URL as the mobile backend origin, or map a custom domain and update:

```ts
production/trickee-driver-mobile/src/config/index.ts
```

Then rebuild and upload a new Android AAB.
