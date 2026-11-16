@echo off
title First Bloom - Centralized Flower Shop Management
echo ========================================================
echo   FIRST BLOOM - QUAN LY TIEM HOA KEM NHUNG
echo   He thong CSDL Tap trung va Dong bo Da thiet bi
echo ========================================================
echo.
echo Dang khoi dong Backend va Frontend...
echo.

start "First Bloom Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 >nul
start "First Bloom Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo   DA KHOI DONG THANH CONG!
echo   Dia chi Web tren may tinh: http://localhost:5173
echo   Dia chi Web tren dien thoai: http://192.168.1.184:5173
echo ========================================================
echo.
pause
