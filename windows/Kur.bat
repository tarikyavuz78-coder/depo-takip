@echo off
chcp 65001 >nul
rem Depo Takip - elle kurulum (Node.js kurulu olmalidir)
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Yonetici izni isteniyor...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0araclar\kur.ps1" -AppDir "%~dp0."
pause
