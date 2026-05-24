/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  MARK V — Massive Tactical Extraction Engine                     ║
 * ║  Fleet-scale multi-wallet NFT consolidation                      ║
 * ║  Clean wallets only — no MEV protection needed or used           ║
 * ║  by Kane Mayfield · kanemayfield.com                            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ARCHITECTURE DECISIONS (from constitution):
 *   - No MEV Blocker: Mark V is clean wallets only. No sweeper bot risk.
 *   - Parallel across wallets: independent nonce counters per wallet.
 *   - Sequential within each wallet: nonce-ordered transfers.
 *   - Queue manager: global concurrent API cap (~20) to prevent 429s.
 *   - Nibble approach: batched execution per wallet to prevent timeouts.
 *   - Alchemy Growth plan required: stated in UI, enforced by reality.
 */

import { ethers } from 'ethers';
import { scanEmblemVaults, executeEmblemRescue } from './emblem-engine.js';

// ── RE-EXPORT CHAINS FROM ENGINE ───────────────────────────────────────────────
// Mark V uses the same chain config as engine.js. Import what we need.
import { CHAINS, validateAddress, validatePrivateKey } from './engine.js';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const MAX_CONCURRENT_CALLS = 20;   // Global Alchemy API concurrency cap
const BATCH_SIZE = 5;              // Transfers per wallet before rate-limit pause
const BATCH_PAUSE_MS = 1000;       // Pause between batches (ms)
const RATE_LIMIT_PAUSE_MS = 3000;  // Extended pause on 429 error
const CONFIRMATION_TIMEOUT_MS = 120000; // 2 min per tx
const MAX_WALLETS = 50;

const GAS_TIERS = {
  recommended: 1.1,
  safe: 1.25,
  maximum: 1.5,
};

// ── ABI FRAGMENTS ──────────────────────────────────────────────────────────────
const ERC721_ABI = [
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

const ERC1155_ABI = [
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

// ── HELPERS ────────────────────────────────────────────────────────────────────

/**
 * getProvider — matches engine.js pattern exactly.
 * staticNetwork: true on all providers, no exceptions.
 * Mark V uses standard RPC (not MEV Blocker) on all chains.
 */
function getProvider(chainKey, alchemyKey) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  let rpc = chain.rpc;
  // Mark V always uses standard Alchemy RPC, even for ETH mainnet —
  // no MEV Blocker because these are clean wallets with no sweeper risk.
  if (chainKey === 'eth') {
    rpc = alchemyKey
      ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://cloudflare-eth.com'; // fallback if no key (shouldn't happen)
  }
  if (chainKey === 'polygon' && alchemyKey) {
    rpc = `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }

  return new ethers.JsonRpcProvider(
    rpc,
    null,
    { staticNetwork: ethers.Network.from(chain.chainId) }
  );
}

/**
 * Concurrency queue — prevents slamming Alchemy with 250 simultaneous calls.
 * Allows up to MAX_CONCURRENT_CALLS at once; queues the rest.
 */
function createQueue(concurrency = MAX_CONCURRENT_CALLS) {
  let active = 0;
  const waiting = [];

  function run(fn) {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        active++;
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          active--;
          if (waiting.length > 0) waiting.shift()();
        }
      };
      if (active < concurrency) {
        execute();
      } else {
        waiting.push(execute);
      }
    });
  }

  return { run };
}

// ── FLEET SCAN ─────────────────────────────────────────────────────────────────
/**
 * scanFleet(wallets, destination, alchemyKey)
 *
 * Scans up to 50 wallets across all 5 Alchemy chains simultaneously.
 * Uses the same Alchemy NFT API v3 pattern as engine.js scanAllChains,
 * but runs across the entire fleet in parallel — all wallets, all chains
 * at the same time, throttled by the queue manager.
 *
 * Returns aggregated results keyed by wallet address (lowercase).
 */
export async function scanFleet(wallets, destination, alchemyKey) {
  if (!alchemyKey) throw new Error('Alchemy API key required');
  if (!wallets || wallets.length === 0) throw new Error('No wallets provided');
  if (wallets.length > MAX_WALLETS) throw new Error(`Maximum ${MAX_WALLETS} wallets per operation`);

  const validDest = validateAddress(destination);
  if (!validDest) throw new Error('Invalid destination address');

  const queue = createQueue(MAX_CONCURRENT_CALLS);

  const chainConfigs = [
    { key: 'eth-mainnet',     label: 'eth' },
    { key: 'polygon-mainnet', label: 'polygon' },
    { key: 'base-mainnet',    label: 'base' },
    { key: 'opt-mainnet',     label: 'optimism' },
    { key: 'avax-mainnet',    label: 'avalanche' },
  ];

  const results = {}; // { [walletAddr_lower]: { chains: {}, errors: [] } }
  const stats = { wallets: 0, nfts: 0, tokens: 0, chains: new Set() };

  // Validate and deduplicate wallets
  const validWallets = wallets.filter(w => {
    const valid = validateAddress(w.address);
    return valid !== null;
  }).map(w => ({ ...w, address: ethers.getAddress(w.address) }));

  if (validWallets.length === 0) throw new Error('No valid wallet addresses provided');

  // Build all scan tasks — one per wallet per chain
  const scanTasks = [];
  for (const wallet of validWallets) {
    for (const chain of chainConfigs) {
      scanTasks.push({ wallet, chain });
    }
  }

  // Initialize results structure
  for (const wallet of validWallets) {
    results[wallet.address.toLowerCase()] = {
      address: wallet.address,
      nick: wallet.nick,
      chains: {},
      errors: [],
    };
  }

  // Execute all tasks through the queue
  await Promise.all(scanTasks.map(({ wallet, chain }) =>
    queue.run(async () => {
      const url = `https://${chain.key}.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${wallet.address}&withMetadata=true&pageSize=100`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          results[wallet.address.toLowerCase()].errors.push({
            chain: chain.key,
            error: `HTTP ${response.status}`,
          });
          return;
        }

        const data = await response.json();
        const nfts = data.ownedNfts || [];

        if (nfts.length === 0) {
          results[wallet.address.toLowerCase()].chains[chain.key] = [];
          return;
        }

        // Group by collection — same pattern as engine.js scanAllChains
        const collections = {};
        for (const nft of nfts) {
          const contract = nft.contract?.address;
          if (!contract) continue;

          // Normalize token type — handle Alchemy returning 'UNKNOWN' on proxy contracts
          let tokenType = nft.contract?.tokenType || 'ERC721';
          if (!['ERC721', 'ERC1155'].includes(tokenType)) tokenType = 'ERC721';

          if (!collections[contract]) {
            collections[contract] = {
              collection: nft.contract?.name || nft.collection?.name || 'Unknown Collection',
              contract,
              token_type: tokenType,
              tokens: [],
            };
          }

          collections[contract].tokens.push({
            tokenId: nft.tokenId,
            name: nft.name || nft.raw?.metadata?.name || `#${nft.tokenId}`,
            image: nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image || '',
            balance: nft.balance ? parseInt(nft.balance) : 1,
          });

          stats.nfts++;
          stats.chains.add(chain.key);
        }

        results[wallet.address.toLowerCase()].chains[chain.key] = Object.values(collections);
      } catch (e) {
        results[wallet.address.toLowerCase()].errors.push({
          chain: chain.key,
          error: e.message,
        });

        // On 429, the queue manager will naturally slow down future calls
        // since this slot is held until the catch completes
        if (e.message?.includes('429')) {
          await new Promise(r => setTimeout(r, RATE_LIMIT_PAUSE_MS));
        }
      }
    })
  ));

  stats.wallets = validWallets.length;
  stats.chains = stats.chains.size;

  return {
    success: true,
    data: {
      results,
      destination: validDest,
      stats,
    }
  };
}

