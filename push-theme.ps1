# Push Online Homes Store theme code to an unpublished Shopify theme (keeps settings/images).
# Does NOT publish. Preview the theme in Admin before going live.
#
# Usage:
#   .\push-theme.ps1
#   .\push-theme.ps1 -Store onlinehomesstore.myshopify.com -ThemeId 202967777657

param(
  [string]$Store = 'online-homes-store-7rve32vy.myshopify.com',
  # Default: keep working on the single live theme "OHS Homepage Fix"
  [string]$ThemeId = '202967777657'
)

$ErrorActionPreference = 'Stop'
$themePath = $PSScriptRoot

if (-not (Get-Command shopify -ErrorAction SilentlyContinue)) {
  Write-Host 'Shopify CLI not found. Installing @shopify/cli and @shopify/theme...' -ForegroundColor Yellow
  npm install -g @shopify/cli @shopify/theme
}

if (-not (Test-Path (Join-Path $themePath 'layout\theme.liquid'))) {
  throw "Theme root not found (missing layout/theme.liquid): $themePath"
}

Set-Location $themePath

if (-not $ThemeId) {
  Write-Host ''
  Write-Host "Listing themes on $Store ..." -ForegroundColor Cyan
  shopify theme list --store $Store
  Write-Host ''
  Write-Host 'Choose an UNPUBLISHED theme ID (do not use the live/main theme).' -ForegroundColor Yellow
  $ThemeId = Read-Host 'Enter the Theme ID to update (keeps images/settings)'
}

if (-not $ThemeId) {
  throw 'Theme ID is required.'
}

Write-Host ''
Write-Host "Pushing code to UNPUBLISHED theme $ThemeId on $Store ..." -ForegroundColor Cyan
Write-Host 'This does not publish. Theme Editor settings and uploaded images are kept.' -ForegroundColor Green

shopify theme push --store $Store --theme $ThemeId --path . --only assets sections snippets templates layout config locales

Write-Host ''
Write-Host 'Done. In Shopify Admin → Online Store → Themes → Preview the unpublished theme.' -ForegroundColor Green
Write-Host 'Hard-refresh the preview. Do not click Publish until you approve the design.' -ForegroundColor Yellow
