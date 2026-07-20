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
  -Region "asia-southeast1" `
  -ServiceName "trickee-backend" `
  -EnvFile "C:\path\to\trickee-evify-production.env" `
  -GoogleOAuthClientIds "WEB_CLIENT_ID,ANDROID_CLIENT_ID"
```

If the database is Cloud SQL and you want Cloud Run to attach the Cloud SQL connector, pass the instance connection name:

```powershell
.\scripts\deploy_cloud_run.ps1 `
  -ProjectId "YOUR_GCP_PROJECT_ID" `
  -Region "asia-southeast1" `
  -ServiceName "trickee-backend" `
  -EnvFile "C:\path\to\trickee-evify-production.env" `
  -CloudSqlInstance "YOUR_GCP_PROJECT_ID:asia-southeast1:YOUR_SQL_INSTANCE" `
  -GoogleOAuthClientIds "WEB_CLIENT_ID,ANDROID_CLIENT_ID"
```

When `-CloudSqlInstance` is set, the deploy script rewrites `DATABASE_URL` for the Cloud SQL Unix socket before storing it in Secret Manager. The source env file can still contain the normal public-IP Postgres URL. Passing `-GoogleOAuthClientIds` keeps public OAuth identifiers out of the secret-bearing source env file.

If a deployment is interrupted after Secret Manager updates finish, rerun it with `-SkipSecretUpdates` to reuse the current `latest` secret versions.

Use `-PreserveInvokerPolicy` when the deployer can update Cloud Run revisions but cannot change service IAM. An administrator must still grant `roles/run.invoker` to `allUsers` for mobile and web clients to reach the API.

The script:

- enables Cloud Run, Cloud Build, Artifact Registry, and Secret Manager APIs;
- uploads sensitive env values into Secret Manager;
- deploys this backend from the local Dockerfile;
- sets non-secret production runtime variables on the Cloud Run service;
- ignores old Supabase and Firebase auth env values because the GCP deployment uses Google OAuth and GCP Postgres.

## Runtime notes

- Cloud Run sets `PORT=8080`; the Dockerfile already respects `PORT`.
- `ENVIRONMENT=production` requires `DATABASE_URL` to be Postgres.
- `AUTH_REQUIRED_PROVIDER=google` makes Google OAuth the required identity provider for production-issued Trickee access tokens.
- `GOOGLE_OAUTH_CLIENT_IDS` is required for deployment and must contain every accepted Google OAuth audience, comma-separated. Include the web client ID and the Android client ID/server client ID used by the mobile app.
- `LEGACY_AUTH_ENABLED=false`, `FIREBASE_AUTH_ENABLED=false`, and `FIREBASE_FCM_ENABLED=false` are the production defaults for the Google-only auth migration.
- Refresh sessions are stored in Postgres and controlled by `REFRESH_TOKEN_EXPIRE_DAYS`.
- Keep `.env`, `*.env`, and `trickee-evify-production.env` out of Git.

## After deploy

Use the printed Cloud Run URL as the mobile backend origin, or map a custom domain and update:

```ts
production/trickee-driver-mobile/src/config/index.ts
```

Then rebuild and upload a new Android AAB.
