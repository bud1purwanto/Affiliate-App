# ============================================================
#  Threadsmil — Auto Pull (PowerShell)
#  Menarik perubahan terbaru dari GitHub (branch main) berkala.
#
#  Cara pakai (PowerShell):
#    ./scripts/auto-pull.ps1            # default 60 detik
#    ./scripts/auto-pull.ps1 -Interval 30
#
#  Jika diblokir execution policy, jalankan sekali:
#    powershell -ExecutionPolicy Bypass -File scripts\auto-pull.ps1
#  Berhenti: Ctrl+C
# ============================================================
param([int]$Interval = 60)

# pindah ke root repo (folder di atas \scripts)
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Threadsmil auto-pull AKTIF" -ForegroundColor Cyan
Write-Host " Folder  : $(Get-Location)"
Write-Host " Interval: setiap $Interval detik"
Write-Host " Tekan Ctrl+C untuk berhenti."
Write-Host "============================================================" -ForegroundColor Cyan

while ($true) {
    Write-Host "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Cek pembaruan..." -ForegroundColor DarkGray
    git pull origin main
    Start-Sleep -Seconds $Interval
}
