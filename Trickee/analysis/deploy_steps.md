# Trickee Production Deploy Steps

**Purpose:** Production setup checklist for Supabase Auth, Google OAuth, Resend email delivery, Render backend env vars, Vercel frontend env vars, and demo user role seeding.

**Rule:** Never paste service-role keys, database passwords, JWT secrets, Resend API keys, Google client secrets, or Render/Vercel tokens into frontend code or public docs.

---

## 1. Architecture Overview

Trickee uses two different email systems.

### 1.1 Supabase Auth Emails

Used for:

- Signup confirmation
- Password reset
- Magic links
- OTP emails

Flow:

```txt
User -> Supabase Auth -> Resend SMTP -> User inbox
```

### 1.2 Backend Report Emails

Used for:

- Weekly reports
- Internal notifications
- AI intelligence summaries

Flow:

```txt
Backend API -> Resend API -> Operator inbox
```

---

## 2. Production URLs

Current deployment targets:

```txt
Frontend: https://trickee-evify-live.vercel.app
Backend:  https://trickee-evify-production.onrender.com
API:      https://trickee-evify-production.onrender.com/api/v1
```

Future custom-domain target:

```txt
Frontend: https://trickee.ai
Backend:  https://api.trickee.ai
Email:    auth.trickee.ai
```

---

## 3. Domain And DNS

Buy/configure a real domain.

Recommended:

```txt
Main product: trickee.ai
Email subdomain: auth.trickee.ai
```

The email subdomain keeps auth/report email reputation isolated from the product domain.

---

## 4. Resend Domain Setup

Open:

```txt
https://resend.com/domains
```

Add domain:

```txt
auth.trickee.ai
```

Resend will give DNS records, typically:

| Type | Purpose | Example value |
| --- | --- | --- |
| TXT | SPF | `v=spf1 include:amazonses.com ~all` |
| CNAME | DKIM | Resend/Amazon SES generated value |
| TXT | DMARC | `v=DMARC1; p=none;` |

Add every record exactly in the DNS provider:

- Cloudflare
- Namecheap
- GoDaddy
- Porkbun
- Squarespace Domains
- or wherever `trickee.ai` DNS is hosted

Wait until Resend shows:

```txt
Verified
```

This can take a few minutes, sometimes 30+ minutes.

---

## 5. Resend API Key

Open:

```txt
https://resend.com/api-keys
```

Create key:

```txt
Name: Production
Permission: Full Access
```

Store the key securely:

```txt
RESEND_API_KEY=re_xxxxxxxxx
```

Do not expose this in Vercel `NEXT_PUBLIC_*`.

---

## 6. Supabase Auth SMTP With Resend

Open:

```txt
Supabase Dashboard -> Project -> Authentication -> SMTP Settings
```

Enable:

```txt
Enable Custom SMTP = ON
```

Use:

```txt
Sender email: no-reply@auth.trickee.ai
Sender name:  Trickee
SMTP host:    smtp.resend.com
SMTP port:    587
SMTP username: resend
SMTP password: <RESEND_API_KEY>
```

Save.

Test:

```txt
Authentication -> Users -> Create test user
```

Check:

- Signup confirmation email
- Reset password email
- Magic link email
- Spam folder

Docs:

- https://supabase.com/docs/guides/auth/auth-smtp
- https://resend.com/docs/send-with-smtp

---

## 7. Supabase URL Configuration

Open:

```txt
Supabase Dashboard -> Authentication -> URL Configuration
```

For current Vercel deployment:

```txt
Site URL:
https://trickee-evify-live.vercel.app

Redirect URLs:
https://trickee-evify-live.vercel.app/**
http://localhost:3000/**
```

For future custom domain:

```txt
Site URL:
https://trickee.ai

Redirect URLs:
https://trickee.ai/**
http://localhost:3000/**
```

Without correct redirect URLs:

- Google OAuth can fail
- Magic links can fail
- Password reset links can redirect incorrectly

Docs:

- https://supabase.com/docs/guides/auth/redirect-urls

---

## 8. Google OAuth In GCP

Open:

```txt
https://console.cloud.google.com
```

### 8.1 OAuth Consent Screen

Use:

```txt
Audience: External
Publishing status: Testing
```

Reason:

- Pilot users may not belong to one Google Workspace organization.
- Testing mode only allows emails added as test users.
- Full Google verification is not needed for basic profile/email scopes during pilot.

