![RESCUE LIFEBOAT](Rescue%20Lifeboat.png)

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

![lighthouse](lighthouse.png)

## What This Is

Rescue Lifeboat is a free, downloadable tool that rescues NFTs from compromised EVM
wallets before sweeper bots can block you forever.

When a wallet is compromised, attackers typically deploy a "sweeper bot," an
automated script that monitors your wallet around the clock and instantly drains
any ETH the moment it arrives. The bot usually ignores NFTs because they require
gas to move, and the bot controls the gas. That's the window Rescue Lifeboat is
designed for.

Rescue Lifeboat uses MEV Blocker, a private transaction relay, to fund your
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

## What Rescue Lifeboat Does

- **Scans** your compromised wallet for NFTs across ETH, Polygon, Base,
  Optimism, and Avalanche simultaneously
- **Groups** NFTs by collection so you can review and select what to rescue
- **Estimates gas** per-token, per-chain so you know exactly what to fund
- **Routes transactions** through MEV Blocker (ETH mainnet) or standard
  private RPC (other chains) so sweeper bots cannot intercept
- **Executes transfers** one chain at a time, with real-time confirmations
  and clickable explorer links
- **Sweeps ERC-20 tokens** (USDC, WETH, airdrops) as a separate operation
- **Sweeps native balances** (ETH, POL, AVAX, etc.) across all chains at once
- **Sends quiet gas funding** via MEV Blocker so you can pay for manual
  operations without the bot seeing the deposit
- **Guides you through other assets** — ENS names, staked positions,
  exchange-locked tokens, and domain names with step-by-step instructions
- **Transfers Manifold creator contract ownership** to your clean wallet
- **Rescues Emblem Vaults** (V2 + Legacy) with vault contents inspection
  and gas-free ownership proof signing for profile migration
- **Rescues Fractal Visions NFTs** across Soneium, Shape, Superseed, and Unichain
  via native Blockscout integrations — chains conventional scanners don't reach
- **Transfers Fractal Visions collection ownership** from a compromised creator
  wallet across all seven Fractal Visions chains via the Launchpad registry
- **Consolidates large multi-wallet portfolios** with Mark V — a fleet-scale
  extraction tool for operators managing 5 to 50 clean wallets simultaneously.
  One operation. Every chain. No one left behind.
- **Cleans up** with a burn button that wipes your keys from memory the
  moment you're done

---

## What Rescue Lifeboat Does NOT Do

- It does not take a percentage of your assets
- It does not custody your funds at any point
- It does not send your private key anywhere — keys are processed locally
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

If you skip this step, Rescue Lifeboat will only find your Ethereum NFTs.

> **Note for Fractal Visions users:** NFTs on Soneium, Shape, Superseed, and
> Unichain are found through a separate Blockscout scan in the Fractal Visions
> tab — no Alchemy key required for those chains.

> **Note for Mark V users:** Mark V requires an Alchemy Growth plan or higher.
> The free tier's 25 requests/second limit is hit instantly when scanning a
> fleet of wallets. Upgrade at dashboard.alchemy.com — Pay As You Go requires
> no upfront commitment.

### Step 2.5: First Time on a Mac? Run the System Check First

Before you try `./start.sh` for the first time, run the system checker. It takes 30 seconds, fixes common problems automatically, and tells you exactly what to do if anything needs attention.

```
bash check.sh
```

The most common Mac problem — the wrong Node.js version for your macOS — is invisible until something breaks. The checker knows which version is right for your specific Mac and links you directly to it.

**Windows users:** Same deal — `check.bat` in the same folder. Double-click it before `start.bat` if you're having any trouble.

---

### Step 3: Download Rescue Lifeboat

