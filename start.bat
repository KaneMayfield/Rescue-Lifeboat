@echo off
title LIFEBOAT — NFT Rescue Tool
echo.
echo  ========================================
echo    LIFEBOAT V10 - NFT Rescue Tool
echo    by Kane Mayfield - kanemayfield.com
echo  ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo  [!] Node.js is not installed on this computer.
  echo.
  echo  LIFEBOAT needs Node.js to run. It's free and takes
  echo  about 60 seconds to install.
  echo.
  echo  Opening the download page for you now...
  echo  Download the version marked "LTS" and run the installer.
  echo  When it's done, come back and double-click start.bat again.
  echo.
  start https://nodejs.org/en/download
  echo  Press any key to close this window.
  pause >nul
  exit /b 1
)

:: Move to the folder this bat file lives in
:: This handles spaces in the path correctly
cd /d "%~dp0"

echo  Installing dependencies...
call npm install --silent 2>nul

:: Pin critical packages to exact versions.
:: npm audit fix --force can downgrade ethers from v6 to v5, which breaks
:: everything (ethers.getAddress, JsonRpcProvider, BigInt handling are all
:: v6-only). Torus packages must stay at v6.x — v7+ changed the unvault
:: call signature. These lines ensure correct versions regardless of what
:: npm audit may have done.
echo  Verifying critical package versions...
call npm install ethers@6.7.1 @toruslabs/torus.js@6.4.1 @toruslabs/fetch-node-details@6.0.1 --silent 2>nul

echo.
echo  Starting local server...
echo  Browser will open automatically to localhost:3000
echo.
echo  Press Ctrl+C to stop.
echo.
node server.js
pause