Add test users:

- Founder/admin email
- Fleet manager email
- Pilot operator emails
- Driver emails if needed

Scopes:

```txt
openid
userinfo.email
userinfo.profile
```

### 8.2 Create OAuth Client

Go:

```txt
APIs & Services -> Credentials -> Create Credentials -> OAuth Client ID
```

Type:

```txt
Web application
```

Authorized JavaScript origins:

```txt
http://localhost:3000
https://trickee-evify-live.vercel.app
https://trickee.ai
```

Authorized redirect URI:

```txt
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

Example project ref from current local config:

```txt
https://brwlcivihnxvtmbgentx.supabase.co/auth/v1/callback
```

Copy:

```txt
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

### 8.3 Add Google Provider To Supabase

Open:

```txt
Supabase Dashboard -> Authentication -> Providers -> Google
```

Enable Google.

Paste:

```txt
Client ID
Client Secret
```

Save.

Docs:

- https://supabase.com/docs/guides/auth/social-login/auth-google

---

## 9. Vercel Frontend Env Vars

Open:

```txt
Vercel -> trickee-evify-live -> Settings -> Environment Variables
```

Production:

```env
NEXT_PUBLIC_BACKEND_URL=https://trickee-evify-production.onrender.com/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<SUPABASE_PUBLISHABLE_KEY>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_PUBLISHABLE_OR_ANON_KEY>
NEXT_PUBLIC_LEGACY_AUTH_ENABLED=false
```

Notes:

- `NEXT_PUBLIC_*` values are visible to browsers.
- Never put Supabase service role key in Vercel.
- Redeploy Vercel after changing env vars.

---

## 10. Render Backend Env Vars

Open:

```txt
Render -> trickee backend service -> Environment
```

Required production vars:

```env
ENVIRONMENT=production
DATABASE_URL=<SUPABASE_POSTGRES_CONNECTION_STRING>
SECRET_KEY=<64_CHAR_RANDOM_SECRET>
ALLOWED_ORIGINS=https://trickee-evify-live.vercel.app
SUPABASE_JWT_SECRET=<SUPABASE_JWT_SECRET>
SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
SUPABASE_JWKS_URL=
SUPABASE_JWT_AUDIENCE=authenticated
LEGACY_AUTH_ENABLED=false
```

Generate `SECRET_KEY`:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Get `SUPABASE_JWT_SECRET`:

```txt
Supabase Dashboard -> Project Settings -> API -> JWT Settings / JWT Secret
```

Get `SUPABASE_URL`:

```txt
Supabase Dashboard -> Project Settings -> Data API -> Project URL
```

Important:

- If the Supabase project uses asymmetric JWT signing (`ES256` / `RS256`), Render must have `SUPABASE_URL` so the backend can verify tokens against Supabase JWKS.
- `SUPABASE_JWKS_URL` is optional. Leave blank unless Supabase exposes a custom JWKS endpoint.
- If `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, or `SUPABASE_JWT_AUDIENCE` is missing/wrong for the active Supabase signing mode, `/api/v1/auth/me` returns `401`.
- If `DATABASE_URL` points to a different Supabase project than the one used for Auth, users will stay unmapped.
- Redeploy Render after changing env vars.

Optional but recommended:

```env
REDIS_URL=<UPSTASH_OR_RENDER_REDIS_URL>
GROQ_API_KEY=<GROQ_KEY>
GROQ_MODEL=llama-3.1-8b-instant
RESEND_API_KEY=<RESEND_API_KEY>
REPORT_FROM_EMAIL=Trickee <reports@auth.trickee.ai>
REPORT_TO_EMAILS=founder@example.com,ops@example.com
```

---

## 11. Backend Resend API For Reports

Supabase SMTP is for auth emails only.

Backend report emails use Resend API directly.

Render env:

```env
RESEND_API_KEY=re_xxxxx
REPORT_FROM_EMAIL=Trickee <reports@auth.trickee.ai>
REPORT_TO_EMAILS=you@gmail.com,ops@gmail.com
```

Test after deploy:

```txt
GET https://trickee-evify-production.onrender.com/api/v1/intelligence/reports/weekly?days=7&send_email=true
```

Check:

- API response
- Render logs
- inbox
- spam folder

---

## 12. Supabase Auth User Strategy

There are two valid login paths.

### 12.1 Google OAuth Users

Use Google sign-in only when the user controls that Google account email.

Flow:

```txt
Google login -> Supabase Auth user -> Trickee public.users mapping -> dashboard
```

### 12.2 Custom Email Users

If a custom email cannot use Google sign-in, create the user as Supabase email/password.

Flow:

```txt
Supabase email/password user -> Trickee public.users mapping -> dashboard
```

Create the auth user:

```txt
Supabase Dashboard -> Authentication -> Users -> Add user
```

Use:

```txt
Email: custom user email
Password: strong password
Auto confirm user: enabled
```

Then map that exact auth user into `public.users` with the SQL below.

---

## 13. Demo Users To Create

Create three Supabase Auth users first.

Suggested demo accounts:

```txt
Admin:
admin@trickee.ai