// ── FLEET GAS ESTIMATE ─────────────────────────────────────────────────────────
/**
 * estimateFleetGas(scanResults, destination, alchemyKey, gasTier)
 *
 * Estimates total gas required across the entire fleet, per chain.
 * Uses per-token estimateGas — same critical pattern as engine.js.
 * Returns per-chain cost breakdown plus total.
 *
 * NOTE: Called BEFORE the user enters private keys. Uses public addresses
 * for estimation (estimateGas works with from address, no signature needed).
 */
export async function estimateFleetGas(scanResults, destination, alchemyKey, gasTier = 'recommended') {
  const validDest = validateAddress(destination);
  if (!validDest) throw new Error('Invalid destination address');

  const buffer = GAS_TIERS[gasTier] || GAS_TIERS.recommended;

  // Collect all chains that appear across the fleet
  const chainTotals = {}; // { [chainKey]: { gasUnits, tokenCount, nativeSymbol, gasPrice } }

  const CHAIN_KEYS = [
    { jsonKey: 'eth-mainnet',     engineKey: 'eth' },
    { jsonKey: 'polygon-mainnet', engineKey: 'polygon' },
    { jsonKey: 'base-mainnet',    engineKey: 'base' },
    { jsonKey: 'opt-mainnet',     engineKey: 'optimism' },
    { jsonKey: 'avax-mainnet',    engineKey: 'avalanche' },
  ];

  for (const { jsonKey, engineKey } of CHAIN_KEYS) {
    const chain = CHAINS[engineKey];
    if (!chain) continue;

    // Collect all tokens for this chain across all wallets
    const walletTokens = []; // [{ fromAddr, contract, tokenType, tokenId, balance }]
    for (const [walletAddr, walletResult] of Object.entries(scanResults)) {
      const collections = walletResult.chains?.[jsonKey] || [];
      for (const coll of collections) {
        for (const token of coll.tokens) {
          walletTokens.push({
            fromAddr: walletResult.address || walletAddr,
            contract: coll.contract,
            tokenType: coll.token_type,
            tokenId: token.tokenId,
            balance: token.balance || 1,
          });
        }
      }
    }

    if (walletTokens.length === 0) continue;

    const provider = getProvider(engineKey, alchemyKey);

    let feeData;
    try {
      feeData = await provider.getFeeData();
    } catch {
      feeData = { maxFeePerGas: ethers.parseUnits('20', 'gwei') };
    }

    const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const iface721 = new ethers.Interface(ERC721_ABI);
    const iface1155 = new ethers.Interface(ERC1155_ABI);
    const queue = createQueue(10); // Tighter limit for estimation calls

    let totalGasUnits = BigInt(chain.gasForFunding) * BigInt(
      // Count unique wallets on this chain
      new Set(walletTokens.map(t => t.fromAddr.toLowerCase())).size
    );

    const estimates = await Promise.all(walletTokens.map(token =>
      queue.run(async () => {
        try {
          let data;
          if (token.tokenType === 'ERC721') {
            data = iface721.encodeFunctionData('safeTransferFrom', [token.fromAddr, validDest, token.tokenId]);
          } else {
            data = iface1155.encodeFunctionData('safeTransferFrom', [token.fromAddr, validDest, token.tokenId, token.balance, '0x']);
          }
          const estimated = await provider.estimateGas({ from: token.fromAddr, to: token.contract, data });
          return estimated * BigInt(Math.floor(buffer * 100)) / 100n;
        } catch {
          // Token would revert — use flat fallback for planning only
          return token.tokenType === 'ERC721' ? 150000n : 200000n;
        }
      })
    ));

    for (const gas of estimates) totalGasUnits += gas;

    const gasCost = gasPrice * totalGasUnits;
    const gasCostBuffered = gasCost * BigInt(Math.floor(buffer * 100)) / 100n;

    chainTotals[engineKey] = {
      tokenCount: walletTokens.length,
      totalGasUnits: totalGasUnits.toString(),
      gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
      totalCostNative: ethers.formatEther(gasCostBuffered),
      nativeSymbol: chain.nativeSymbol,
    };
  }

  return {
    success: true,
    data: {
      estimates: chainTotals,
      gasTier,
      buffer,
    }
  };
}

