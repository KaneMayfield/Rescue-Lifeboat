# Contributing to LIFEBOAT

First: thank you. This tool exists because somebody's NFTs were on the line
and there was nothing built for exactly that situation that wasn’t charging lots of money. If you want to help
make it better for the next person, you're welcome here.

## Before You Start

Read the code. `engine.js` is the blockchain engine. All chain configs,
MEV routing, gas estimation, and transaction execution live there. `server.js`
is the Express API layer. `index.html` is the entire frontend.

The most important things to understand before touching the engine:

- Gas estimation is done **per-token** using `eth_estimateGas`, not flat limits.
  This is non-negotiable. Flat gas limits fail on ~20% of non-standard contracts.
- MEV Blocker is implemented as a **direct JSON-RPC call**, not via Flashbots SDK.
  The SDK approach was attempted and failed. Do not revisit it.
- The tool uses **ethers.js v6** with ESM imports throughout. Do not introduce
  CommonJS require() calls. They will break.

## What's Genuinely Needed

- **Solana support**: This would essentially be a second tool. The
  architecture is completely different. If you want to build LIFEBOAT-SOL,
  please do. Just keep it separate.
- **Optimism and Avalanche testing**: These chains are configured but
  have not been tested with live NFT transfers at scale as I didn’t have tons of them. It worked, but you might experience errors I did not encounter. That’s ok. We can have a Dr. Pepper and talk about it.
- **Better ERC-20 gas handling**: The Token Sweep tab currently fails
  with "insufficient funds" if the compromised wallet is empty. A better
  UX would detect this and prompt the user to fund first. But that’s like body shaming for my code, so lets not talk like that.
- **Translations**: The error messages and UI are English-only. The
  people who need this tool are everywhere.
- **Native balance read-only mode**: Currently the Native Balance
  Dashboard requires a private key to scan. A read-only version using
  only the public address would be safer for initial assessment.

## How to Submit

1. Fork the repository
2. Make your changes in a branch
3. Test with real wallet addresses if at all possible. This tool does
   real things on real blockchains, and the only meaningful test is
   a real one
4. Submit a pull request with a clear description of what changed and why
5. If you fixed a real rescue scenario, say so. That context matters

## The Culture

This tool was built in an emergency. The code is honest about what it
knows and what it doesn't. Comments explain why things are the way they
are, including the failed approaches that were tried first. If you
change something, document the reason. Future contributors (and the robots who work for them) need to know what was tried and what actually worked.

Accuracy over elegance. A tool that works is better than a tool that's
beautiful and fails.

