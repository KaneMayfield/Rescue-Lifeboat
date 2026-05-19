#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  RESCUE LIFEBOAT — Mac/Linux System Check                     ║
# ║  Run this ONCE before using Rescue Lifeboat for the first     ║
# ║  time. It checks your system, fixes what it can, and tells    ║
# ║  you exactly what to do if anything needs attention.          ║
# ╚══════════════════════════════════════════════════════════════╝
#
# Run from your Rescue Lifeboat folder:
#   bash check.sh
#
# Or make it executable first (one time only):
#   chmod +x check.sh
#   ./check.sh

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESCUE LIFEBOAT — System Check                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0
WARN=0
FIXED=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; echo "    → $2"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠ $1"; echo "    → $2"; WARN=$((WARN+1)); }
fixed() { echo "  ✓ $1 (auto-fixed)"; FIXED=$((FIXED+1)); }
info() { echo "    $1"; }

# ── Move to the folder this script lives in ─────────────────────────────────
cd "$(dirname "$0")"

# ── STEP 1: Detect OS ────────────────────────────────────────────────────────
echo "── System ──"

OS="unknown"
MACOS_VERSION=""
MACOS_MAJOR=0
MACOS_MINOR=0

if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="mac"
  MACOS_VERSION=$(sw_vers -productVersion 2>/dev/null || echo "unknown")
  MACOS_MAJOR=$(echo "$MACOS_VERSION" | cut -d. -f1)
  MACOS_MINOR=$(echo "$MACOS_VERSION" | cut -d. -f2)
  MACOS_NAME=""

  case "$MACOS_MAJOR" in
    15) MACOS_NAME="Sequoia" ;;
    14) MACOS_NAME="Sonoma" ;;
    13) MACOS_NAME="Ventura" ;;
    12) MACOS_NAME="Monterey" ;;
    11) MACOS_NAME="Big Sur" ;;
    10)
      case "$MACOS_MINOR" in
        15) MACOS_NAME="Catalina" ;;
        14) MACOS_NAME="Mojave" ;;
        13) MACOS_NAME="High Sierra" ;;
        *) MACOS_NAME="macOS 10.$MACOS_MINOR" ;;
      esac
      ;;
    *) MACOS_NAME="macOS $MACOS_VERSION" ;;
  esac

  pass "Operating system: macOS $MACOS_VERSION ($MACOS_NAME)"

  # Determine the right Node version for this macOS
  RECOMMENDED_NODE=""
  RECOMMENDED_URL=""

  if [[ "$MACOS_MAJOR" -ge 14 ]]; then
    RECOMMENDED_NODE="22 LTS"
    RECOMMENDED_URL="https://nodejs.org/en/download"
  elif [[ "$MACOS_MAJOR" -eq 13 ]]; then
    if [[ "$MACOS_MINOR" -ge 5 ]]; then
      RECOMMENDED_NODE="22 LTS"
      RECOMMENDED_URL="https://nodejs.org/en/download"
    else
      RECOMMENDED_NODE="20 LTS"
      RECOMMENDED_URL="https://nodejs.org/en/blog/release/v20.18.1"
    fi
  elif [[ "$MACOS_MAJOR" -eq 12 ]]; then
    RECOMMENDED_NODE="20 LTS"
    RECOMMENDED_URL="https://nodejs.org/en/blog/release/v20.18.1"
  elif [[ "$MACOS_MAJOR" -eq 11 ]] || [[ "$MACOS_MAJOR" -eq 10 && "$MACOS_MINOR" -eq 15 ]]; then
    RECOMMENDED_NODE="18 LTS"
    RECOMMENDED_URL="https://nodejs.org/dist/v18.20.8/node-v18.20.8.pkg"
  elif [[ "$MACOS_MAJOR" -eq 10 && "$MACOS_MINOR" -eq 14 ]]; then
    RECOMMENDED_NODE="16"
    RECOMMENDED_URL="https://nodejs.org/en/download/releases"
  else
    RECOMMENDED_NODE="18 LTS (or older)"
    RECOMMENDED_URL="https://nodejs.org/en/download/releases"
  fi

  info "Recommended Node.js for your Mac: $RECOMMENDED_NODE"

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
  DISTRO=$(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo "Linux")
  pass "Operating system: $DISTRO"
  RECOMMENDED_NODE="20 LTS or newer"
  RECOMMENDED_URL="https://nodejs.org/en/download"
else
  warn "Unknown OS type: $OSTYPE" "This script is designed for Mac and Linux."
fi

echo ""

# ── STEP 2: Check Node.js ────────────────────────────────────────────────────
echo "── Node.js ──"

