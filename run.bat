@echo off
echo.
echo ========================================
echo   Facebook Group Automation
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    echo This may take a few minutes...
    echo.
    call npm install
    echo.
)

echo Starting application...
echo.
call npm start

pause
