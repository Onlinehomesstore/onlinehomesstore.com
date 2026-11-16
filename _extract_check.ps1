Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path (Split-Path $PSScriptRoot -Parent) 'UNIK CARE THEME.zip'
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
$names = $z.Entries | ForEach-Object { $_.FullName }

function Get-EntryText($entryName) {
  $e = $z.Entries | Where-Object { $_.FullName -eq $entryName } | Select-Object -First 1
  if (-not $e) { return $null }
  $sr = New-Object System.IO.StreamReader($e.Open())
  $txt = $sr.ReadToEnd()
  $sr.Dispose()
  return $txt
}

foreach ($tpl in @('templates/index.json', 'templates/cart.json', 'templates/product.json')) {
  Write-Output "==== $tpl ===="
  $txt = Get-EntryText $tpl
  if (-not $txt) { Write-Output "  NOT IN ZIP"; continue }
  Write-Output ("  bytes=" + $txt.Length)
  try {
    $obj = $txt | ConvertFrom-Json
    Write-Output "  JSON=valid"
    $types = @()
    foreach ($p in $obj.sections.PSObject.Properties) { $types += $p.Value.type }
    $types = $types | Select-Object -Unique
    foreach ($t in $types) {
      $sf = "sections/$t.liquid"
      if ($names -contains $sf) { Write-Output ("  OK section " + $t) } else { Write-Output ("  MISSING section file " + $sf) }
    }
  } catch {
    Write-Output ("  JSON INVALID: " + $_.Exception.Message)
  }
}
$z.Dispose()
