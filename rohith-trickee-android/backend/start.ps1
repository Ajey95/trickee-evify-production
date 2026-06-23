param(
    [int]$Port = 8000,
    [switch]$LocalDb,
    [switch]$SkipMigrations,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    throw "backend/.env is missing. Copy .env.example to .env and fill the required values."
}

if ($LocalDb) {
    $env:DATABASE_URL = "sqlite:///./trickee.local.db"
    $env:LEGACY_AUTH_ENABLED = "true"
    # The bundled .env sets ENVIRONMENT=production, but the config validator
    # forbids SQLite + legacy auth in production. Force development for the
    # local pilot run so the API boots with the demo database and password login.
    $env:ENVIRONMENT = "development"
    if (-not $env:DEMO_ADMIN_PASSWORD) { $env:DEMO_ADMIN_PASSWORD = "Trickee@2026" }
    if (-not $env:DEMO_FLEET_PASSWORD) { $env:DEMO_FLEET_PASSWORD = "Evify@2026" }
    if (-not $env:DEMO_DRIVER_PASSWORD) { $env:DEMO_DRIVER_PASSWORD = "Driver@2026" }
    $env:DEMO_SEED = "true"
}

if ($LocalDb) {
    Write-Host "Using local SQLite database. Skipping Alembic because later migrations include Postgres-specific indexes/extensions."
} elseif (-not $SkipMigrations) {
    alembic upgrade head
}

if (-not $SkipSeed) {
    python -m app.utils.seed
}

python -m uvicorn app.main:app --host 0.0.0.0 --port $Port --reload
