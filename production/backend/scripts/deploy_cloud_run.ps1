param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "asia-south1",
    [string]$ServiceName = "trickee-backend",
    [string]$EnvFile = "",
    [switch]$AllowUnauthenticated = $true
)

$ErrorActionPreference = "Stop"

function Resolve-Gcloud {
    $command = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    $localInstall = Join-Path $env:LOCALAPPDATA "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    if (Test-Path -LiteralPath $localInstall) {
        return $localInstall
    }
    throw "gcloud is not installed or not on PATH."
}

function Read-EnvFile($Path) {
    $result = [ordered]@{}
    if (-not $Path) {
        return $result
    }
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path"
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            continue
        }
        $parts = $trimmed.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1]
        if ($key) {
            $result[$key] = $value
        }
    }
    return $result
}

function Secret-Id($Key) {
    return ("trickee-" + $Key.ToLowerInvariant().Replace("_", "-"))
}

function Ensure-Secret($Gcloud, $ProjectId, $SecretId, $Value) {
    $exists = & $Gcloud secrets describe $SecretId --project $ProjectId --format="value(name)" 2>$null
    if (-not $exists) {
        & $Gcloud secrets create $SecretId --project $ProjectId --replication-policy="automatic" | Out-Host
    }

        $tempFile = New-TemporaryFile
    try {
        Set-Content -LiteralPath $tempFile -Value $Value -NoNewline
        & $Gcloud secrets versions add $SecretId --project $ProjectId --data-file=$tempFile | Out-Host
    }
    finally {
        Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
    }
}

$gcloud = Resolve-Gcloud

$backendDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $backendDir

& $gcloud config set project $ProjectId | Out-Host
& $gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    secretmanager.googleapis.com `
    --project $ProjectId | Out-Host

$envValues = Read-EnvFile $EnvFile

$secretKeys = @(
    "DATABASE_URL",
    "SECRET_KEY",
    "SUPABASE_JWT_SECRET",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_JWKS_URL",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "GOOGLE_MAPS_API_KEY",
    "GOOGLE_PLACES_API_KEY",
    "OPENWEATHER_API_KEY",
    "REDIS_URL",
    "RESEND_API_KEY",
    "REPORT_FROM_EMAIL",
    "REPORT_TO_EMAILS",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "NOTIFICATION_WEBHOOK_URL"
)

$defaultPlainEnv = [ordered]@{
    ENVIRONMENT = "production"
    PORT = "8080"
    MODEL_DIR = "models_ml"
    LEGACY_AUTH_ENABLED = "true"
    DEMO_SEED = "false"
    ALLOWED_ORIGINS = "https://trickee-evify-live.vercel.app"
    LLM_PROVIDER = "gemini"
    GEMINI_MODEL = "gemini-2.5-flash"
    GROQ_MODEL = "llama-3.1-8b-instant"
    AI_REQUEST_TIMEOUT_SECONDS = "15"
    AI_MAX_RETRIES = "1"
    AI_MAX_INPUT_CHARS = "4000"
    AI_MAX_OUTPUT_TOKENS = "220"
    MAX_REQUEST_BODY_BYTES = "2000000"
    GLOBAL_RATE_LIMIT_PER_MINUTE = "600"
    AUTH_RATE_LIMIT_PER_MINUTE = "20"
    TELEMETRY_RATE_LIMIT_PER_MINUTE = "120"
    INTELLIGENCE_RATE_LIMIT_PER_MINUTE = "90"
    AI_RATE_LIMIT_PER_MINUTE = "20"
    WEBSOCKET_TICKET_RATE_LIMIT_PER_MINUTE = "30"
    EXTERNAL_CONTEXT_REDIS_CACHE_ENABLED = "true"
    LIVE_STATE_REDIS_ENABLED = "true"
    LIVE_STATE_TTL_SECONDS = "300"
    FIREBASE_AUTH_ENABLED = "false"
    FIREBASE_FCM_ENABLED = "false"
    NOTIFICATION_PROVIDER = "dashboard"
}

foreach ($key in $envValues.Keys) {
    if (-not $secretKeys.Contains($key) -and $envValues[$key] -ne "") {
        $defaultPlainEnv[$key] = $envValues[$key]
    }
}

$envVars = @()
foreach ($key in $defaultPlainEnv.Keys) {
    $value = [string]$defaultPlainEnv[$key]
    if ($value -ne "") {
        $envVars += "$key=$value"
    }
}

$secretVars = @()
foreach ($key in $secretKeys) {
    if ($envValues.Contains($key) -and $envValues[$key] -ne "") {
        $secretId = Secret-Id $key
        Ensure-Secret $gcloud $ProjectId $secretId $envValues[$key]
        $secretVars += "$key=$secretId`:latest"
    }
}

$deployArgs = @(
    "run", "deploy", $ServiceName,
    "--source", ".",
    "--project", $ProjectId,
    "--region", $Region,
    "--platform", "managed",
    "--port", "8080",
    "--memory", "1Gi",
    "--cpu", "1",
    "--min-instances", "0",
    "--max-instances", "3"
)

if ($AllowUnauthenticated) {
    $deployArgs += "--allow-unauthenticated"
}
else {
    $deployArgs += "--no-allow-unauthenticated"
}

if ($envVars.Count -gt 0) {
    $deployArgs += "--set-env-vars"
    $deployArgs += ($envVars -join ",")
}

if ($secretVars.Count -gt 0) {
    $deployArgs += "--set-secrets"
    $deployArgs += ($secretVars -join ",")
}

& $gcloud @deployArgs | Out-Host
& $gcloud run services describe $ServiceName --project $ProjectId --region $Region --format="value(status.url)"