// ── FLEET EXECUTE ──────────────────────────────────────────────────────────────
/**
 * executeFleet(wallets, destination, fundingKey, scanResults, alchemyKey, gasTier, onProgress)
 *
 * The core Mark V execution engine.
 *
 * Execution model:
 *   - All wallets execute in PARALLEL (Promise.all across wallets)
 *   - Within each wallet, transfers are SEQUENTIAL (nonce-ordered)
 *   - Funding happens per-wallet before that wallet's transfers start
 *   - Global queue manager limits concurrent Alchemy API calls to ~20
 *   - BATCH_SIZE pause every 5 transfers per wallet (rate limiting)
 *
 * This is the "N lanes of traffic" model from the constitution.
 */
export async function executeFleet(wallets, destination, fundingKey, scanResults, alchemyKey, gasTier = 'recommended', onProgress) {
  if (!validatePrivateKey(fundingKey)) throw new Error('Invalid funding wallet private key');

  const validDest = validateAddress(destination);
  if (!validDest) throw new Error('Invalid destination address');

  const buffer = GAS_TIERS[gasTier] || GAS_TIERS.recommended;

  const progress = (walletAddr, step, message, data = {}) => {
    if (onProgress) onProgress({ walletAddr, step, message, ...data });
  };

  const CHAIN_KEYS = [
    { jsonKey: 'eth-mainnet',     engineKey: 'eth' },
    { jsonKey: 'polygon-mainnet', engineKey: 'polygon' },
    { jsonKey: 'base-mainnet',    engineKey: 'base' },
    { jsonKey: 'opt-mainnet',     engineKey: 'optimism' },
    { jsonKey: 'avax-mainnet',    engineKey: 'avalanche' },
  ];

  // Validate all provided wallet keys upfront
  const validatedWallets = wallets.filter(w => {
    if (!w.privateKey) return false;
    if (!validatePrivateKey(w.privateKey)) return false;
    const valid = validateAddress(w.address);
    return valid !== null;
  }).map(w => ({ ...w, address: ethers.getAddress(w.address) }));

  if (validatedWallets.length === 0) throw new Error('No valid wallet keys provided');

  // Build one funding wallet per chain (same key, different providers)
  // This is computed per-chain per execution call.

  const walletResults = new Array(validatedWallets.length); // Pre-allocate to preserve input order
  let totalConfirmed = 0;
  let walletsCleared = 0;

  // ── PARALLEL WALLET EXECUTION ──────────────────────────────────────────────
  // All wallets run simultaneously. Each wallet handles its own chain loop.
  await Promise.all(validatedWallets.map(async (w, walletIndex) => {
    const walletResult = {
      address: w.address,
      nick: w.nick,
      success: false,
      confirmed: 0,
      failed: 0,
      skipped: 0,
      error: null,
      chainResults: [],
    };

    try {
      const walletData = scanResults[w.address.toLowerCase()];
      if (!walletData) {
        walletResult.error = 'No scan data for wallet';
        walletResults[walletIndex] = walletResult;
        return;
      }

      progress(w.address, 'init', `${w.nick}: Starting...`);

      // Process each chain sequentially within this wallet
      // (across wallets these run in parallel — different wallets are on different
      //  lanes, but a single wallet must handle its chains one at a time to keep
      //  nonce management simple and gas accounting correct)
      for (const { jsonKey, engineKey } of CHAIN_KEYS) {
        const collections = walletData.chains?.[jsonKey];
        if (!collections || collections.length === 0) continue;

        const totalTokens = collections.reduce((s, c) => s + c.tokens.length, 0);
        if (totalTokens === 0) continue;

        const chain = CHAINS[engineKey];
        const provider = getProvider(engineKey, alchemyKey);
        const compromisedWallet = new ethers.Wallet(w.privateKey, provider);
        const fundingWallet = new ethers.Wallet(fundingKey, provider);

        // Verify key resolves to the expected address
        if (compromisedWallet.address.toLowerCase() !== w.address.toLowerCase()) {
          progress(w.address, 'error', `${w.nick}: Key mismatch — expected ${w.address.slice(0,6)}, got ${compromisedWallet.address.slice(0,6)}`);
          walletResult.error = `Key does not match address for ${w.nick}`;
          continue;
        }

        progress(w.address, 'estimate', `${w.nick}: Estimating gas for ${chain.name}...`);

        // Live fee data
        const feeData = await provider.getFeeData();
        const baseFee = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
        const priorityFeeGwei = chain.minPriorityFeeGwei
          ? Math.max(chain.priorityFeeGwei, chain.minPriorityFeeGwei)
          : chain.priorityFeeGwei;
        const priorityFee = ethers.parseUnits(String(priorityFeeGwei), 'gwei');
        const maxFee = baseFee + priorityFee;

        // Per-token gas estimates — same critical logic as engine.js
        const iface721 = new ethers.Interface(ERC721_ABI);
        const iface1155 = new ethers.Interface(ERC1155_ABI);
        let totalGasUnits = BigInt(chain.gasForFunding);

        for (const coll of collections) {
          for (const token of coll.tokens) {
            try {
              let data;
              if (coll.token_type === 'ERC721') {
                data = iface721.encodeFunctionData('safeTransferFrom', [w.address, validDest, token.tokenId]);
              } else {
                const amount = token.balance || 1;
                data = iface1155.encodeFunctionData('safeTransferFrom', [w.address, validDest, token.tokenId, amount, '0x']);
              }
              const estimated = await provider.estimateGas({ from: w.address, to: coll.contract, data });
              totalGasUnits += estimated * BigInt(Math.floor(buffer * 100)) / 100n;
            } catch {
              // Flat fallback for planning — actual skip happens at transfer time
              totalGasUnits += coll.token_type === 'ERC721' ? 150000n : 200000n;
            }
          }
        }

        // Same 2x buffer + flat floor formula as engine.js
        const FLAT_FLOOR = ethers.parseEther('0.001');
        const requiredGas = (maxFee * totalGasUnits * 2n) + FLAT_FLOOR;

        const fundingBalance = await provider.getBalance(fundingWallet.address);
        if (fundingBalance < requiredGas) {
          progress(w.address, 'error', `${w.nick} / ${chain.name}: Insufficient funding wallet balance. Need ${ethers.formatEther(requiredGas)} ${chain.nativeSymbol}`);
          walletResult.error = `Insufficient gas for ${chain.name}`;
          continue;
        }

        // ── STEP 1: FUND ────────────────────────────────────────────────────
        progress(w.address, 'funding', `${w.nick}: Funding ${chain.name} wallet...`, {
          amount: ethers.formatEther(requiredGas),
          nativeSymbol: chain.nativeSymbol,
        });

        const fundingNonce = await provider.getTransactionCount(fundingWallet.address, 'latest');
        const fundTx = await fundingWallet.sendTransaction({
          chainId: chain.chainId,
          type: 2,
          to: w.address,
          value: requiredGas,
          gasLimit: BigInt(chain.gasForFunding),
          maxFeePerGas: maxFee,
          maxPriorityFeePerGas: priorityFee,
          nonce: fundingNonce,
        });

        progress(w.address, 'funding', `${w.nick} / ${chain.name}: Funding tx sent`, { txHash: fundTx.hash });
        await fundTx.wait(1);
        progress(w.address, 'funding', `${w.nick} / ${chain.name}: Funded ✓`, { txHash: fundTx.hash, confirmed: true });

        // ── STEP 2: TRANSFER ─────────────────────────────────────────────────
        progress(w.address, 'transferring', `${w.nick}: Submitting ${totalTokens} transfers on ${chain.name}...`);

        let nonce = await provider.getTransactionCount(w.address, 'latest');
        const sentTxs = [];
        let sendCount = 0;
        let skipCount = 0;

        for (const coll of collections) {
          for (const token of coll.tokens) {
            let data;
            try {
              if (coll.token_type === 'ERC721') {
                data = iface721.encodeFunctionData('safeTransferFrom', [w.address, validDest, token.tokenId]);
              } else {
                const amount = token.balance || 1;
                data = iface1155.encodeFunctionData('safeTransferFrom', [w.address, validDest, token.tokenId, amount, '0x']);
              }

              // Re-estimate with live balance — now the wallet is funded
              let gasLimit;
              try {
                const estimated = await provider.estimateGas({ from: w.address, to: coll.contract, data });
                gasLimit = estimated * BigInt(Math.floor(buffer * 100)) / 100n;
              } catch {
                // Would revert — skip cleanly
                skipCount++;
                progress(w.address, 'transferring', `${w.nick}: Skipped #${token.tokenId} (${coll.collection}) — would revert`, {
                  sent: sendCount, skipped: skipCount, total: totalTokens,
                });
                continue;
              }

              const tx = {
                chainId: chain.chainId,
                nonce,
                maxFeePerGas: maxFee,
                maxPriorityFeePerGas: priorityFee,
                to: coll.contract,
                value: 0n,
                type: 2,
                gasLimit,
                data,
              };

              nonce++;
              const sent = await compromisedWallet.sendTransaction(tx);
              sentTxs.push({ tx: sent, collection: coll.collection, tokenId: token.tokenId, chain: engineKey });
              sendCount++;

              progress(w.address, 'transferring', `${w.nick}: ${sendCount}/${totalTokens} submitted`, {
                sent: sendCount, total: totalTokens, skipped: skipCount,
                lastTx: sent.hash, chain: engineKey,
              });

              // Nibble: pause every BATCH_SIZE transactions per wallet
              if (sendCount % BATCH_SIZE === 0) {
                await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
              }

            } catch (e) {
              progress(w.address, 'error', `${w.nick}: Failed #${token.tokenId} — ${e.message}`, {
                sent: sendCount, total: totalTokens, error: true,
              });
              if (e.message?.includes('429')) {
                await new Promise(r => setTimeout(r, RATE_LIMIT_PAUSE_MS));
              }
            }
          }
        }

        // ── STEP 3: CONFIRM ──────────────────────────────────────────────────
        progress(w.address, 'confirming', `${w.nick} / ${chain.name}: Waiting for ${sentTxs.length} confirmations...`);

        let chainConfirmed = 0;
        let chainFailed = 0;

        for (const { tx, collection, tokenId, chain: txChain } of sentTxs) {
          try {
            const receipt = await Promise.race([
              tx.wait(1),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timeout')), CONFIRMATION_TIMEOUT_MS)),
            ]);
            if (receipt && receipt.status === 1) {
              chainConfirmed++;
              walletResult.confirmed++;
              totalConfirmed++;
              progress(w.address, 'confirming', `${w.nick}: ✓ #${tokenId} (${collection})`, {
                confirmed: chainConfirmed, total: sentTxs.length,
                txHash: tx.hash, chain: txChain,
              });
            } else {
              chainFailed++;
              walletResult.failed++;
            }
          } catch (e) {
            chainFailed++;
            walletResult.failed++;
            progress(w.address, 'error', `${w.nick}: ✗ #${tokenId} — ${e.message}`, {
              confirmed: chainConfirmed, total: sentTxs.length, error: true,
            });
          }
        }

        walletResult.skipped += skipCount;
        walletResult.chainResults.push({
          chain: engineKey,
          chainName: chain.name,
          submitted: sendCount,
          confirmed: chainConfirmed,
          failed: chainFailed,
          skipped: skipCount,
        });

        progress(w.address, 'complete', `${w.nick} / ${chain.name}: ${chainConfirmed} confirmed, ${chainFailed} failed, ${skipCount} skipped`);
      }

      walletResult.success = walletResult.error === null;
      if (walletResult.success) walletsCleared++;

    } catch (e) {
      walletResult.error = e.message;
      progress(w.address, 'error', `${w.nick}: Fatal error — ${e.message}`);
    }

    walletResults[walletIndex] = walletResult;
    progress(w.address, 'done', walletResult.success
      ? `${w.nick}: Complete — ${walletResult.confirmed} assets confirmed`
      : `${w.nick}: Finished with errors`
    );
  }));

  return {
    success: true,
    data: {
      walletsCleared,
      walletsTotal: validatedWallets.length,
      totalConfirmed,
      walletResults,
      destination: validDest,
    }
  };
}