if ! command -v node &> /dev/null; then
  fail "Node.js is NOT installed" "You need Node.js to run Rescue Lifeboat."
  echo ""
  echo "  ┌─────────────────────────────────────────────────────────┐"
  echo "  │  WHAT TO DO                                               │"
  echo "  │                                                           │"
  if [[ "$OS" == "mac" ]]; then
    echo "  │  1. Go to: $RECOMMENDED_URL"
    echo "  │  2. Download Node.js $RECOMMENDED_NODE"
    echo "  │  3. Open the .pkg file and follow the installer"
    echo "  │  4. Close this Terminal window completely"
    echo "  │  5. Open a NEW Terminal window"
    echo "  │  6. Come back to this folder and run: bash check.sh"
  else
    echo "  │  1. Go to: https://nodejs.org/en/download"
    echo "  │  2. Download and install Node.js LTS"
    echo "  │  3. Restart your terminal and run this check again"
  fi
  echo "  └─────────────────────────────────────────────────────────┘"
  echo ""

  # Try to open the download page automatically
  if command -v open &> /dev/null; then
    echo "  Opening download page..."
    open "$RECOMMENDED_URL"
  elif command -v xdg-open &> /dev/null; then
    xdg-open "$RECOMMENDED_URL"
  fi

  echo ""
  echo "  Run this check again after installing Node.js."
  echo ""
  exit 1
else
  NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

  pass "Node.js is installed: v$NODE_VERSION"

  # Check if the version is appropriate for their macOS
  VERSION_OK=true
  VERSION_NOTE=""

  if [[ "$OS" == "mac" ]]; then
    if [[ "$MACOS_MAJOR" -le 10 && "$MACOS_MINOR" -le 14 ]]; then
      if [[ "$NODE_MAJOR" -gt 16 ]]; then
        VERSION_OK=false
        VERSION_NOTE="Your Mac (macOS $MACOS_VERSION) needs Node 16 or older. You have v$NODE_VERSION."
      fi
    elif [[ "$MACOS_MAJOR" -eq 11 ]] || [[ "$MACOS_MAJOR" -eq 10 && "$MACOS_MINOR" -eq 15 ]]; then
      if [[ "$NODE_MAJOR" -gt 18 ]]; then
        VERSION_OK=false
        VERSION_NOTE="Your Mac (macOS $MACOS_VERSION / $MACOS_NAME) needs Node 18 or older. You have v$NODE_VERSION."
      fi
    elif [[ "$MACOS_MAJOR" -eq 12 ]] || [[ "$MACOS_MAJOR" -eq 13 && "$MACOS_MINOR" -lt 5 ]]; then
      if [[ "$NODE_MAJOR" -gt 20 ]]; then
        VERSION_OK=false
        VERSION_NOTE="Your Mac ($MACOS_NAME $MACOS_VERSION) needs Node 20 or older. You have v$NODE_VERSION."
      fi
    fi
  fi

  if [[ "$NODE_MAJOR" -lt 16 ]]; then
    VERSION_OK=false
    VERSION_NOTE="Node v$NODE_VERSION is too old. Rescue Lifeboat needs Node 16 or newer."
  fi

  if [[ "$VERSION_OK" == "false" ]]; then
    fail "Node.js version mismatch" "$VERSION_NOTE"
    echo ""
    echo "  ┌─────────────────────────────────────────────────────────┐"
    echo "  │  HOW TO FIX                                               │"
    echo "  │                                                           │"
    echo "  │  1. Download the right version: $RECOMMENDED_URL"
    echo "  │  2. Run the installer — it will replace your current Node │"
    echo "  │  3. Close ALL Terminal windows                            │"
    echo "  │  4. Open a NEW Terminal and run: bash check.sh            │"
    echo "  └─────────────────────────────────────────────────────────┘"
    echo ""
    if command -v open &> /dev/null; then
      echo "  Opening download page..."
      open "$RECOMMENDED_URL"
    fi
  else
    pass "Node.js version is compatible with your system"
  fi
fi

echo ""

# ── STEP 3: Check npm ────────────────────────────────────────────────────────
echo "── npm ──"

if ! command -v npm &> /dev/null; then
  fail "npm is not found" "npm should have been installed with Node.js. Try reinstalling Node."
else
  NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
  pass "npm is available: v$NPM_VERSION"
fi

echo ""

# ── STEP 4: Check script permissions (Mac/Linux only) ───────────────────────
echo "── File permissions ──"

if [[ "$OS" == "mac" || "$OS" == "linux" ]]; then
  # Check and fix start.sh
  if [[ -f "start.sh" ]]; then
    if [[ ! -x "start.sh" ]]; then
      chmod +x start.sh
      fixed "start.sh is now executable"
    else
      pass "start.sh is executable"
    fi
  else
    warn "start.sh not found" "Are you running this from the Rescue Lifeboat folder?"
  fi

  # Check and fix check.sh itself
  if [[ -f "check.sh" && ! -x "check.sh" ]]; then
    chmod +x check.sh
    fixed "check.sh is now executable"
  fi
