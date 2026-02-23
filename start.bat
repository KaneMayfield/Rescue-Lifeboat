@echo off
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

echo  Installing dependencies (first run only)...
call npm install --silent 2>nul
echo.
echo  Starting local server...
echo  Browser will open automatically to localhost:3000
echo.
echo  Press Ctrl+C to stop.
echo.
node server.js
