Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path (Split-Path $PSScriptRoot -Parent) 'UNIK CARE THEME.zip'
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
$z.Entries | Select-Object -First 6 | ForEach-Object { $_.FullName }
$z.Dispose()
Write-Output ("PSVersion=" + $PSVersionTable.PSVersion.ToString())
