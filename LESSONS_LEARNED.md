# Lessons Learned

### What We Tried, What Failed, and Why We Don't Do It That Way

---

This tool was built in 18 hours during an actual wallet compromise. February 16, 2026. Sweeper bot watching the wallet. 413 NFTs trapped behind a glass wall. No sleep. Real stakes.

Some of what's in this document will seem obvious. It wasn't obvious at 3am when the fifth approach failed and the bot was still sitting there waiting.

If you're thinking about opening a PR that suggests something in here — read this first. We probably tried it. If we didn't, and you've got something better, we want to hear it. But if it's in here, it's in here because we already bled on that rock.

---

## The Known Failure Registry

This is the table. These are the things that did not work. Do not revisit them without a compelling new reason.

| What Failed | Why | Use Instead |
|-------------|-----|-------------|
| Flashbots SDK bundle submission | Relay rejects bundles with 200+ transactions. Success rate was maybe 1 in 5. When you're racing a sweeper bot, "maybe" isn't good enough. | MEV Blocker direct RPC at `rpc.mevblocker.io` |
| `@flashbots/ethers-provider-bundle@^0.6.3` | Version doesn't exist on npm. Hours lost to this. | ethers@6 + MEV Blocker direct RPC |
| ethers@5 + flashbots@1.0.0 | Version conflict. Dependency hell. | Use ethers@6 exclusively |
| Flat gas limits (100k/150k) | Non-standard contracts need more. ~20% of transfers failed with flat limits. | Per-token `eth_estimateGas` with buffer |
| `estimateGas` from empty wallet | Node rejects simulation when wallet has zero balance | Flat fallback (150k/200k) during estimation phase only. Re-estimate at execution when wallet is funded. |
| `polygon-rpc.com` | 401 Unauthorized. Just doesn't work. | Alchemy Polygon or `1rpc.io/matic` |
| Browser-based MEV Blocker calls | CORS policy. Blocked by design. MEV Blocker does not accept requests from browser origins. | Node.js local server. No CORS restrictions. |
| `rescue.flashbots.net` | Site was down when we needed it. The existing solution wasn't there. | Build your own tooling. That's why this exists. |
| `safeTransferFrom` on ENS (0x57f1887a) | ENS registrar rejects standard NFT transfer. Reverts every time. | Skip ENS in the tool, direct user to `app.ens.domains` |
| `address payable[]` in ethers v6 ABI | ethers v6 rejects `payable` and `calldata` keywords in ABI strings | Use `address[]` only. Strip keywords. |
| CommonJS `require()` in engine.js | ESM/CJS conflict with `type: module` in package.json | ESM `import` throughout. Use `.cjs` extension if you absolutely need CommonJS. |
| Arweave-hosted HTML with browser execution | CORS + key security + MEV Blocker conflict. Triple failure. | Downloadable folder with local server. Settled. |
| Standalone HTML+JS split (pre-V10) | Two separate files. User has to understand which one does what. Clunky UX for someone in crisis. | Unified local web server. One window, one experience. |
| Large index.html chunked writes | File corruption during multi-part creation. CSS renders as raw text because the `<!DOCTYPE html>` got chopped off. | Build from known-good base. Verify DOCTYPE exists. Check file integrity before shipping. |

---

## The Beautiful Car With No Engine

There was a moment during the build where we had a gorgeous V8 interface. Looked incredible. Professional. The kind of thing you'd be proud to show someone.

It did nothing.

The blockchain calls were stubbed. The buttons were wired to console.log. It was a beautiful car with no engine.

Meanwhile, the ugly Node.js script running in a terminal window — no UI, just text output — had already rescued 115 NFTs on Ethereum mainnet.

V10 exists because we needed both: the engine that actually works AND an interface that doesn't make someone in crisis feel like they need a computer science degree. The local web server architecture is the answer. Node.js handles blockchain. The browser handles humans.

---

## Chain-Specific Learnings

### Polygon requires 30 gwei minimum priority fee

The RPC nodes reject transactions with priority fees below ~25 gwei. The documentation doesn't make this obvious. We found out when transfers started failing with unhelpful error messages.

LIFEBOAT hardcodes a 30 gwei floor for Polygon. It's higher than you'd set manually, but it guarantees your transactions don't get rejected at the RPC level.

### MEV Blocker doesn't respond to `eth_chainId`

Standard practice: when you connect to an RPC, you call `eth_chainId` to confirm you're on the right network. MEV Blocker doesn't respond to this probe. ethers.js interprets silence as "failed to detect network" and enters a retry loop. Your app hangs.

The fix:

```javascript
// Wrong — causes retry loops
new ethers.JsonRpcProvider('https://rpc.mevblocker.io')

// Right — works immediately  
new ethers.JsonRpcProvider(
  'https://rpc.mevblocker.io',
  { chainId: 1, name: 'Ethereum Mainnet' },
  { staticNetwork: true }
)
```

