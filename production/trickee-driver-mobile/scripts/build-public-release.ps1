[CmdletBinding()]
param(
    [string]$BuildRoot = (Join-Path $env:LOCALAPPDATA 'Trickee\vrtrickee-public-android-build')
)

$ErrorActionPreference = 'Stop'

$mobileRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $mobileRoot 'android'
$gradleWrapper = Join-Path $androidRoot 'gradlew.bat'
$signingProperties = Join-Path $androidRoot 'signing.properties'
$publicApplicationId = 'com.trickee.vrtrickee'
$expectedUploadSha1 = '1F:B5:89:39:0D:03:53:49:80:A2:90:B1:80:CE:13:B0:8F:48:07:9A'
$applicationConfig = Join-Path $mobileRoot 'src\config\index.ts'
$screenStackSource = Join-Path $mobileRoot 'node_modules\react-native-screens\android\src\main\java\com\swmansion\rnscreens\ScreenStack.kt'

if (-not (Test-Path -LiteralPath $gradleWrapper)) {
    throw "Gradle wrapper not found: $gradleWrapper"
}
if (-not (Test-Path -LiteralPath $signingProperties)) {
    throw 'android/signing.properties is required for a public release.'
}
if (-not (Test-Path -LiteralPath $applicationConfig)) {
    throw "Application configuration not found: $applicationConfig"
}
if (-not (Test-Path -LiteralPath $screenStackSource)) {
    throw 'Android dependencies are missing. Run npm install before building VRTrickee.'
}