// ── EMBLEM VAULT FLEET SCAN ────────────────────────────────────────────────────
/**
 * scanEmblemFleet(wallets, alchemyKey)
 *
 * Scans multiple wallets for Emblem Vaults using the same emblem-engine.js
 * scanEmblemVaults function — no duplication. Aggregates results with
 * wallet attribution so the UI knows which vault came from which wallet.
 */
export async function scanEmblemFleet(wallets, alchemyKey) {
  if (!alchemyKey) throw new Error('Alchemy API key required');
  if (!wallets || wallets.length === 0) throw new Error('No wallets provided');

  const queue = createQueue(10); // Conservative for Emblem API
  const allVaults = [];
  const errors = [];

  await Promise.all(wallets.map(w =>
    queue.run(async () => {
      const validAddr = validateAddress(w.address);
      if (!validAddr) {
        errors.push({ wallet: w.address, error: 'Invalid address' });
        return;
      }
      try {
        const result = await scanEmblemVaults(validAddr, alchemyKey);
        const vaults = result.data?.vaults || result.vaults || [];
        // Tag each vault with the wallet it came from
        for (const vault of vaults) {
          allVaults.push({
            ...vault,
            walletAddress: validAddr,
            walletNick: w.nick || validAddr.slice(0, 8),
          });
        }
      } catch (e) {
        errors.push({ wallet: w.address, error: e.message });
      }
    })
  ));

  return {
    success: true,
    data: {
      vaults: allVaults,
      total: allVaults.length,
      errors,
    }
  };
}

