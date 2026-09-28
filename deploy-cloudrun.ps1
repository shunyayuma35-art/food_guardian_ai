# Cloud Run deploy script
# 1. Writes .env.production (NEXT_PUBLIC_* only) from .env.local
# 2. Runs gcloud run deploy
# 3. Deletes .env.production after deploy
# Values are never printed to the console.
#
# Usage:
#   .\deploy-cloudrun.ps1            -- full deploy
#   .\deploy-cloudrun.ps1 -DryRun    -- show var names only, no gcloud call

param(
    [switch]$DryRun
)

$envFile    = ".env.local"
$buildEnv   = ".env.production"

if (-not (Test-Path $envFile)) {
    Write-Error ".env.local not found. Run this script from the project root."
    exit 1
}

# Extract NEXT_PUBLIC_* lines only -> .env.production
$publicLines = Get-Content $envFile | Where-Object { $_ -match '^NEXT_PUBLIC_[A-Z0-9_]+=.' }
if ($publicLines.Count -eq 0) {
    Write-Error "No NEXT_PUBLIC_* variables found in .env.local"
    exit 1
}

if (-not $DryRun) {
    $publicLines | Set-Content -Encoding utf8 $buildEnv
}
Write-Host "NEXT_PUBLIC_* keys for build: $($publicLines.Count) (values hidden)"

# Extract non-NEXT_PUBLIC_* as runtime env vars (includes AGENT_SESSION_SECRET automatically)
$runtimeVars = [System.Collections.Generic.List[string]]::new()
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^([A-Z_][A-Z0-9_]*)=(.+)$' -and $line -notmatch '^NEXT_PUBLIC_') {
        $key   = $matches[1]
        $value = $matches[2].Trim('"').Trim("'")
        $runtimeVars.Add("${key}=${value}")
    }
}

# AI provider settings (non-secret: hard-coded here, not from .env.local)
$aiVars = @(
    "AI_PROVIDER=gemini",
    "GOOGLE_CLOUD_PROJECT=project-66aee540-552a-4a95-b80",
    "GOOGLE_CLOUD_LOCATION=global",
    "GEMINI_MODEL=gemini-3.8-flash"
)
foreach ($v in $aiVars) {
    $runtimeVars.Add($v)
}
Write-Host "Added $($aiVars.Count) AI provider vars (non-secret)"

# Show var names (values hidden)
$varNames = $runtimeVars | ForEach-Object { ($_ -split '=')[0] }
Write-Host "Runtime env vars ($($runtimeVars.Count) total): $($varNames -join ', ')"

if ($DryRun) {
    Write-Host "[DryRun] gcloud run deploy would be called with the above vars. Exiting without deploy."
    exit 0
}

$deployArgs = [System.Collections.Generic.List[string]]@(
    "run", "deploy", "foodeye",
    "--source", ".",
    "--region", "asia-northeast1",
    "--allow-unauthenticated",
    "--port", "8080",
    "--max-instances", "2"
)

if ($runtimeVars.Count -gt 0) {
    $deployArgs.Add("--set-env-vars")
    $deployArgs.Add(($runtimeVars -join ','))
}

Write-Host "Running gcloud run deploy..."

try {
    & gcloud @deployArgs
} finally {
    # Always clean up .env.production even if deploy fails
    if (Test-Path $buildEnv) {
        Remove-Item $buildEnv -Force
        Write-Host "Deleted .env.production"
    }
}
