param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "asia-south1",
    [string]$ServiceName = "trickee-backend",
    [string]$EnvFile = "",
    [string]$CloudSqlInstance = "",
    [string]$GoogleOAuthClientIds = "",
    [string]$GoogleOAuthHostedDomain = "",
    [switch]$SkipSecretUpdates,
    [switch]$PreserveInvokerPolicy,
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
        $value = $parts[1].Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($key) {
            $result[$key] = $value
        }
    }
    return $result
}

function Secret-Id($Key) {
    return ("trickee-" + $Key.ToLowerInvariant().Replace("_", "-"))
}

function Convert-DatabaseUrlForCloudSql($DatabaseUrl, $CloudSqlInstance) {
    if (-not $DatabaseUrl -or -not $CloudSqlInstance) {
        return $DatabaseUrl
    }
    $uri = [Uri]$DatabaseUrl
    $dbName = $uri.AbsolutePath.TrimStart("/")
    if (-not $dbName) {
        throw "DATABASE_URL must include a database name when -CloudSqlInstance is used."
    }
    return "postgresql://$($uri.UserInfo)@/$dbName`?host=/cloudsql/$CloudSqlInstance"
}

function Write-YamlEnvFile($Values) {
    $tempFile = New-TemporaryFile
    $lines = @()
    foreach ($key in $Values.Keys) {
        $value = [string]$Values[$key]
        $escaped = $value.Replace("\", "\\").Replace('"', '\"')
        $lines += "$key`: `"$escaped`""
    }
    Set-Content -LiteralPath $tempFile -Value $lines
    return $tempFile
}

function Ensure-Secret($Gcloud, $ProjectId, $SecretId, $Value) {
    $existingSecrets = & $Gcloud secrets list --project $ProjectId --format="value(name)"

    if (-not ($existingSecrets -contains $SecretId)) {
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
if ($GoogleOAuthClientIds) {
    $envValues["GOOGLE_OAUTH_CLIENT_IDS"] = $GoogleOAuthClientIds
}
if ($GoogleOAuthHostedDomain) {
    $envValues["GOOGLE_OAUTH_HOSTED_DOMAIN"] = $GoogleOAuthHostedDomain
}
if ($CloudSqlInstance -and $envValues.Contains("DATABASE_URL") -and $envValues["DATABASE_URL"]) {
    $envValues["DATABASE_URL"] = Convert-DatabaseUrlForCloudSql $envValues["DATABASE_URL"] $CloudSqlInstance
}

$ignoredEnvKeys = @(
    "DATABASE_URL_OLD",
    "FIREBASE_AUTH_ENABLED",
    "FIREBASE_FCM_ENABLED",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    "SUPABASE_ANON_KEY",
    "SUPABASE_JWKS_URL",
    "SUPABASE_JWT_AUDIENCE",
    "SUPABASE_JWT_SECRET",
    "SUPABASE_URL"
)

$secretKeys = @(
    "DATABASE_URL",
    "SECRET_KEY",
    "DEMO_ADMIN_PASSWORD",
    "DEMO_DRIVER_PASSWORD",
    "DEMO_FLEET_PASSWORD",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "GOOGLE_MAPS_API_KEY",
    "GOOGLE_PLACES_API_KEY",
    "OPENWEATHER_API_KEY",
    "REDIS_URL",
    "RESEND_API_KEY",
    "REPORT_FROM_EMAIL",
    "REPORT_TO_EMAILS",
    "NOTIFICATION_WEBHOOK_URL"
)

$defaultPlainEnv = [ordered]@{
    ENVIRONMENT = "production"
    MODEL_DIR = "models_ml"
    AUTH_REQUIRED_PROVIDER = "google"
    LEGACY_AUTH_ENABLED = "false"
    REFRESH_TOKEN_EXPIRE_DAYS = "30"
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
    if ($ignoredEnvKeys.Contains($key)) {
        continue
    }
    if (-not $secretKeys.Contains($key) -and $envValues[$key] -ne "") {
        $defaultPlainEnv[$key] = $envValues[$key]
    }
}

if (
    $defaultPlainEnv["AUTH_REQUIRED_PROVIDER"] -eq "google" -and
    (-not $defaultPlainEnv.Contains("GOOGLE_OAUTH_CLIENT_IDS") -or [string]::IsNullOrWhiteSpace($defaultPlainEnv["GOOGLE_OAUTH_CLIENT_IDS"]))
) {
    throw "GOOGLE_OAUTH_CLIENT_IDS is required when AUTH_REQUIRED_PROVIDER=google. Add the web and Android OAuth client IDs as a comma-separated value in the env file."
}

$secretVars = @()
foreach ($key in $secretKeys) {
    if ($envValues.Contains($key) -and $envValues[$key] -ne "") {
        $secretId = Secret-Id $key
        if (-not $SkipSecretUpdates) {
            Ensure-Secret $gcloud $ProjectId $secretId $envValues[$key]
        }
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
    "--max-instances", "3",
    "--quiet"
)

if ($CloudSqlInstance) {
    $deployArgs += "--add-cloudsql-instances"
    $deployArgs += $CloudSqlInstance
}

if (-not $PreserveInvokerPolicy) {
    if ($AllowUnauthenticated) {
        $deployArgs += "--allow-unauthenticated"
    }
    else {
        $deployArgs += "--no-allow-unauthenticated"
    }
}

$envVarsFile = Write-YamlEnvFile $defaultPlainEnv
$deployArgs += "--env-vars-file"
$deployArgs += $envVarsFile

if ($secretVars.Count -gt 0) {
    $deployArgs += "--set-secrets"
    $deployArgs += ($secretVars -join ",")
}

try {
    & $gcloud @deployArgs | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Cloud Run deployment failed with gcloud exit code $LASTEXITCODE."
    }
    & $gcloud run services describe $ServiceName --project $ProjectId --region $Region --format="value(status.url)"
    if ($LASTEXITCODE -ne 0) {
        throw "Cloud Run service lookup failed with gcloud exit code $LASTEXITCODE."
    }
}
finally {
    Remove-Item -LiteralPath $envVarsFile -Force -ErrorAction SilentlyContinue
}