$screenStackText = Get-Content -LiteralPath $screenStackSource -Raw
if ($screenStackText -notmatch [regex]::Escape('drawingOpPool.removeAt(drawingOpPool.size - 1)')) {
    Push-Location $mobileRoot
    try {
        & npm.cmd run postinstall
        if ($LASTEXITCODE -ne 0) {
            throw "npm run postinstall failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
    $screenStackText = Get-Content -LiteralPath $screenStackSource -Raw
}
if ($screenStackText -notmatch [regex]::Escape('drawingOpPool.removeAt(drawingOpPool.size - 1)')) {
    throw 'The react-native-screens Android 14 compatibility patch is not applied to ScreenStack.kt.'
}

$applicationConfigText = Get-Content -LiteralPath $applicationConfig -Raw
if ($applicationConfigText -notmatch "GOOGLE_WEB_CLIENT_ID[\s\S]*?'([0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com)'") {
    throw 'GOOGLE_WEB_CLIENT_ID is missing or invalid in src/config/index.ts.'
}
if ($applicationConfigText -notmatch 'https://trickee-backend-[^''"]+\.run\.app') {
    throw 'The production Cloud Run API origin is missing or invalid in src/config/index.ts.'
}

$resolvedBuildRoot = [System.IO.Path]::GetFullPath($BuildRoot)
$gradleCommand = (
    '"{0}" -p "{1}" bundleRelease -PtrickeeApplicationId={2} ' +
    '-PTRICKEE_VR_ANDROID_BUILD_ROOT="{3}" --console=plain'
) -f $gradleWrapper, $androidRoot, $publicApplicationId, $resolvedBuildRoot

& cmd.exe /d /s /c $gradleCommand
if ($LASTEXITCODE -ne 0) {
    throw "Public VRTrickee Gradle build failed with exit code $LASTEXITCODE."
}

$generatedAab = Join-Path $resolvedBuildRoot 'app\outputs\bundle\release\app-release.aab'
$mergedManifest = Join-Path $resolvedBuildRoot 'app\intermediates\merged_manifest\release\AndroidManifest.xml'
if (-not (Test-Path -LiteralPath $generatedAab)) {
    throw "Expected AAB was not generated: $generatedAab"
}
if (-not (Test-Path -LiteralPath $mergedManifest)) {
    throw "Expected merged manifest was not generated: $mergedManifest"
}

[xml]$manifest = Get-Content -LiteralPath $mergedManifest -Raw
$actualApplicationId = $manifest.manifest.package
if ($actualApplicationId -ne $publicApplicationId) {
    throw "Wrong package in release manifest. Expected $publicApplicationId, found $actualApplicationId."
}

$androidNamespace = 'http://schemas.android.com/apk/res/android'
$versionCode = $manifest.manifest.GetAttribute('versionCode', $androidNamespace)
$versionName = $manifest.manifest.GetAttribute('versionName', $androidNamespace)
$targetSdk = $manifest.manifest.'uses-sdk'.GetAttribute('targetSdkVersion', $androidNamespace)
$usesCleartextTraffic = $manifest.manifest.application.GetAttribute('usesCleartextTraffic', $androidNamespace)
$permissions = @($manifest.manifest.'uses-permission' | ForEach-Object {
    $_.GetAttribute('name', $androidNamespace)
})
if ($targetSdk -ne '36') {
    throw "Wrong target SDK in release manifest. Expected 36, found $targetSdk."
}
if ($usesCleartextTraffic -ne 'false') {
    throw 'Public VRTrickee releases must reject cleartext HTTP traffic.'
}
$forbiddenPermissions = @(
    'android.permission.ACCESS_BACKGROUND_LOCATION',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_LOCATION',
    'com.google.android.gms.permission.AD_ID'
)
$unexpectedPermissions = @($forbiddenPermissions | Where-Object { $permissions -contains $_ })
if ($unexpectedPermissions.Count -gt 0) {
    throw "VRTrickee release contains restricted permissions that are outside the declared behavior: $($unexpectedPermissions -join ', ')"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$bundleArchive = [System.IO.Compression.ZipFile]::OpenRead($generatedAab)
try {
    $bundleManifest = $bundleArchive.Entries | Where-Object {
        $_.FullName -eq 'base/manifest/AndroidManifest.xml'
    } | Select-Object -First 1
    if ($null -eq $bundleManifest) {
        throw 'Generated AAB does not contain the base manifest.'
    }
    $hasSignatureFile = $null -ne ($bundleArchive.Entries | Where-Object {
        $_.FullName -match '^META-INF/[^/]+\.SF$'
    } | Select-Object -First 1)
    $hasSignatureBlock = $null -ne ($bundleArchive.Entries | Where-Object {
        $_.FullName -match '^META-INF/[^/]+\.(RSA|DSA|EC)$'
    } | Select-Object -First 1)
    if (-not ($hasSignatureFile -and $hasSignatureBlock)) {
        throw 'Generated AAB does not contain an Android upload signature.'
    }
}
finally {
    $bundleArchive.Dispose()
}

$jarsigner = Join-Path $env:JAVA_HOME 'bin\jarsigner.exe'
if (-not (Test-Path -LiteralPath $jarsigner)) {
    $jarsigner = (Get-Command jarsigner.exe -ErrorAction Stop).Source
}
& $jarsigner -verify $generatedAab | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Generated AAB failed JAR signature verification.'
}

$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
if (-not (Test-Path -LiteralPath $keytool)) {
    $keytool = (Get-Command keytool.exe -ErrorAction Stop).Source
}
$certificateText = (& $keytool -printcert -jarfile $generatedAab 2>&1) -join "`n"
if ($LASTEXITCODE -ne 0 -or $certificateText -notmatch 'SHA1:\s*([0-9A-F:]+)') {
    throw 'Unable to read the AAB signing-certificate SHA-1.'
}
$actualUploadSha1 = $Matches[1].ToUpperInvariant()
if ($actualUploadSha1 -ne $expectedUploadSha1) {
    throw "Wrong upload certificate. Expected $expectedUploadSha1, found $actualUploadSha1."
}

$releaseDirectory = Join-Path $resolvedBuildRoot 'release'
New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
$releaseAab = Join-Path $releaseDirectory "VRTrickee-public-$versionName-$versionCode.aab"
Copy-Item -LiteralPath $generatedAab -Destination $releaseAab -Force
$sha256 = (Get-FileHash -LiteralPath $releaseAab -Algorithm SHA256).Hash

[pscustomobject]@{
    ApplicationId = $actualApplicationId
    VersionName = $versionName
    VersionCode = $versionCode
    TargetSdk = $targetSdk
    UploadSha1 = $actualUploadSha1
    Aab = $releaseAab
    Sha256 = $sha256
    SignatureVerified = $true
} | Format-List
