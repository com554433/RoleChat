@echo off
cd /d "%~dp0"

echo ========================================
echo   RoleChat - Electron Desktop Builder
echo ========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found
    echo Install from: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Set mirrors for China
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

:: Install dependencies
echo.
echo [1/3] Installing dependencies...
echo This may take 5-15 min on first run (~150MB download)...
if not exist "node_modules" (
    call npm install --registry=https://registry.npmmirror.com
    if %errorlevel% neq 0 (
        echo [WARN] Mirror failed, trying default...
        call npm install
        if %errorlevel% neq 0 (
            echo [ERROR] npm install failed
            pause
            exit /b 1
        )
    )
    echo [OK] Installed
) else (
    echo [SKIP] Already installed
)

:: Build frontend
echo.
echo [2/3] Building frontend...
echo   Type checking (warnings are OK)...
node "%~dp0node_modules\typescript\lib\tsc.js" --noEmit
if %errorlevel% neq 0 (
    echo [WARN] Type check had errors, continuing anyway...
)
echo   Bundling with Vite...
node "%~dp0node_modules\vite\bin\vite.js" build
if %errorlevel% neq 0 (
    echo [ERROR] Vite build failed
    pause
    exit /b 1
)
echo [OK] Frontend built

:: Package Electron
echo.
echo [3/3] Packaging Electron...
node "%~dp0node_modules\electron-builder\out\cli\cli.js" build --win --publish=never
if %errorlevel% neq 0 (
    echo [WARN] Trying fallback build...
    node "%~dp0node_modules\electron-builder\out\cli\cli.js" build --win dir --publish=never
    if %errorlevel% neq 0 (
        echo [ERROR] Build failed
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo [OK] Build successful!
echo EXE: release\win-unpacked\RoleChat.exe
echo ========================================

:: Copy to G drive if it exists
if exist "G:\" (
    echo.
    echo [4/4] Copying to G:\RoleChat...
    robocopy "%~dp0release\win-unpacked" "G:\RoleChat" /E /NJH /NJS /NP /NS /NC >nul 2>nul
    echo [OK] Deployed to G:\RoleChat
    explorer "G:\RoleChat"
) else (
    explorer "%~dp0release\win-unpacked"
)
echo.
pause