Fleet manager:
fleet@evify.in

Driver:
driver1@evify.in
```

For each one:

```txt
Supabase Dashboard -> Authentication -> Users -> Add user
```

Set:

```txt
Auto confirm user: enabled
Password: choose a strong demo password
```

Do not rely on Google sign-in for custom emails that are not real Google accounts.

---

## 14. Seed Demo User Role Mappings

Before running the SQL, confirm one fleet and one driver exist:

```sql
select id, name, city
from public.fleets
where deleted_at is null
order by created_at
limit 10;
```

```sql
select id, fleet_id, full_name, driver_code
from public.drivers
where deleted_at is null
order by created_at
limit 10;
```

Then update the email values and run:

```sql
with config as (
  select
    lower('admin@trickee.ai') as admin_email,
    lower('fleet@evify.in') as fleet_email,
    lower('driver1@evify.in') as driver_email
),
fleet_pick as (
  select id
  from public.fleets
  where deleted_at is null
  order by created_at
  limit 1
),
driver_pick as (
  select d.id, d.fleet_id
  from public.drivers d
  join fleet_pick f on f.id = d.fleet_id
  where d.deleted_at is null
  order by d.created_at
  limit 1
),
source_rows as (
  select
    u.email,
    u.id::text as supabase_user_id,
    'Ajeya Admin'::text as full_name,
    'trickee_admin'::text as role,
    null::text as fleet_id,
    null::text as driver_id
  from auth.users u, config c
  where lower(u.email) = c.admin_email

  union all

  select
    u.email,
    u.id::text as supabase_user_id,
    'Evify Fleet Manager'::text as full_name,
    'fleet_operator'::text as role,
    f.id::text as fleet_id,
    null::text as driver_id
  from auth.users u
  cross join config c
  cross join fleet_pick f
  where lower(u.email) = c.fleet_email

  union all

  select
    u.email,
    u.id::text as supabase_user_id,
    'Demo Driver'::text as full_name,
    'driver'::text as role,
    d.fleet_id::text as fleet_id,
    d.id::text as driver_id
  from auth.users u
  cross join config c
  cross join driver_pick d
  where lower(u.email) = c.driver_email
)
insert into public.users (
  id,
  email,
  supabase_user_id,
  auth_provider,
  full_name,
  role,
  fleet_id,
  driver_id,
  is_active,
  created_at,
  updated_at
)
select
  gen_random_uuid()::text,
  email,
  supabase_user_id,
  'supabase',
  full_name,
  role,
  fleet_id,
  driver_id,
  true,
  now(),
  now()
from source_rows
on conflict (email) do update set
  supabase_user_id = excluded.supabase_user_id,
  auth_provider = 'supabase',
  full_name = excluded.full_name,
  role = excluded.role,
  fleet_id = excluded.fleet_id,
  driver_id = excluded.driver_id,
  is_active = true,
  deleted_at = null,
  updated_at = now()
returning email, role, fleet_id, driver_id, is_active, deleted_at;
```

Expected:

```txt
3 rows returned
admin@trickee.ai      trickee_admin
fleet@evify.in        fleet_operator
driver1@evify.in      driver
```

If fewer than 3 rows return, the missing email does not exist in `auth.users`.

---

## 15. Verify Demo Role Mapping

Run:

```sql
select
  au.email as auth_email,
  au.id::text as auth_user_id,
  pu.email as trickee_email,
  pu.supabase_user_id,
  pu.role,
  pu.fleet_id,
  pu.driver_id,
  pu.is_active,
  pu.deleted_at
