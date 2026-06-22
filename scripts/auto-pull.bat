@echo off
REM ============================================================
REM  Threadsmil — Auto Pull (Windows)
REM  Menarik perubahan terbaru dari GitHub (branch main) secara
REM  berkala, supaya folder laptop selalu sinkron dengan yang
REM  kamu kerjakan lewat Claude Code di HP.
REM
REM  Cara pakai:
REM   - Klik dua kali file ini, ATAU
REM   - Jalankan: auto-pull.bat 30   (angka = interval detik)
REM  Berhenti: tutup jendela / tekan Ctrl+C
REM ============================================================
setlocal
set INTERVAL=%1
if "%INTERVAL%"=="" set INTERVAL=60

REM pindah ke folder root repo (folder di atas \scripts)
cd /d "%~dp0.."

echo ============================================================
echo  Threadsmil auto-pull AKTIF
echo  Folder : %CD%
echo  Interval: setiap %INTERVAL% detik
echo  Tekan Ctrl+C untuk berhenti.
echo ============================================================

:loop
echo.
echo [%date% %time%] Cek pembaruan...
git pull origin main
timeout /t %INTERVAL% /nobreak >nul
goto loop