[![Download ZIP](https://img.shields.io/badge/⬇_Download_ZIP-Click_Here-blue?style=for-the-badge)](https://github.com/KaneMayfield/Rescue-Lifeboat/archive/refs/heads/main.zip)

Click the button above — or click the green **Code** button at the top of this page → **Download ZIP**.

Unzip the folder somewhere easy to find. **Desktop is fine.**

> **Never used GitHub before?** That's okay. You don't need an account. Click Download ZIP, unzip it like any other file, and keep reading.

### Step 4: Run It

- **Windows:** Double-click `start.bat` inside the unzipped folder
- **Mac/Linux:** Open Terminal, navigate to the folder, run `./start.sh`

Your browser will open automatically to `localhost:3000`. If it doesn't, go there manually: **http://localhost:3000**

---

**Windows — "Windows protected your PC" (SmartScreen warning):**
Rescue Lifeboat isn't malicious — it just doesn't have a paid code-signing certificate. Click **More info** → **Run anyway**. If it keeps blocking: right-click `start.bat` → Properties → check the **Unblock** box → Apply.

**Windows — the window opens and immediately closes:**
Something errored but the window closed before you could read it. Open Command Prompt manually (search "cmd" in Start menu), navigate to the folder, and run `start.bat` from there. The error will stay visible. To navigate: type `cd ` (with a space), drag the folder into the Command Prompt window, press Enter.

**Windows — "'npm' is not recognized as an internal or external command":**
Node installed but didn't get added to your PATH. Close all windows, reinstall Node.js from nodejs.org (leave "Add to PATH" checked), **restart your computer** — the restart is not optional, PATH changes don't take effect until you do — then try again.

**Mac — "permission denied" when running ./start.sh:**
The launcher needs to be marked executable first. In Terminal, run:
```
chmod +x start.sh
```
Then run `./start.sh` again.

**Mac — "Abort trap: 6" or "dyld: Symbol not found":**
The Node version you installed is too new for your macOS. See the full macOS troubleshooting section below.

**Mac — never used Terminal before:**
Open Terminal (press ⌘ Space, type "Terminal", press Enter). Type `cd ` (the letters c and d, then a space), then drag the Rescue Lifeboat folder from Finder into the Terminal window — the path pastes automatically. Press Enter. Then type `./start.sh` and press Enter.

**Any platform — "Module not found" or "Cannot find package":**
Run this in the Rescue Lifeboat folder, then try the launcher again:
```
npm install
```

---

![LIFEBOAT Logo](logo.png)

## How to Use It

The tool has three top-level sections: **RESCUE** (the scanner), **LIFEBOAT** (the executor), and **MARK V** (fleet consolidation).

If your wallet is compromised, start with RESCUE and LIFEBOAT. Use MARK V after everything is secure and you want to consolidate multiple clean wallets into one.

---

### RESCUE Tab — Find Your NFTs

This tab finds everything in your compromised wallet. **You don't need your private key for this step.**

1. Enter your **compromised wallet address** — the hacked one (public address, not private key)
2. Enter your **clean destination wallet address** — where NFTs should go
3. Paste your **Alchemy API key**
4. Click **Scan All Chains**
5. Wait for results. Large wallets (200+ NFTs) can take a minute.
6. Review the results. NFTs are grouped by collection. Uncheck anything you don't want to move.
7. When ready, click **Launch Lifeboat**

---

### LIFEBOAT Section — Execute the Rescue

Once you've scanned and selected your NFTs, the LIFEBOAT section is where the rescue actually happens. It has eight tabs:

---

#### Tab 1: NFT RESCUE

This is the main event. You will need private keys here.

**What you need:**
- The **private key of your compromised wallet** (the hacked one)
- The **private key of a funding wallet** — a separate wallet with enough ETH/POL/AVAX to pay for gas

The compromised wallet cannot pay its own gas. That's the whole problem.
The funding wallet sends gas privately via MEV Blocker, then the transfers fire immediately.

**Steps:**
1. Enter both private keys in the fields provided
2. Click **Check Balances** to see what you're working with
3. Review the gas estimate — this is what the funding wallet needs to send
4. Select the chain you want to rescue first (start with Ethereum if in doubt)
5. Click **Execute Rescue**
6. Watch the log. Each transfer shows its transaction hash with an explorer link.
7. When confirmed, switch chains and repeat for Polygon, Base, etc.

**After every rescue:**
- Click the 🔥 **Clear Session** button immediately
- This wipes your keys from memory
- Close the browser tab
- Shut down the local server

---

#### Tab 2: NATIVE SWEEP

Shows native token balances (ETH, POL, AVAX, etc.) across all chains at once.
If there's anything left after the NFT rescue, sweep it here to your clean wallet.

---

#### Tab 3: COIN SWEEP

Scans all chains for ERC-20 tokens — USDC, WETH, DAI, random airdrops, anything
sitting there — and lets you sweep them one by one to your clean wallet.

---

#### Tab 4: QUIET FUND

Sometimes you need gas in your compromised wallet to complete a manual operation
— like an ENS transfer or unstaking a DeFi position — and you can't just send ETH
normally because the bot will drain it in seconds.

Quiet Fund solves this. It sends gas from your funding wallet to your compromised
wallet through MEV Blocker's private relay — the bot doesn't see the deposit until
it's confirmed and your transaction has already fired. Select the chain, enter your
funding wallet key, enter the compromised wallet address, set the amount, and send.

---

#### Tab 5: OTHER ASSETS

NFTs and tokens aren't the only things sitting on a compromised wallet. ENS names,
staked positions, exchange-locked tokens, and domain names all need their own rescue
plays. This tab walks you through each one with a full step-by-step guide.

**ENS Names (.eth)**

An ENS name has three components that all need to move — Owner, Manager, and ETH
Address. Transferring just the NFT only moves the Owner. The Manager and ETH
Address stay pointed at the compromised wallet, which means anyone sending crypto
to your name keeps sending it to the dead wallet. This tab's ENS Send flow handles
all three in the right order, in one signing session, using Quiet Fund to get gas
in privately first.

**DeFi Stakes (Lido, Aave, Compound, NFT staking)**

The unstake transaction has to happen from the compromised wallet, which means that
wallet needs gas. Same choreography as ENS: open the unstake page, get it ready to
sign, use Quiet Fund to send gas privately, then immediately sign the unstake. Once
assets are back in the wallet, rescue them with the normal NFT Rescue or Coin Sweep
flow. Watch for cooldown periods — Lido is roughly 1–5 days. Plan accordingly.

**Centralized Exchanges (Coinbase, Binance, Kraken, etc.)**

If only your wallet was compromised (not your email or 2FA), your exchange assets
are fine — they're in your exchange account, not on your wallet. Log into the
exchange and withdraw directly to your clean wallet address. No Rescue Lifeboat needed.

If your email or 2FA was also compromised, contact the exchange's support immediately.
Most have account recovery and freeze procedures.

**Other Domain Names**

- **.crypto, .nft, .x (Unstoppable Domains):** NFTs on Polygon — LIFEBOAT scans Polygon, rescue with the normal flow
- **.base names:** NFTs on Base — same as above
- **.sol names (Solana/Bonfida):** Solana is not supported. Requires a separate Solana rescue tool.

---

#### Tab 6: MANIFOLD

If you have a Manifold creator contract connected to your compromised wallet,
this tab transfers ownership to your clean wallet. This is a separate operation
from rescuing NFTs — your contract is a different kind of asset and needs its
own transfer.

---

#### Tab 7: EMBLEM VAULT

Rescues Emblem Vault NFTs (both V2 and Legacy contracts) from your compromised
wallet via MEV Blocker. Three sub-sections:

**Scan & Rescue** — Scans your compromised wallet for Emblem Vault tokens on both
the V2 contract (`0x82C7a8f7...`) and Legacy contract (`0x6Fc355D4...`). Shows vault
name, image, and contained assets (BTC, DOGE, rare pepes, etc.) for each vault found.
Select which vaults to rescue, enter your keys, and execute the transfer through
MEV Blocker — same proven pattern as the NFT Rescue tab.

**Vault Inspector** — Look up any Emblem Vault by token ID to see its name, image,
contained assets, and full metadata. Read-only — no keys needed.

**Ownership Proof** — Generates a cryptographic signature proving you own a vault.
This costs zero gas and is completely invisible to the sweeper bot. Use it to prove
wallet ownership to Emblem support for profile migration without revealing your
private key.

---

#### Tab 8: FRACTAL VISIONS

A dedicated rescue suite for the Fractal Visions NFT ecosystem. Fractal Visions
operates across a constellation of Superchain networks that conventional rescue
tools don't reach. This tab was built specifically for that ecosystem — with native
integrations for each chain, sourced directly from the explorers that index them.

**Why it exists separately:** The standard NFT scanner uses Alchemy, which covers
Ethereum, Polygon, Base, Optimism, and Avalanche. Fractal Visions' Superchain
deployments live on Soneium, Shape, Superseed, and Unichain — networks Alchemy
doesn't index. To reach them, Rescue Lifeboat uses each chain's native Blockscout
explorer API directly. Different source. Same result. Nothing falls through the floor.

**Collector Rescue** — Scans all four Superchains simultaneously using Blockscout's
live indexed data. No API key required. Surfaces every Fractal Visions NFT in the
compromised wallet with images and collection details, then executes the rescue
chain by chain using the same proven transfer engine.

**Creator Rescue** — If your compromised wallet is a Fractal Visions creator, this
section reads the Launchpad registry directly to find every collection contract tied
to your address across all seven Fractal Visions chains. The Launchpad uses a
deterministic deployment pattern — the same contract address on every chain — so
one scan finds everything. Transfers collection ownership cleanly to your safe wallet
by calling `transferOwnership()` on each contract directly.

---

### MARK V — Massive Tactical Extraction

![Mark V](markvlogo.png)

**Mark V is for clean wallet consolidation — not emergency rescue.**

If any of your wallets is compromised, use RESCUE and LIFEBOAT first. Come to Mark V when everything is clear.

The typical Mark V operator has 5 to 50 wallets accumulated over years of collecting. They're not in crisis — they're reorganizing. Moving everything into one secure wallet after getting a hardware wallet. Consolidating a portfolio that has grown across dozens of addresses on a dozen chains. The standard rescue tools work one wallet at a time. Mark V works on the entire fleet simultaneously.

> *"The Mark V Special Operations Craft is the U.S. Navy SEALs' primary high-speed insertion and extraction vessel. 82 feet long. Twin MTU diesel engines. 35-knot top speed. Designed for one mission: moving a large team of operators into and out of hostile territory simultaneously, at maximum speed. The name is not aesthetic. It is a description."*

![Mark V in action](MarkVbackground.png)

**⚠ CLEAN WALLETS ONLY.** Mark V sends gas to multiple wallets simultaneously. If any wallet in your fleet is compromised, a sweeper bot will drain that gas the moment it arrives — before the transfer queue reaches it. Run standard Rescue Lifeboat on any compromised wallet first, then return to Mark V for consolidation.

**Alchemy Growth plan required.** Mark V fires up to 250 simultaneous API calls for a full 50-wallet fleet scan. The free Alchemy tier (25 req/sec) rate-limits instantly. Upgrade at [dashboard.alchemy.com](https://dashboard.alchemy.com) — Pay As You Go charges only what you use, requires no upfront commitment, and the actual API cost per fleet operation is typically under $0.15.

---

**Fleet Scan** — Load up to 50 wallet addresses with nicknames. One Alchemy key covers the entire fleet. All wallets scan simultaneously across ETH, Polygon, Base, Optimism, and Avalanche. The built-in Gas Calculator pulls live gwei from Alchemy and estimates your total operation cost so you can decide whether today is the right day to execute.

**Fleet Execute** — Enter private keys for each wallet. One funding wallet covers gas for the entire fleet across every chain. Check balances, review the per-chain gas estimate, confirm, and fire. All wallets execute in parallel — Wallet 1 and Wallet 47 are moving at the same time. Progress streams live to the Fleet Status tab via real-time connection so nothing times out regardless of how long the operation takes.

**Fleet Status** — Live operation log with per-wallet status indicators (SCANNING / FUNDING / TRANSFERRING / COMPLETE / ERROR). Post-operation summary table shows every wallet, its final status, confirmed count, and any error reason in plain English. When the fleet is clear, the mission complete screen shows total wallets cleared, assets moved, and gas spent. Full CSV export. The 🔥 Clear Session button wipes every key from memory.

**Fleet Tokens** — After NFT extraction, scan all fleet wallets simultaneously for ERC-20 tokens — USDC, WETH, community coins, airdrops, everything. Per-wallet, per-token sweep buttons. Keys entered in Fleet Execute carry over automatically.

**Fleet Native** — After tokens are swept, check remaining native balances across the entire fleet and sweep the dust back to your funding wallet. Run this last — sweeping native balance before transfers complete leaves wallets without gas.

**Emblem Vaults** — Two operations available. Bulk Transfer moves Emblem Vault NFTs (the EVM wrapper token) from multiple wallets to a destination in one fleet operation. Unvault opens each vault and extracts the contained XCP/Bitcoin assets directly to a native Counterparty wallet — the full Torus key derivation flow runs locally with no browser, no OAuth, and no third-party dependency beyond your Alchemy key.

![Mark V Operations](markvalt.png)

---

https://github.com/user-attachments/assets/aa12d7f5-e2cd-4769-8a71-a478da1b3b35

---

## Troubleshooting

### Can't Launch the Tool? (Install Errors)

These errors stop you before the tool even opens. Find your error message below.

#### MAC: "Abort trap: 6" or "dyld: Symbol not found" or "built for Mac OS X 13.5"

The Node.js you installed is too new for your version of macOS. The current Node LTS requires macOS Ventura 13.5 or newer. Older Macs need an older version of Node.

**Fix:**

1. Find out your macOS version: Apple logo → "About This Mac" → look at the version (Big Sur, Monterey, Ventura, etc.)

2. Uninstall the broken Node. In Terminal:
   ```
   sudo rm /usr/local/bin/node /usr/local/bin/npm
   ```
   Enter your Mac password. You won't see anything happen — that's normal.

3. Download the right Node version:

   | Your macOS | Use this Node version | Direct download |
   |------------|----------------------|-----------------|
   | Sonoma 14 / Sequoia 15 / Ventura 13.5+ | Latest LTS | [nodejs.org](https://nodejs.org) |
   | Ventura 13.0–13.4 / Monterey 12 | Node 20 LTS | [nodejs.org/en/blog/release/v20.18.1](https://nodejs.org/en/blog/release/v20.18.1) |
   | Big Sur 11 / Catalina 10.15 | Node 18 (EOL but works) | [v18.20.8.pkg](https://nodejs.org/dist/v18.20.8/node-v18.20.8.pkg) |
   | Mojave 10.14 or older | Node 16 or older | [Previous Releases](https://nodejs.org/en/download/releases) |

4. Run Rescue Lifeboat again with `./start.sh`.

> Note: Node 18 is "end-of-life" (no more security patches) but works fine for Rescue Lifeboat because the tool runs locally for a brief rescue session — it's not a production server.

#### MAC: "permission denied" when running ./start.sh

The launcher isn't marked executable yet (common quirk of Mac-unzipped files). Fix:
```
chmod +x start.sh
```
Then run `./start.sh` again.

#### MAC: "no such file or directory" when running ./start.sh

You're not in the Rescue Lifeboat folder. Type `cd ` in Terminal (the letters c-d followed by a SPACE — the space matters), then drag the folder from Finder into the Terminal window. Press Enter. Try `./start.sh` again.

#### WINDOWS: "Windows protected your PC" / SmartScreen blocks start.bat

Windows blocks unsigned scripts from the internet by default. Rescue Lifeboat isn't malicious — it just doesn't have a paid code-signing certificate.

**Quick fix:** Click **More info** on the SmartScreen warning, then **Run anyway**.

**Permanent fix** (if it keeps blocking):
1. Right-click `start.bat` → Properties
2. Check the **Unblock** box at the bottom of the General tab
3. Click Apply, OK
4. Double-click `start.bat` again

#### WINDOWS: "'npm' is not recognized as an internal or external command"

Node installed but didn't get added to your PATH.

**Fix:**
1. Close all Command Prompt / PowerShell windows
2. Reinstall Node.js from [nodejs.org](https://nodejs.org) — leave the "Add to PATH" option checked
3. **Restart your computer** (this step is often skipped — PATH changes only take effect for new sessions)
4. Try `start.bat` again

#### WINDOWS: start.bat opens and immediately closes

Something errored, but the window closed before you could read it.

**Fix:** Open Command Prompt manually (search "cmd" in Start), navigate to the Rescue Lifeboat folder, and run `start.bat` from there. Errors will stay visible.

To navigate: type `cd ` (with a space), drag the folder into the Command Prompt window, press Enter.

#### BOTH: "node: command not found" / Node doesn't seem installed

In Terminal/Command Prompt, type `node --version`. If you see a version number, Node IS installed and your problem is elsewhere. If you see "command not found," install from [nodejs.org](https://nodejs.org), then **close and reopen** your terminal before trying again.

---

### Tool-Running Errors

**"Module not found" or "Cannot find package"**
Run `npm install` in the Rescue Lifeboat folder. This downloads the required packages.

**Browser doesn't open**
Go to http://localhost:3000 manually.

**Scan finds no NFTs**
- Check that the wallet address is correct
- Make sure your Alchemy API key is valid
- Verify you enabled all chains in your Alchemy dashboard (not just Ethereum)

**Only Ethereum NFTs appear**
Your Alchemy key is only set up for Ethereum by default. Go to your Alchemy
dashboard → your app → Networks → enable Polygon, Base, Optimism, Avalanche.

**"Insufficient funds"**
The funding wallet needs more ETH/POL/AVAX than the gas estimate shows.
Add funds to the funding wallet and try again.

**Transaction failed or stuck**
- Check the explorer link for details
- Some contracts have transfer restrictions Rescue Lifeboat can't override
- The rescue data is preserved — you can retry individual tokens

**ENS name didn't transfer**
ENS names require a manual transfer via app.ens.domains. Use the **Quiet Fund**
tab to get gas into your compromised wallet privately, then complete the transfer
manually before the bot can react. See the **Other Assets** tab for the full
step-by-step.

**Mark V scan returns empty / rate limit errors**
Your Alchemy key is on the free tier (25 req/sec). Mark V requires a Growth plan
or higher. Upgrade at [dashboard.alchemy.com](https://dashboard.alchemy.com).

---

## Supported Chains

| Chain       | MEV Protected | Native Token | Status       | Scanner      |
|-------------|---------------|--------------|--------------|--------------|
| Ethereum    | ✅ Yes        | ETH          | Tested       | Alchemy      |
| Polygon     | No            | POL          | Tested       | Alchemy      |
| Base        | No            | ETH          | Tested       | Alchemy      |
| Optimism    | No            | ETH          | Configured   | Alchemy      |
| Avalanche   | No            | AVAX         | Configured   | Alchemy      |
| Soneium     | No            | ETH          | Configured   | Blockscout   |
| Shape       | No            | ETH          | Configured   | Blockscout   |
| Superseed   | No            | ETH          | Configured   | Blockscout   |
| Unichain    | No            | ETH          | Configured   | Blockscout   |

MEV protection (via MEV Blocker) hides your transactions from the public
mempool. This is what prevents sweeper bots from seeing your moves on
Ethereum. Other chains don't have the same MEV infrastructure, but sweeper
bots are also less common there.

The four Blockscout chains (Soneium, Shape, Superseed, Unichain) are scanned
via the Fractal Visions tab using each chain's native explorer API. No Alchemy
key required for those chains.

---

## Files in This Repository

```
Rescue-Lifeboat/
├── start.bat             # Windows launcher (double-click this)
├── start.sh              # Mac/Linux launcher
├── server.js             # Local Express server
├── engine.js             # Blockchain operations (the real engine)
├── markv-engine.js       # Mark V fleet execution engine
├── markv-server.js       # Mark V API routes
├── emblem-engine.js      # Emblem Vault rescue engine
├── emblem-server.js      # Emblem Vault API routes
├── index.html            # The interface
├── package.json          # Dependencies
├── test-emblem.js        # Automated test suite
├── README.md             # You're reading it
├── LICENSE               # MIT License
├── DISCLAIMER.md         # Legal stuff, human-readable
├── SECURITY.md           # How keys are handled
└── CONTRIBUTING.md       # For developers who want to help
```

---

![LIFEBOAT in action](radar.jpg)

## Testing

Run the automated test suite from the Rescue Lifeboat folder:

```
node test-emblem.js
```

Tests run against the live Alchemy API and verify scanning, ownership proof
signing, error handling, and return shapes. No private keys needed.

Tests also run automatically on every push via GitHub Actions.

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



https://kanemayfield.com/llms.txt