from auth.users au
left join public.users pu
  on pu.supabase_user_id = au.id::text
where lower(au.email) in (
  lower('admin@trickee.ai'),
  lower('fleet@evify.in'),
  lower('driver1@evify.in')
)
order by au.email;
```

Required:

```txt
supabase_user_id = auth_user_id
is_active = true
deleted_at = null
role is correct
```

---

## 16. Login Test Matrix

Admin:

```txt
Email/password login -> /admin
```

Fleet manager:

```txt
Email/password login -> /fleet
```

Driver:

```txt
Email/password login -> /driver
```

If any user sees:

```txt
This account is waiting for workspace access.
```

Check:

1. Does the email exist in `auth.users`?
2. Does `public.users.supabase_user_id` match `auth.users.id`?
3. Is `public.users.is_active = true`?
4. Is `public.users.deleted_at is null`?
5. Is Render using the same `DATABASE_URL` Supabase project?
6. Is Render using the correct `SUPABASE_URL` for the Supabase Auth project?
7. If the Supabase project still uses HS256 JWTs, is Render using the correct `SUPABASE_JWT_SECRET`?

If browser DevTools shows the token header uses:

```json
{"alg":"ES256"}
```

then `SUPABASE_URL` is mandatory and `SUPABASE_JWT_SECRET` alone is not enough.

---

## 17. Production Best Practices

### Email

- Use `auth.trickee.ai` for auth/report email.
- Start DMARC as:

```txt
v=DMARC1; p=none;
```

After stable delivery:

```txt
v=DMARC1; p=quarantine;
```

Later:

```txt
v=DMARC1; p=reject;
```

### Auth

- Keep `LEGACY_AUTH_ENABLED=false` in production.
- Use Supabase email/password or Google OAuth only.
- Never authorize from frontend role checks.
- All roles must come from backend `public.users`.

### Secrets

- Render stores backend secrets.
- Vercel stores browser-safe public config only.
- Supabase service role key must never be used in the frontend.

### Deployment

After env changes:

```txt
Redeploy Render backend
Redeploy Vercel frontend
Test /health
Test login
Test /api/v1/auth/me
```

---

## 18. Pilot CI/CD Setup

GitHub Actions now has a pilot readiness workflow at:

```txt
.github/workflows/pilot-ci.yml
```

The workflow runs on pull requests and pushes to `main`.

### CI Checks

Backend job:

```txt
cd production/backend
python -m compileall app alembic
alembic heads
pytest tests -q
```

The Alembic check fails if there is more than one migration head. CI uses SQLite and placeholder settings only; it must not use production database credentials.

Frontend job:

```txt
cd production/trickee-frontend
npm ci
npm run lint
npm run build
```

The frontend build uses CI-only placeholder `NEXT_PUBLIC_*` values. Real production values stay in Vercel.

Secret safety job:

```txt
git ls-files
```

The job blocks tracked local `.env` files and tracked service-account JSON files. `.env.example` and `.env.production.example` remain allowed as templates.

### Deployment Flow

Use this release gate for pilot deployments:

```txt
GitHub PR/push
  -> Pilot CI passes
  -> merge/deploy commit
  -> Render backend deploy from render.yaml
  -> Vercel frontend deploy from vercel.json
  -> post-deploy smoke matrix
```

Render remains responsible for backend production env vars and startup migrations. Do not run `alembic upgrade head` against production from GitHub Actions.

Vercel remains responsible for frontend production `NEXT_PUBLIC_*` env vars. Do not put backend secrets, database URLs, service account JSON, or unrestricted server API keys in Vercel frontend env.

### Post-Deploy Required Smoke

After every production deployment, verify:

- `GET /health` returns 200.
- Login works for admin, fleet manager, and driver.
- `GET /api/v1/auth/me` returns the correct internal Trickee role.
- `/map` loads and does not crash with empty or live vehicle points.
- Browser geolocation works on the deployed HTTPS frontend.
- Small `/api/v1/telemetry/evify/bulk` test is accepted or duplicate-safe.
- Render logs contain matching request IDs.
- FCM browser push receipt is verified before field pilot.

### Provenance

Source:
- `Trickee/analysis/pilot_testing_plan.md`
- Section 20, CI/CD Process For Pilot
- Extracted: 2026-05-22
- Confidence: High