// ── EMBLEM VAULT FLEET TRANSFER ────────────────────────────────────────────────
/**
 * executeEmblemFleetTransfer(vaults, destination, fundingKey, walletKeys, alchemyKey)
 *
 * Bulk transfers Emblem Vault NFTs (the EVM token) from multiple wallets.
 * Uses emblem-engine.js executeEmblemRescue under the hood, called per wallet.
 * This is Section 1 of the Mark V Emblem tab — no unvaulting, no XCP.
 */
export async function executeEmblemFleetTransfer(vaults, destination, fundingKey, walletKeys, alchemyKey) {
  if (!validatePrivateKey(fundingKey)) throw new Error('Invalid funding wallet private key');
  const validDest = validateAddress(destination);
  if (!validDest) throw new Error('Invalid destination address');

  // Group vaults by wallet address
  const vaultsByWallet = {};
  for (const vault of vaults) {
    const addr = vault.walletAddress?.toLowerCase();
    if (!addr) continue;
    if (!vaultsByWallet[addr]) vaultsByWallet[addr] = [];
    vaultsByWallet[addr].push(vault);
  }

  const results = [];
  let totalConfirmed = 0;

  // Execute per wallet — each wallet uses emblem-engine.js executeEmblemRescue
  await Promise.all(Object.entries(vaultsByWallet).map(async ([walletAddr, walletVaults]) => {
    const privateKey = walletKeys[walletAddr] || walletKeys[ethers.getAddress(walletAddr)];
    if (!privateKey || !validatePrivateKey(privateKey)) {
      results.push({ wallet: walletAddr, success: false, error: 'No private key provided', confirmed: 0 });
      return;
    }

    try {
      const vaultTokenIds = walletVaults.map(v => ({
        contract: v.contract,
        tokenId: v.tokenId,
        willTransfer: true,
      }));

      const result = await executeEmblemRescue(
        vaultTokenIds,
        privateKey,    // compromisedKey — the wallet's private key
        fundingKey,    // fundingKey — pays for gas
        validDest,     // toAddress — destination
        alchemyKey,
        null,          // onProgress — not used in fleet context
      );

      const confirmed = result.data?.confirmed || 0;
      totalConfirmed += confirmed;
      results.push({ wallet: walletAddr, success: result.success, confirmed, error: null });
    } catch (e) {
      results.push({ wallet: walletAddr, success: false, error: e.message, confirmed: 0 });
    }
  }));

  return {
    success: true,
    data: {
      confirmed: totalConfirmed,
      walletResults: results,
      destination: validDest,
    }
  };
}

