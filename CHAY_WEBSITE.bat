@echo off
chcp 65001 > nul
set "ROOT_DIR=%~dp0"
title First Bloom - Flower Shop Management System
echo ========================================================
echo   🌸 FIRST BLOOM - QUẢN LÝ TIỆM HOA KẼM NHUNG 🌸
echo ========================================================
echo.
echo Đang khởi động Backend Server (Port 5000)...
start "First Bloom - Backend Server" cmd /k "cd /d "%ROOT_DIR%backend" && npm run dev"

timeout /t 4 /nobreak > nul

echo Đang khởi động Frontend Web App (Port 5173)...
start "First Bloom - Frontend Web" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run dev"

timeout /t 3 /nobreak > nul

echo.
echo Đang mở trình duyệt vào website: http://localhost:5173
start http://localhost:5173

echo.
echo ========================================================
echo   HỆ THỐNG ĐÃ KHỞI CHẠY THÀNH CÔNG!
echo   - Website: http://localhost:5173
echo   - Backend API: http://localhost:5000
echo.
echo   Tài khoản đăng nhập:
echo   + Admin: username: admin    ^| password: Admin@FirstBloom2026!
echo   + Staff: username: staff01  ^| password: Staff@FirstBloom2026!
echo ========================================================
echo (Bạn có thể thu nhỏ cửa sổ này nhưng giữ các cửa sổ đen đang chạy để server hoạt động)
pause
