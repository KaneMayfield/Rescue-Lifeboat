# LIFEBOAT
### NFT Rescue Tool for Compromised EVM Wallets

**Free. Open source. No percentage. No catch.**

---

> *"Your wallet got hacked at 2am. Every whitehat service wants thousands of
> dollars to even look at the problem. You have NFTs. You have no ETH. You have
> a bot watching your wallet like a hawk.*
>
> *That is the exact situation this tool was built for."*
>
> — Kane Mayfield, February 16, 2026

---

## What This Is

LIFEBOAT is a free, downloadable tool that rescues NFTs from compromised EVM
wallets before sweeper bots can block you forever.

When a wallet is compromised, attackers typically deploy a "sweeper bot," an
automated script that monitors your wallet around the clock and instantly drains
any ETH the moment it arrives. The bot usually ignores NFTs because they require
gas to move, and the bot controls the gas. That's the window LIFEBOAT is
designed for.

LIFEBOAT uses MEV Blocker, a private transaction relay, to fund your
compromised wallet and fire all NFT transfers in a hidden pipeline that sweeper
bots cannot see or front-run. Transactions arrive confirmed on-chain before
the bot ever knows they happened.

**This tool was built in a real emergency, tested under real conditions, and
is being given away because I couldn't find it when I needed it.**

---

## Proof of Work

| Chain        | NFTs Rescued |
|--------------|-------------|
| ETH Mainnet  | 115         |
| Polygon      | 261         |
| Base         | 37          |
| **Total**    | **413**     |

Also transferred: Manifold creator contract ownership, kanemayfield.eth ENS name.
Compromised wallet drained to zero. Bot has nothing left to watch.

---

## What LIFEBOAT Does

- **Scans** your compromised wallet for NFTs across ETH, Polygon, Base,
  Optimism, and Avalanche simultaneously
- **Groups** NFTs by collection so you can review and select what to rescue
- **Estimates gas** per-token, per-chain so you know exactly what to fund
- **Routes transactions** through MEV Blocker (ETH mainnet) or standard
  private RPC (other chains) so sweeper bots cannot intercept
- **Executes transfers** one chain at a time, with real-time confirmations
  and clickable explorer links
- **Sweeps ERC-20 tokens** (USDC, WETH, airdrops) as a separate operation
- **Cleans up** with a burn button that wipes your keys from memory the
  moment you're done

---

## What LIFEBOAT Does NOT Do

- It does not take a percentage of your assets
- It does not custody your funds at any point
- It does not send your private key anywhere. Keys are processed locally
  and never leave your machine
- It does not require trusting a website, a smart contract, or a stranger
- It does not work on Solana (EVM chains only: ETH, Polygon, Base, etc.)
- It does not guarantee recovery of every token (ENS names require a
  separate manual step; some contracts have transfer restrictions)

---

## Quick Start

### Requirements
- A computer (Windows, Mac, or Linux)
- Node.js installed (free, see Step 1)
- A free Alchemy API key (free, see Step 2)
- A clean wallet address to receive rescued NFTs
- The private key of your compromised wallet

### Step 1: Install Node.js
Go to **nodejs.org** and download the LTS version. Install it like any
normal program. That's it.

If you're on Windows and have never done this before: download the .msi
installer, double-click it, click Next until it's done. Node is now installed.

### Step 2: Get a Free Alchemy API Key

1. Go to **dashboard.alchemy.com**
2. Create a free account (no credit card required)
3. Click **"Create new app"** and name it anything
4. Copy the API key from your app dashboard

**IMPORTANT — Enable All Chains:**
Alchemy only activates Ethereum by default. If you have NFTs on Polygon,
Base, Optimism, or Avalanche, you need to turn those on:

1. In your Alchemy dashboard, click into your app
2. Click **"Networks"** (or Configuration)
3. Toggle on: Polygon, Base, Optimism, Avalanche
4. Save. Your same API key now covers all chains

If you skip this step, LIFEBOAT will only find your Ethereum NFTs.

### Step 3: Download LIFEBOAT

Click the green **Code** button above → **Download ZIP**

Unzip the folder somewhere easy to find. Desktop is fine.

### Step 4: Run It

- **Windows:** Double-click `start.bat`
- **Mac/Linux:** Open Terminal, navigate to the LIFEBOAT folder, run `./start.sh`

Your browser will open automatically to `localhost:3000`.

If the browser doesn't open, go there manually: **http://localhost:3000**

If you see an error about missing packages, open Terminal in the LIFEBOAT
folder and run: `npm install` then try again.

**If you've never used Terminal before (Mac):**
Terminal is a text-based way to tell your computer where to go. Open Terminal,
type `cd ` (with a space after it), then drag the LIFEBOAT folder from Finder
into the Terminal window. This pastes the folder path. Press Enter. Now you're
in that folder and can run commands like `./start.sh` or `npm install`.

---

## How to Use It

### Tab 1: RESCUE (Scan)

This tab finds your NFTs. You don't need your private key for this step.