// ── EMBLEM VAULT UNVAULT ───────────────────────────────────────────────────────
/**
 * executeEmblemUnvault(vaults, xcpDestination, btcFeeAmount, walletKeys, alchemyKey)
 *
 * The full unvault flow — confirmed working from constitution research (May 2026).
 *
 * Per vault:
 *   1. personal_sign("Claim: {serialNumber}", ownerAddress)   — ethers.js
 *   2. POST tor-us-signer-coval.vercel.app/sign               — fetch(), open endpoint (live tested)
 *   3. getTorusKeys(tokenId, jwt)                             — @toruslabs packages
 *   4. CryptoJS.AES.decrypt(ciphertextV2, privKey)            — local, no network
 *   5. BIP44 derivation m/44'/0'/0'/0/0                       — bip39 + hdkey
 *   6. XCP send via xchain.io                                 — free REST API
 *
 * TORUS_VERIFIER  = 'tor-us-signer-vercel'        (hardcoded in public SDK source)
 * TORUS_CLIENT_ID = 'BOqGGv-...'                  (hardcoded in public SDK source)
 */

const TORUS_VERIFIER  = 'tor-us-signer-vercel';
const TORUS_CLIENT_ID = 'BOqGGv-Yx7Dp5RdvD9R3DgSC8jv66gQGwT3w22L7fj3Fg5WQ8AEUjJzyyEwD-qvq5eUQiVipyzOmRZTWBAxaoj0';
const TORUS_SIGNER_URL = 'https://tor-us-signer-coval.vercel.app/sign';
const XCHAIN_API = 'https://xchain.io/api';

