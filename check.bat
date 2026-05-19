@echo off
title RESCUE LIFEBOAT — System Check
setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  RESCUE LIFEBOAT — System Check                               ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo  This checks your computer is ready to run Rescue Lifeboat.
echo  It fixes what it can automatically.
echo.

:: Move to the folder this script lives in (handles spaces in path)
cd /d "%~dp0"

set PASS=0
set FAIL=0
set FIXED=0

:: ── CHECK 1: Windows version ─────────────────────────────────────────────────
echo ── System ──

for /f "tokens=4-5 delims=. " %%i in ('ver') do (
  set WIN_VER=%%i.%%j
)
echo   ✓ Windows detected

echo.

:: ── CHECK 2: Node.js installed ───────────────────────────────────────────────
echo ── Node.js ──

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo   ✗ Node.js is NOT installed
  echo.
  echo   ┌─────────────────────────────────────────────────────────┐
  echo   │  WHAT TO DO                                               │
  echo   │                                                           │
  echo   │  1. The download page is opening now in your browser     │
  echo   │  2. Click the big green "LTS" download button            │
  echo   │  3. Run the installer ^(click Next until it's done^)      │
  echo   │  4. RESTART YOUR COMPUTER                                 │
  echo   │     ^(this step is not optional — PATH won't update       │
  echo   │      until you restart^)                                  │
  echo   │  5. Come back and double-click check.bat again           │
  echo   └─────────────────────────────────────────────────────────┘
  echo.
  start https://nodejs.org/en/download
  echo   Press any key to close this window.
  pause >nul
  exit /b 1
)

:: Get Node version
for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODE_VERSION=%%v
echo   ✓ Node.js is installed: %NODE_VERSION%

:: Check minimum version (need v16+)
for /f "tokens=1 delims=v." %%m in ("%NODE_VERSION%") do set NODE_MAJOR=%%m
for /f "tokens=2 delims=v." %%m in ("%NODE_VERSION%") do set NODE_MAJOR=%%m

if %NODE_MAJOR% LSS 16 (
  echo   ✗ Node.js version is too old ^(need v16 or newer^)
  echo     → Download the LTS version from nodejs.org
  echo     → Run the installer, then restart your computer
  start https://nodejs.org/en/download
  set /a FAIL+=1
) else (
  echo   ✓ Node.js version is compatible
  set /a PASS+=1
)

echo.

:: ── CHECK 3: npm available ───────────────────────────────────────────────────
echo ── npm ──

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo   ✗ npm is not found
  echo     → npm should install with Node.js. Try reinstalling Node.
  echo     → IMPORTANT: Restart your computer after reinstalling.
  set /a FAIL+=1
) else (
  for /f "tokens=*" %%v in ('npm --version 2^>nul') do set NPM_VERSION=%%v
  echo   ✓ npm is available: v%NPM_VERSION%
  set /a PASS+=1
)

echo.

:: ── CHECK 4: Required files ──────────────────────────────────────────────────
echo ── Files ──

set FILES_OK=1
for %%f in (server.js engine.js index.html package.json) do (
  if exist "%%f" (
    echo   ✓ %%f found
    set /a PASS+=1
  ) else (
    echo   ✗ %%f is missing
    echo     → Make sure all Rescue Lifeboat files are in this folder.
    set /a FAIL+=1
    set FILES_OK=0
  )
)

echo.

:: ── CHECK 5: Dependencies ────────────────────────────────────────────────────
echo ── Dependencies ──

if not exist "node_modules" (
  echo   Installing dependencies ^(first time setup — takes about 30 seconds^)...
  call npm install --silent 2>nul
  if %ERRORLEVEL% equ 0 (
    echo   ✓ Dependencies installed ^(auto-fixed^)
    set /a FIXED+=1
  ) else (
    echo   ✗ npm install failed
    echo     → Try running: npm install
    set /a FAIL+=1
  )
) else (
  echo   ✓ node_modules folder exists
  set /a PASS+=1
)

echo.

:: ── CHECK 6: ethers version ──────────────────────────────────────────────────
echo ── Package versions ──

if exist "node_modules\ethers\package.json" (
  for /f "tokens=*" %%v in ('node -e "try{const p=require('./node_modules/ethers/package.json');console.log(p.version)}catch(e){console.log('unknown')}" 2^>nul') do set ETHERS_VER=%%v

  echo   Checking ethers version: %ETHERS_VER%

  :: Get major version
  for /f "tokens=1 delims=." %%m in ("%ETHERS_VER%") do set ETHERS_MAJOR=%%m

  if "%ETHERS_MAJOR%"=="5" (
    echo   ⚠ ethers v5 detected ^(need v6^) — fixing automatically...
    call npm install ethers@6.7.1 @toruslabs/torus.js@6.4.1 @toruslabs/fetch-node-details@6.0.1 --silent 2>nul
    echo   ✓ ethers version corrected ^(auto-fixed^)
    set /a FIXED+=1
  ) else if "%ETHERS_MAJOR%"=="6" (
    echo   ✓ ethers v%ETHERS_VER% ^(correct^)
    set /a PASS+=1
  ) else (
    echo   ⚠ ethers v%ETHERS_VER% — unexpected version
    echo     → Run: npm install ethers@6.7.1
    set /a FAIL+=1
  )
) else (
  echo   ⚠ ethers not found — run npm install
  set /a FAIL+=1
)

echo.

:: ── CHECK 7: Test ethers actually works ──────────────────────────────────────
echo ── Validation ──

for /f "tokens=*" %%r in ('node -e "import('./node_modules/ethers/lib.esm/index.js').then(m=>{try{m.ethers.getAddress('0x9a2831d03a725e040a9b880De4b250e596069E53');console.log('ok')}catch(e){console.log('fail')}}).catch(()=>console.log('fail'))" 2^>nul') do set ETHERS_TEST=%%r

if "%ETHERS_TEST%"=="ok" (
  echo   ✓ Core wallet validation is working
  set /a PASS+=1
) else (
  echo   ✗ Core wallet validation failed
  echo     → Run: npm install ethers@6.7.1
  echo     → If that doesn't work, delete the node_modules folder and run npm install
  set /a FAIL+=1
)

echo.

:: ── SUMMARY ──────────────────────────────────────────────────────────────────
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  CHECK SUMMARY                                                ║
echo ╠══════════════════════════════════════════════════════════════╣

set /a TOTAL=%PASS%+%FIXED%
echo ║  ✓ %TOTAL% checks passed

if %FIXED% GTR 0 (
  echo ║    ^(%FIXED% issues were auto-fixed^)
)

if %FAIL% GTR 0 (
  echo ║  ✗ %FAIL% issues need attention — see above
  echo ╠══════════════════════════════════════════════════════════════╣
  echo ║                                                               ║
  echo ║  Fix the issues above, then run check.bat again.             ║
  echo ║  When everything is green, run start.bat to launch.          ║
  echo ║                                                               ║
  echo ╚══════════════════════════════════════════════════════════════╝
  echo.
  echo  Press any key to close.
  pause >nul
  exit /b 1
) else (
  echo ╠══════════════════════════════════════════════════════════════╣
  echo ║                                                               ║
  echo ║  ✓ Your system is ready.                                     ║
  echo ║                                                               ║
  echo ╚══════════════════════════════════════════════════════════════╝
  echo.
  echo  Launch Rescue Lifeboat now? Press Y to launch, any other key to exit.
  choice /c YN /n /m "  Your choice: "
  if %ERRORLEVEL% equ 1 (
    echo.
    call start.bat
  ) else (
    echo.
    echo  Run start.bat when you're ready.
    echo.
    pause >nul
  )
)
