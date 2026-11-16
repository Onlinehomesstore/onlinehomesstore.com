param(
  [string]$SourceDir,
  [string]$DestZip
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path -LiteralPath $DestZip) { Remove-Item -LiteralPath $DestZip -Force }

$keep = @('assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates')

$fs = [System.IO.File]::Open($DestZip, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)

$srcFull = (Resolve-Path -LiteralPath $SourceDir).Path.TrimEnd('\')
$count = 0

foreach ($top in $keep) {
  $topPath = Join-Path $srcFull $top
  if (-not (Test-Path -LiteralPath $topPath)) { continue }
  $files = Get-ChildItem -LiteralPath $topPath -Recurse -File
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($srcFull.Length + 1)
    $entryName = $rel -replace '\\', '/'
    $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($f.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Dispose()
    $entryStream.Dispose()
    $count++
  }
}

$archive.Dispose()
$fs.Dispose()

Write-Output ("ENTRIES=" + $count)

# Verify
$z = [System.IO.Compression.ZipFile]::OpenRead($DestZip)
$names = $z.Entries | ForEach-Object { $_.FullName }
$z.Dispose()
$need = @(
  'layout/theme.liquid',
  'templates/index.json',
  'templates/product.json',
  'templates/cart.json',
  'templates/collection.json',
  'templates/page.about.json',
  'templates/page.contact.json',
  'templates/gift_card.liquid',
  'sections/header-group.json',
  'sections/footer-group.json',
  'sections/uc-editorial-hero.liquid',
  'sections/before-after-comparison.liquid',
  'assets/before-after-comparison.css',
  'assets/uc-perf-responsive.css',
  'assets/uc-editorial-hero.css',
  'assets/uc-perf-responsive.css',
  'assets/uc-mobile-premium.css',
  'config/settings_schema.json',
  'config/settings_data.json',
  'locales/en.default.json'
)
foreach ($n in $need) {
  if ($names -contains $n) { Write-Output ("OK " + $n) } else { Write-Output ("MISSING " + $n); $global:LASTEXITCODE = 1 }
}
Write-Output ("FIRST: " + (($names | Select-Object -First 3) -join ' | '))
Write-Output ("HAS_BACKSLASH: " + [bool]($names | Where-Object { $_ -like '*\*' }))
if ($names | Where-Object { $_ -like '*\*' }) { exit 1 }
$miss = @($need | Where-Object { $names -notcontains $_ })
if ($miss.Count -gt 0) { exit 1 }