export async function executeEmblemUnvault(vaults, xcpDestination, btcFeeAmount = 0.0001, walletKeys, alchemyKey, onProgress) {
  if (!xcpDestination) throw new Error('XCP/Bitcoin destination address required');
  if (!vaults || vaults.length === 0) throw new Error('No vaults selected');

  const progress = (vault, step, msg, data = {}) => {
    if (onProgress) onProgress({ vault, step, msg, ...data });
  };

  // Lazy-load Torus packages — only needed for unvault
  let FetchNodeDetails, TorusUtils, CryptoJS, bip39, hdkey;
  try {
    FetchNodeDetails = (await import('@toruslabs/fetch-node-details')).default;
    TorusUtils = (await import('@toruslabs/torus.js')).default;
    CryptoJS = (await import('crypto-js')).default;
    bip39 = await import('bip39');
    hdkey = (await import('hdkey')).default;
  } catch (e) {
    throw new Error(`Unvault dependencies not installed. Run: npm install @toruslabs/fetch-node-details @toruslabs/torus.js crypto-js bip39 hdkey\n\nOriginal error: ${e.message}`);
  }

  const results = [];
  let totalConfirmed = 0;

  for (const vault of vaults) {
    const walletAddr = vault.walletAddress;
    const privateKey = walletKeys[walletAddr?.toLowerCase()] || walletKeys[walletAddr];

    if (!privateKey || !validatePrivateKey(privateKey)) {
      progress(vault, 'error', `No key for vault owner ${walletAddr?.slice(0,8)}`);
      results.push({ vault: vault.tokenId, success: false, error: 'No private key provided' });
      continue;
    }

    try {
      const ownerWallet = new ethers.Wallet(privateKey);
      const tokenId = vault.tokenId;

      // ── STEP 1: PERSONAL SIGN ─────────────────────────────────────────────
      progress(vault, 'sign', `Vault #${tokenId}: Signing claim...`);
      const message = `Claim: ${tokenId}`;
      const signature = await ownerWallet.signMessage(message);

      // ── STEP 2: SIGNER PROXY ──────────────────────────────────────────────
      progress(vault, 'proxy', `Vault #${tokenId}: Contacting Emblem signer...`);
      const signerRes = await fetch(TORUS_SIGNER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'chainid': '1' },
        body: JSON.stringify({ signature, tokenId }),
      });

      if (!signerRes.ok) {
        const body = await signerRes.text().catch(() => '');
        throw new Error(`Signer proxy returned ${signerRes.status}: ${body}`);
      }

      const signerData = await signerRes.json();
      const jwt = signerData.token;
      if (!jwt) throw new Error('Signer proxy did not return a JWT token');

      // ── STEP 3: TORUS KEY RETRIEVAL ───────────────────────────────────────
      progress(vault, 'torus', `Vault #${tokenId}: Retrieving decryption keys from Torus...`);
      const fetchNodeDetails = new FetchNodeDetails();
      const torus = new TorusUtils({
        network: 'mainnet',
        enableOneKey: true,
        clientId: TORUS_CLIENT_ID,
      });

      const { torusNodeEndpoints, torusIndexes } = await fetchNodeDetails.getNodeDetails({
        verifier: TORUS_VERIFIER,
        verifierId: tokenId,
      });

      const torusResult = await torus.retrieveShares(
        torusNodeEndpoints,
        torusIndexes,
        TORUS_VERIFIER,
        { verifier_id: tokenId },
        jwt
      );

      const privKey = torusResult?.privateKey?.privKey;
      if (!privKey) throw new Error('Torus did not return a private key');

      // ── STEP 4: AES DECRYPT ───────────────────────────────────────────────
      progress(vault, 'decrypt', `Vault #${tokenId}: Decrypting vault contents...`);

      // Fetch vault metadata to get ciphertextV2
      const provider = new ethers.JsonRpcProvider(
        alchemyKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}` : 'https://cloudflare-eth.com',
        null,
        { staticNetwork: ethers.Network.from(1) }
      );

      const vaultABI = ['function tokenURI(uint256 tokenId) view returns (string)'];
      const vaultContract = new ethers.Contract(vault.contract, vaultABI, provider);
      const tokenURI = await vaultContract.tokenURI(tokenId);

      // Decode base64 tokenURI — Emblem returns data:application/json;base64,...
      let metadata;
      if (tokenURI.startsWith('data:')) {
        const b64 = tokenURI.slice(tokenURI.indexOf(',') + 1);
        metadata = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      } else {
        const res = await fetch(tokenURI);
        metadata = await res.json();
      }

      const ciphertextV2 = metadata?.ciphertextV2;
      if (!ciphertextV2) throw new Error('No ciphertextV2 found in vault metadata');

      const decrypted = CryptoJS.AES.decrypt(ciphertextV2, privKey);
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      if (!decryptedStr) throw new Error('Decryption failed — invalid key or ciphertext');

      const decryptedData = JSON.parse(decryptedStr);
      const mnemonic = decryptedData?.phrase;
      if (!mnemonic) throw new Error('Decrypted data does not contain a mnemonic phrase');

      // ── STEP 5: BIP44 DERIVATION ──────────────────────────────────────────
      progress(vault, 'derive', `Vault #${tokenId}: Deriving Bitcoin/XCP keys...`);

      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase in decrypted vault data');
      }

      const seed = await bip39.mnemonicToSeed(mnemonic);
      const root = hdkey.fromMasterSeed(seed);
      // BIP44 derivation path for Bitcoin (and XCP — same chain)
      const child = root.derive("m/44'/0'/0'/0/0");
      const btcPrivKey = child.privateKey.toString('hex');
      const btcWif = privateKeyToWIF(btcPrivKey);

      // Derive the internal BTC address for this vault
      const btcAddress = deriveP2PKHAddress(child.publicKey);

      progress(vault, 'derive', `Vault #${tokenId}: Internal address derived — ${btcAddress.slice(0,8)}...`);

      // ── STEP 6: XCP ASSET MOVEMENT ────────────────────────────────────────
      progress(vault, 'xcp', `Vault #${tokenId}: Moving XCP assets...`);

      // Get XCP balances for the internal wallet
      const xcpBalancesRes = await fetch(`${XCHAIN_API}/balances/${btcAddress}`);
      if (!xcpBalancesRes.ok) throw new Error(`xchain.io API error: HTTP ${xcpBalancesRes.status}`);
      const xcpBalances = await xcpBalancesRes.json();

      if (!xcpBalances.data || xcpBalances.data.length === 0) {
        progress(vault, 'xcp', `Vault #${tokenId}: No XCP assets found at ${btcAddress.slice(0,8)}...`);
        results.push({ vault: tokenId, success: true, assetsFound: 0, assetsTransferred: 0 });
        continue;
      }

      let assetsTransferred = 0;
      for (const asset of xcpBalances.data) {
        if (!asset.asset || asset.quantity === 0) continue;

        try {
          progress(vault, 'xcp', `Vault #${tokenId}: Sending ${asset.asset} (qty: ${asset.quantity})...`);

          // Build and broadcast Counterparty send transaction via xchain.io
          const sendRes = await fetch(`${XCHAIN_API}/create_send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: btcAddress,
              destination: xcpDestination,
              asset: asset.asset,
              quantity: asset.quantity,
              privkey: btcWif,
            }),
          });

          if (!sendRes.ok) {
            const errText = await sendRes.text().catch(() => '');
            progress(vault, 'warn', `Vault #${tokenId}: Could not send ${asset.asset}: ${errText.slice(0, 80)}`);
            continue;
          }

          const sendData = await sendRes.json();
          if (sendData.tx_hash || sendData.txid) {
            assetsTransferred++;
            totalConfirmed++;
            progress(vault, 'xcp', `Vault #${tokenId}: ✓ ${asset.asset} sent`, {
              txHash: sendData.tx_hash || sendData.txid,
            });
          }
        } catch (e) {
          progress(vault, 'warn', `Vault #${tokenId}: Error sending ${asset.asset}: ${e.message}`);
        }
      }

      results.push({
        vault: tokenId,
        success: true,
        assetsFound: xcpBalances.data.length,
        assetsTransferred,
        btcAddress,
        xcpDestination,
      });

      progress(vault, 'complete', `Vault #${tokenId}: ✓ Unvault complete — ${assetsTransferred} assets transferred`);

    } catch (e) {
      progress(vault, 'error', `Vault #${vault.tokenId}: ✗ ${e.message}`);
      results.push({ vault: vault.tokenId, success: false, error: e.message });
    }
  }

  return {
    success: true,
    data: {
      confirmed: totalConfirmed,
      vaultResults: results,
      xcpDestination,
    }
  };
}

