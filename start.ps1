# Exam Klickdummy – Start unter Windows (PowerShell)
# Lädt beim ersten Start PocketBase herunter und startet den lokalen Server.
$ErrorActionPreference = "Stop"
$PbVersion = if ($env:PB_VERSION) { $env:PB_VERSION } else { "0.40.5" }
$Port = if ($env:PORT) { $env:PORT } else { "8090" }
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".\pocketbase.exe")) {
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "amd64" }
  $url = "https://github.com/pocketbase/pocketbase/releases/download/v$PbVersion/pocketbase_${PbVersion}_windows_$arch.zip"
  Write-Host "Lade PocketBase $PbVersion (windows/$arch) ..."
  Invoke-WebRequest -Uri $url -OutFile "pocketbase.zip"
  Expand-Archive -Path "pocketbase.zip" -DestinationPath ".\pb_tmp" -Force
  Move-Item ".\pb_tmp\pocketbase.exe" ".\pocketbase.exe" -Force
  Remove-Item ".\pb_tmp" -Recurse -Force
  Remove-Item "pocketbase.zip"
}

Write-Host ""
Write-Host "  Exam Klickdummy laeuft unter:  http://localhost:$Port"
Write-Host "  PocketBase-Admin (optional):     http://localhost:$Port/_/"
Write-Host "  Beenden mit Strg+C"
Write-Host ""
Start-Process "http://localhost:$Port"
& .\pocketbase.exe serve --http "0.0.0.0:$Port" --dir .\pb_data --publicDir .\pb_public --hooksDir .\pb_hooks --migrationsDir .\pb_migrations
