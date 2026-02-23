# LIFEBOAT V10 — NFT Rescue Tool

**Save your NFTs from a compromised wallet.**

Built by [Kane Mayfield](https://kanemayfield.com) after his own wallet was hacked. Tested on 411 NFTs across ETH mainnet, Polygon, and Base.

---

## What This Does

Your wallet got compromised. There's probably a sweeper bot watching it 24/7, ready to steal any ETH the moment it arrives. But the bot doesn't care about your NFTs — they're still there.

This tool:
1. **Scans** your compromised wallet for NFTs across all chains
2. **Transfers** them to your clean wallet using private transactions
3. **Hides** everything from the bot using MEV Blocker

The bot never sees you coming.

---

## Quick Start (3 Steps)

### Step 1: Install Node.js
Download from [nodejs.org](https://nodejs.org) — get the LTS version. Install it like any normal program.

### Step 2: Get an Alchemy API Key
Free, takes 90 seconds:
1. Go to [dashboard.alchemy.com](https://dashboard.alchemy.com)
2. Create account (no credit card needed)
3. Create an app (any name)
4. Copy the API key

**Important — Enable All Chains:**
By default Alchemy only activates Ethereum. To scan Polygon, Base, and other chains:
1. In your Alchemy dashboard, click your app
2. Go to **Networks** (or Configuration)
3. Enable: **Polygon, Base, Optimism, Avalanche**
4. Save — same API key works for all chains

### Step 3: Run the Tool
- **Windows:** Double-click `start.bat`
- **Mac/Linux:** Open terminal in this folder, run `./start.sh`

Your browser will open automatically to `localhost:3000`.

---

## How to Use

### RESCUE Tab (Scan)
1. Enter your **compromised wallet** address (the hacked one)
2. Enter your **clean wallet** address (where NFTs will go)
3. Paste your **Alchemy API key**
4. Click **Scan All Chains**
5. Review your NFTs — uncheck any you don't want to move
6. Click **Launch Lifeboat**

### LIFEBOAT Tab (Execute)
1. Enter your **compromised wallet private key** (the hacked wallet)
2. Enter your **funding wallet private key** (has ETH for gas)
3. Click **Check Balances** to verify
4. Select the **chain** you want to rescue first
5. Review the **gas estimate**
6. Click **Execute Rescue**

The tool will:
- Send gas funds privately to your compromised wallet
- Fire all NFT transfers privately (bot can't see them)
- Confirm each transfer on-chain

### After the Rescue
- **Delete your private keys** from this tool immediately (click 🔥 Clear Session)
- **Never use the compromised wallet again** — it's permanently burned
- Consider a hardware wallet for your new collection

---

## Security

**Your private keys never leave your computer.**

- The tool runs 100% locally on your machine
- Keys are held in memory only — never saved to disk
- The only network requests go to blockchain RPCs
- Click 🔥 Clear Session when done to wipe keys from memory

**MEV Protection (Ethereum mainnet):**
Transactions are routed through MEV Blocker, a private RPC that hides your transactions from the public mempool. The sweeper bot cannot see the gas funding or the NFT transfers until they're already confirmed in a block.

---

## Troubleshooting

### "Module not found" or "Cannot find package"
Run `npm install` in the LIFEBOAT-V10 folder.

### Browser doesn't open
Go to [localhost:3000](http://localhost:3000) manually.

### Scan finds no NFTs
- Double-check the wallet address
- Make sure your Alchemy key is valid
- Some NFTs on unusual contracts may not appear

### Scan only shows Ethereum NFTs
Your Alchemy key needs each chain enabled separately. Go to your Alchemy dashboard → your app → Networks → enable Polygon, Base, Optimism, Avalanche. Same key, just flip the toggles.

### "Insufficient funds"
Your funding wallet needs enough ETH/POL/etc. to cover gas. The Gas Estimate card shows exactly how much.

### Transaction stuck or failed
- Check the explorer (Etherscan, Polygonscan, etc.)
- The rescue data is preserved — you can retry
- Some tokens may have transfer restrictions

---

## Supported Chains

| Chain | MEV Protected | Native Token |
|-------|---------------|--------------|
| Ethereum | ✅ Yes | ETH |
| Polygon | No | POL |
| Base | No | ETH |
| Optimism | No | ETH |
| Avalanche | No | AVAX |

---

## Files in This Folder

```
LIFEBOAT-V10/
├── start.bat          # Windows launcher (double-click)
├── start.sh           # Mac/Linux launcher
├── server.js          # Local web server
├── engine.js          # Blockchain operations
├── package.json       # Dependencies
├── public/
│   └── index.html     # The interface
└── README.md          # You're reading it
```

---

## Credits

Built by **Kane Mayfield** — artist, developer, your neighbor.

- Website: [kanemayfield.com](https://kanemayfield.com)
- Twitter: [@kanemayfield](https://twitter.com/kanemayfield)
- Buy me a coffee: [cash.app/$Kanemayfield](https://cash.app/$Kanemayfield)

This tool exists because when Kane's wallet got hacked at 2am, every "whitehat" service wanted thousands of dollars to even look at the problem. So he built what he wished had existed, tested it on himself, and is now giving it away.

**Free. No catch. No percentage. Just help.**

---

## License

MIT — Do whatever you want with it. Help people.
