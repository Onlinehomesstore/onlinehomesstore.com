# Push UNIK CARE theme code to an existing Shopify theme (keeps settings/images).
# Usage:
#   .\push-theme.ps1
#   .\push-theme.ps1 -ThemeId 123456789012

param(
  [string]$Store = 'unik-care.myshopify.com',
  [string]$ThemeId = ''
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
  Write-Host 'Listing themes on store...' -ForegroundColor Cyan
  shopify theme list --store $Store
  Write-Host ''
  $ThemeId = Read-Host 'Enter the Theme ID to update (keeps images/settings)'
}

if (-not $ThemeId) {
  throw 'Theme ID is required.'
}

Write-Host ''
Write-Host "Pushing code to theme $ThemeId on $Store ..." -ForegroundColor Cyan
Write-Host 'Your Theme Editor settings and uploaded images will be kept.' -ForegroundColor Green

shopify theme push --store $Store --theme $ThemeId --path . --only assets sections snippets templates layout config locales

Write-Host ''
Write-Host 'Done. Refresh the storefront (hard refresh) and re-check Our Story template assignment if needed.' -ForegroundColor Green
Write-Host 'Pages → Our Story → Theme template → our-story' -ForegroundColor Yellow
