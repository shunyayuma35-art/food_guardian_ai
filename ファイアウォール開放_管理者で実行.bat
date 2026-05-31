@echo off
chcp 65001 > nul
echo ポート3001のファイアウォール開放を実行します...
netsh advfirewall firewall delete rule name="FoodEye Port 3001" > nul 2>&1
netsh advfirewall firewall add rule name="FoodEye Port 3001" dir=in action=allow protocol=TCP localport=3001
if %errorlevel% == 0 (
    echo.
    echo ✅ 完了！スマホ・タブレット・他のPCから以下のURLでアクセスできます：
    echo.
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
        set IP=%%a
        setlocal enabledelayedexpansion
        set IP=!IP: =!
        echo   http://!IP!:3001/
        endlocal
    )
) else (
    echo ❌ エラーが発生しました。管理者として実行してください。
)
echo.
pause
