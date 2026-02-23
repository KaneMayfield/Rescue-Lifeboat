#!/bin/bash
echo ""
echo "  ========================================"
echo "    LIFEBOAT V10 - NFT Rescue Tool"
echo "    by Kane Mayfield - kanemayfield.com"
echo "  ========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "  [!] Node.js is not installed on this computer."
  echo ""
  echo "  LIFEBOAT needs Node.js to run. It's free and takes"
  echo "  about 60 seconds to install."
  echo ""
  echo "  Opening the download page for you now..."
  echo "  Download the version marked 'LTS' and run the installer."
  echo "  When it's done, come back and run start.sh again."
  echo ""
  # Try to open browser on Mac or Linux
  if command -v open &> /dev/null; then
    open "https://nodejs.org/en/download"
  elif command -v xdg-open &> /dev/null; then
    xdg-open "https://nodejs.org/en/download"
  fi
  echo "  If the page didn't open: https://nodejs.org/en/download"
  echo ""
  exit 1
fi

echo "  Installing dependencies (first run only)..."
npm install --silent 2>/dev/null
echo ""
echo "  Starting local server..."
echo "  Browser will open automatically to localhost:3000"
echo ""
echo "  Press Ctrl+C to stop."
echo ""
node server.js
