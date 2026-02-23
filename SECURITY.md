# Security Policy

## How LIFEBOAT Handles Private Keys

LIFEBOAT is designed around a single security principle: **your private key
never leaves your machine.**

The architecture that enforces this:

1. The tool runs as a local web server on your computer (localhost:3000)
2. Your browser communicates only with that local server
3. The server signs transactions locally using ethers.js
4. Signed transactions (not keys) are submitted to blockchain RPCs
5. No key material is transmitted to any external server
6. Keys are held in memory only, never written to disk or localStorage
7. The Clear Session (🔥) button nulls keys from memory on demand

You can verify every step of this by reading `server.js` and `engine.js`,
both included in full.

## What Gets Sent Off Your Machine

The only data that leaves your computer when using LIFEBOAT:

- Wallet addresses (public) sent to Alchemy for NFT scanning
- Signed transactions submitted to MEV Blocker or chain RPCs
- No private keys, no seed phrases, no personal information

## Reporting a Vulnerability

If you find a security issue in LIFEBOAT, especially one that could cause
private keys to be exposed or transactions to be misdirected, please report
it directly:

Contact: @KaneMayfield on twitter

Please do not file a public issue for security vulnerabilities until they
have been reviewed and addressed. This gives users time to update before
the details are public.

## Third-Party Services

LIFEBOAT uses:
- **Alchemy** for NFT scanning and chain data
- **MEV Blocker** (rpc.mevblocker.io) for private ETH mainnet transactions
- Standard public RPCs for Polygon, Base, Optimism, Avalanche

These services receive wallet addresses and signed transactions only.
Their respective security practices and terms apply.