// ── BITCOIN HELPERS ────────────────────────────────────────────────────────────
// Pure Node.js implementation — no external Bitcoin library required.
// These are well-established cryptographic operations, not novel code.

import { createHash } from 'crypto';

function hash256(buffer) {
  return createHash('sha256').update(
    createHash('sha256').update(buffer).digest()
  ).digest();
}

function hash160(buffer) {
  const sha256 = createHash('sha256').update(buffer).digest();
  return createHash('ripemd160').update(sha256).digest();
}

/**
 * Derive P2PKH (1...) Bitcoin address from a compressed public key.
 * Standard Base58Check encoding — same as every Bitcoin wallet uses.
 */
function deriveP2PKHAddress(publicKey) {
  const pubKeyHash = hash160(publicKey);
  // Version byte 0x00 for mainnet P2PKH
  const versionedHash = Buffer.concat([Buffer.from([0x00]), pubKeyHash]);
  const checksum = hash256(versionedHash).slice(0, 4);
  const addressBytes = Buffer.concat([versionedHash, checksum]);
  return base58Encode(addressBytes);
}

/**
 * Convert 32-byte hex private key to WIF (Wallet Import Format).
 * Compressed WIF — starts with 'K' or 'L'.
 */
function privateKeyToWIF(hexKey) {
  const keyBytes = Buffer.from(hexKey.padStart(64, '0'), 'hex');
  // 0x80 prefix for mainnet, 0x01 suffix for compressed key
  const raw = Buffer.concat([Buffer.from([0x80]), keyBytes, Buffer.from([0x01])]);
  const checksum = hash256(raw).slice(0, 4);
  return base58Encode(Buffer.concat([raw, checksum]));
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer) {
  let num = BigInt('0x' + buffer.toString('hex'));
  let encoded = '';
  while (num > 0n) {
    const remainder = num % 58n;
    num = num / 58n;
    encoded = BASE58_ALPHABET[Number(remainder)] + encoded;
  }
  // Leading zeros
  for (const byte of buffer) {
    if (byte !== 0) break;
    encoded = '1' + encoded;
  }
  return encoded;
}

// ── EXPORTS ────────────────────────────────────────────────────────────────────
export default {
  scanFleet,
  estimateFleetGas,
  executeFleet,
  scanEmblemFleet,
  executeEmblemFleetTransfer,
  executeEmblemUnvault,
};
