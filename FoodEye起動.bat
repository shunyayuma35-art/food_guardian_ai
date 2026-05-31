@echo off
chcp 65001 > nul
echo FoodEye を起動しています...
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    setlocal enabledelayedexpansion
    set IP=!IP: =!
    echo 【アクセスURL】
    echo   このPC:        http://localhost:3001/
    echo   他のPC/スマホ: http://!IP!:3001/
    endlocal
)
echo.
echo ブラウザが自動で開きます。他の端末は上記URLを入力してください。
echo.
cd /d c:\food_guardian_ai
npm run start
pause