Pass the chain ID statically. Don't ask MEV Blocker what network it is — tell ethers.js what network to expect.

### Empty wallet gas estimation

If a wallet has no ETH, `eth_estimateGas` can return 0 or fail entirely. This doesn't mean the transfer is free — it means the estimation couldn't run without funds to simulate against.

LIFEBOAT falls back to conservative flat estimates (150k for ERC-721, 200k for ERC-1155) when estimation fails on an empty wallet. These are high enough to cover most contracts. Once the wallet is funded at execution time, we re-estimate with real numbers.

---

## The Decision Tree

These questions came up during the build. They're answered. Don't re-open them without new information.

**Q: Should we use Flashbots SDK?**  
A: No. MEV Blocker direct RPC. See failure registry.

**Q: Should LIFEBOAT run in the browser?**  
A: No. CORS prevents MEV Blocker calls from browser contexts. The local web server solves this.

**Q: Should we use flat gas limits?**  
A: No. Per-token `estimateGas` is required. ~20% failure rate otherwise.

**Q: Should we attempt to move ENS via safeTransferFrom?**  
A: No. ENS registrar rejects it. Detect, skip, log, direct user to `app.ens.domains`.

**Q: ethers v5 or v6?**  
A: v6. Always. `import { ethers } from "ethers"`. Package: `ethers@6`.

**Q: Can users set gas below recommended?**  
A: No. Floor is 1.1x. This is not a democracy.

**Q: Should we add Solana support?**  
A: Not in V10. Completely different architecture. Future consideration, probably as a separate tool.

**Q: Dark mode / light mode toggle?**  
A: No. Keep it dark. Emergency tool, not a settings playground.

---

## The Cultural Stuff

These phrases came out of the build. They're preserved because they're true.

**"Resonance over recursion"**  
Don't loop. When a decision is made, it's made. Move forward. If you're going in circles, stop and check the decision tree.

**"This is not a democracy"**  
Gas floors exist for a reason. Users can't negotiate themselves into failure. The tool knows better than the panic.

**"The blockchain doesn't lie"**  
When the script said 60 confirmations and Etherscan said 115, Etherscan was right. The chain is the source of truth. The script can misreport. The chain cannot.

**"Your lifeboats have reached safety"**  
The completion message. After the terror, after the waiting, after the confirmations — this is the exhale.

---

## What We Deliberately Didn't Build

### Automatic retry logic

If a transaction fails, LIFEBOAT tells you. It doesn't automatically retry. This is intentional.

Automatic retries can:
- Burn gas on hopeless transactions
- Confuse the user about what's happening  
- Create race conditions with the sweeper bot

When something fails, you should stop, look at the explorer, understand what happened, and decide what to do next. LIFEBOAT preserves your rescue data so you can retry manually.

### Price estimates / floor prices

LIFEBOAT doesn't tell you what your NFTs are worth. It doesn't query marketplaces.

In a rescue scenario, this information is noise. You're not deciding what to rescue based on floor price — you're deciding based on what matters to you. The POAP from a friend's wedding doesn't have a floor price. It's priceless.

### Solana

Different architecture entirely. Different wallet format, different RPC, different transaction model, no ethers.js. It would essentially be a second tool wearing the same name. If someone wants to build LIFEBOAT-SOL, please do. Keep it separate.

### Unit Tests

LIFEBOAT doesn't have a traditional test suite. This is deliberate.

Almost every function in `engine.js` touches live blockchain infrastructure — Alchemy APIs, MEV Blocker RPC, chain providers. To unit test these, you'd need to mock all of it. And mocks lie. They return whatever you told them to return, which means they encode your assumptions about how external systems behave. The bugs that actually bit us — Polygon's 30 gwei floor, MEV Blocker ignoring `eth_chainId`, per-token gas variance — none of those would have been caught by mocks, because we didn't know to mock them until they failed live.

The test suite that matters already exists: 413 NFTs rescued under hostile conditions, with active sweeper bots and unpredictable RPC behavior. That's not a metaphor. That's the validation.

If someone wants to build integration tests against a public testnet, that conversation is welcome. But a unit test suite that gives green checkmarks while lying about reality is worse than no tests at all.

---

## If You Read This Far

You understand the project better than most people who will ever touch it.

The goal is a tool that works under pressure for people who aren't developers. Someone who just got hacked, hasn't slept, is watching their stuff through a glass wall. That person doesn't know what a nonce is. They don't care about your elegant architecture. They need their things back.

Everything else is negotiable.

---

*If you're reading this because your wallet just got hacked: stop. Go to the README. Run the tool. This document is for later, when you're safe and you want to understand how the thing that saved you actually works.*

— Kane Mayfield  
kanemayfield.com  
February 2026
