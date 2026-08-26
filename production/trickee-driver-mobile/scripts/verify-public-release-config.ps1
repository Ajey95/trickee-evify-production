[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$mobileRoot = Split-Path -Parent $PSScriptRoot
$rootGradle = Get-Content -LiteralPath (Join-Path $mobileRoot 'android\build.gradle') -Raw
$appGradle = Get-Content -LiteralPath (Join-Path $mobileRoot 'android\app\build.gradle') -Raw
$buildScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'build-public-release.ps1') -Raw

$expectations = [ordered]@{
    'compile SDK 36' = $rootGradle -match 'compileSdkVersion\s*=\s*36'
    'target SDK 36' = $rootGradle -match 'targetSdkVersion\s*=\s*36'
    'build tools 36.0.0' = $rootGradle -match 'buildToolsVersion\s*=\s*"36\.0\.0"'
    'private package preserved' = $appGradle -match 'privateApplicationId\s*=\s*"com\.trickeeandroid"'
    'public package isolated' = $appGradle -match 'publicApplicationId\s*=\s*"com\.trickee\.vrtrickee"'
    'version code 10' = $appGradle -match 'versionCode\s+10(?:\s|$)'
    'version name 1.0.9' = $appGradle -match 'versionName\s+"1\.0\.9"'
    'public build command uses isolated package' = $buildScript -match "publicApplicationId\s*=\s*'com\.trickee\.vrtrickee'"
    'build verifies target SDK' = $buildScript -match 'TargetSdk'
    'build verifies Google OAuth configuration' = $buildScript -match 'GOOGLE_WEB_CLIENT_ID'
    'build verifies restricted permissions' = $buildScript -match 'ACCESS_BACKGROUND_LOCATION'
}

$failed = @($expectations.GetEnumerator() | Where-Object { -not $_.Value })
if ($failed.Count -gt 0) {
    $names = ($failed | ForEach-Object Key) -join ', '
    throw "VRTrickee public release configuration is incomplete: $names"
}

Write-Output 'VRTrickee release configuration verified: com.trickee.vrtrickee, 1.0.9 (10), target SDK 36; com.trickeeandroid preserved.'