fi

echo ""

# ── STEP 5: Check dependencies ───────────────────────────────────────────────
echo "── Dependencies ──"

if [[ ! -d "node_modules" ]]; then
  echo "  Installing dependencies (first time setup — takes about 30 seconds)..."
  npm install --silent 2>/dev/null
  if [[ $? -eq 0 ]]; then
    fixed "Dependencies installed"
  else
    fail "npm install failed" "Try running: npm install"
  fi
else
  pass "node_modules folder exists"
fi

echo ""

# ── STEP 6: Check critical package versions ───────────────────────────────────
echo "── Package versions ──"

# Check ethers version
if [[ -d "node_modules/ethers" ]]; then
  ETHERS_VERSION=$(node -e "try{const p=require('./node_modules/ethers/package.json');console.log(p.version)}catch(e){console.log('unknown')}" 2>/dev/null || echo "unknown")
  ETHERS_MAJOR=$(echo "$ETHERS_VERSION" | cut -d. -f1)

  if [[ "$ETHERS_MAJOR" == "5" ]]; then
    echo "  ⚠ ethers v$ETHERS_VERSION detected (need v6) — fixing..."
    npm install ethers@6.7.1 @toruslabs/torus.js@6.4.1 @toruslabs/fetch-node-details@6.0.1 --silent 2>/dev/null
    NEW_VERSION=$(node -e "try{const p=require('./node_modules/ethers/package.json');console.log(p.version)}catch(e){console.log('unknown')}" 2>/dev/null || echo "unknown")
    fixed "ethers upgraded from v$ETHERS_VERSION to v$NEW_VERSION"
  elif [[ "$ETHERS_MAJOR" == "6" ]]; then
    pass "ethers v$ETHERS_VERSION (correct)"
  else
    warn "ethers v$ETHERS_VERSION — unexpected version" "Expected v6.x. Run: npm install ethers@6.7.1"
  fi
else
  warn "ethers not found in node_modules" "Run npm install"
fi

# Verify ethers actually works
ETHERS_CHECK=$(node --input-type=module << 'EOF' 2>/dev/null
import { ethers } from './node_modules/ethers/lib.esm/index.js';
const result = ethers.getAddress('0x9a2831d03a725e040a9b880De4b250e596069E53');
console.log(result ? 'ok' : 'fail');
EOF
)

# Simpler check
ETHERS_WORKS=$(node -e "import('./node_modules/ethers/lib.esm/index.js').then(m=>{try{m.ethers.getAddress('0x9a2831d03a725e040a9b880De4b250e596069E53');console.log('ok')}catch(e){console.log('fail')}}).catch(()=>console.log('fail'))" 2>/dev/null || echo "unknown")

if [[ "$ETHERS_WORKS" == "ok" ]]; then
  pass "ethers.getAddress() works correctly"
elif [[ "$ETHERS_WORKS" == "fail" ]]; then
  fail "ethers.getAddress() is not working" "Run: npm install ethers@6.7.1"
fi

echo ""

# ── STEP 7: Check server.js exists ───────────────────────────────────────────
echo "── Files ──"

REQUIRED_FILES=("server.js" "engine.js" "index.html" "package.json")
for f in "${REQUIRED_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    pass "$f found"
  else
    fail "$f is missing" "Make sure all Rescue Lifeboat files are in this folder."
  fi
done

echo ""

# ── SUMMARY ──────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  CHECK SUMMARY                                                ║"
echo "╠══════════════════════════════════════════════════════════════╣"

TOTAL=$((PASS + FIXED))
printf "║  ✓ %d checks passed" "$TOTAL"
if [[ $FIXED -gt 0 ]]; then
  printf " (%d auto-fixed)" "$FIXED"
fi
echo ""

if [[ $WARN -gt 0 ]]; then
  printf "║  ⚠ %d warnings\n" "$WARN"
fi

if [[ $FAIL -gt 0 ]]; then
  printf "║  ✗ %d issues need attention — see above\n" "$FAIL"
  echo "╠══════════════════════════════════════════════════════════════╣"
  echo "║                                                               ║"
  echo "║  Fix the issues above, then run: bash check.sh               ║"
  echo "║  When everything is green, run:  ./start.sh                  ║"
  echo "║                                                               ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  exit 1
else
  echo "╠══════════════════════════════════════════════════════════════╣"
  echo "║                                                               ║"
  echo "║  ✓ Your system is ready. Run: ./start.sh                     ║"
  echo "║                                                               ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  # Offer to launch immediately
  read -p "  Launch Rescue Lifeboat now? [Y/n] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo ""
    bash start.sh
  else
    echo "  Run ./start.sh when you're ready."
    echo ""
  fi
fi