1. Enter your **compromised wallet address**, the hacked one (public address,
   not private key)
2. Enter your **clean destination wallet address**, where NFTs should go
3. Paste your **Alchemy API key**
4. Click **Scan All Chains**
5. Wait for results. Large wallets (200+ NFTs) can take a minute
6. Review the results. NFTs are grouped by collection. Uncheck anything you
   don't want to move.
7. When ready, click **Launch Lifeboat**

### Tab 2: LIFEBOAT (Execute)

This is where the rescue happens. You will need private keys here.

**What you need:**
- The **private key of your compromised wallet** (the hacked one)
- The **private key of a funding wallet**, a separate wallet with enough
  ETH/POL/AVAX to pay for gas

The compromised wallet cannot pay its own gas. That's the whole problem.
The funding wallet sends gas privately, then the transfers fire immediately.

**Steps:**
1. Enter both private keys in the fields provided
2. Click **Check Balances** to see what you're working with
3. Review the gas estimate. This is what the funding wallet needs to send
4. Select the chain you want to rescue first (start with Ethereum if in doubt)
5. Click **Execute Rescue**
6. Watch the log. Each transfer shows its transaction hash with an explorer link.
7. When confirmed, switch chains and repeat for Polygon, Base, etc.

**After every rescue:**
- Click the 🔥 **Clear Session** button immediately
- This wipes your keys from memory
- Close the browser tab
- Shut down the local server

### Tab 3: Token Sweep

Scans all chains for ERC-20 tokens (USDC, WETH, DAI, random airdrops) and
lets you sweep them one by one to your clean wallet.

### Tab 4: Native Balances

Shows native token balances (ETH, POL, AVAX, etc.) across all chains at once.
If there's anything left after the rescue, sweep it here.

### Tab 5: Manifold

If you have a Manifold creator contract connected to your compromised wallet,
this tab helps you transfer ownership to your clean wallet. This is a
separate operation from rescuing NFTs.

---

## Troubleshooting

### "Module not found" or "Cannot find package"
Run `npm install` in the LIFEBOAT folder. This downloads the required packages.

### Browser doesn't open
Go to http://localhost:3000 manually.

### Scan finds no NFTs
- Check that the wallet address is correct
- Make sure your Alchemy API key is valid
- Verify you enabled all chains in your Alchemy dashboard (not just Ethereum)

### Only Ethereum NFTs appear
Your Alchemy key is only set up for Ethereum by default. Go to your Alchemy
dashboard → your app → Networks → enable Polygon, Base, Optimism, Avalanche.

### "Insufficient funds"
The funding wallet needs more ETH/POL/AVAX than the gas estimate shows.
Add funds to the funding wallet and try again.

### Transaction failed or stuck
- Check the explorer link for details
- Some contracts have transfer restrictions LIFEBOAT can't override
- The rescue data is preserved — you can retry individual tokens

### ENS name didn't transfer
ENS names require a manual transfer via app.ens.domains. Use LIFEBOAT's
MEV-protected funding to get gas into your compromised wallet, then
complete the transfer manually before the bot can react.

---

## Supported Chains

| Chain       | MEV Protected | Native Token | Status       |
|-------------|---------------|--------------|--------------|
| Ethereum    | ✅ Yes        | ETH          | Tested       |
| Polygon     | No            | POL          | Tested       |
| Base        | No            | ETH          | Tested       |
| Optimism    | No            | ETH          | Configured   |
| Avalanche   | No            | AVAX         | Configured   |

MEV protection (via MEV Blocker) hides your transactions from the public
mempool. This is what prevents sweeper bots from seeing your moves on
Ethereum. Other chains don't have the same MEV infrastructure, but sweeper
bots are also less common there.

---

## Files in This Repository

```
LIFEBOAT/
├── start.bat         # Windows launcher (double-click this)
├── start.sh          # Mac/Linux launcher
├── server.js         # Local Express server
├── engine.js         # Blockchain operations (the real engine)
├── index.html        # The interface
├── package.json      # Dependencies
├── README.md         # You're reading it
├── LICENSE           # MIT License
├── DISCLAIMER.md     # Legal stuff, human-readable
├── SECURITY.md       # How keys are handled
└── CONTRIBUTING.md   # For developers who want to help
```

---

## Who Made This

**Kane Mayfield** — artist, builder, the guy who got hacked. I'm your neighbor.

- Website: kanemayfield.com
- Twitter: @kanemayfield
- If this saved your stuff and you feel like it: there is a whole "buy me a coffee" thing in there. But no pressure.

---

## License

MIT License, i did not go to school there.

Do whatever you want with it. Fork it, improve it, translate it,
build on it. If you improve it, please give it back.

See LICENSE file for full legal text.

---

## Contributing

If you found a bug, fixed something, or want to add support for a new chain,
pull requests are welcome.

If you're a developer who wants to understand the architecture before
diving in, read the constitution.

If you used this to recover your NFTs, drop a note. It helps.
