/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LIFEBOAT V10 — Execution Engine                                  ║
 * ║  Ported from proven lifeboat.js (411 NFTs rescued)               ║
 * ║  by Kane Mayfield · kanemayfield.com                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { ethers } from 'ethers';

// ── CHAIN CONFIGURATION ────────────────────────────────────────────────────────
// Ground truth from successful rescue operations
export const CHAINS = {
  'eth': {
    name: 'Ethereum Mainnet',
    chainId: 1,
    jsonKey: 'eth-mainnet',
    rpc: 'https://rpc.mevblocker.io',
    mevProtected: true,
    nativeSymbol: 'ETH',
    explorer: 'https://etherscan.io',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
  'polygon': {
    name: 'Polygon',
    chainId: 137,
    jsonKey: 'polygon-mainnet',
    rpc: 'https://polygon-mainnet.g.alchemy.com/v2/', // Alchemy key appended at runtime
    mevProtected: false,
    nativeSymbol: 'POL',
    explorer: 'https://polygonscan.com',
    gasBuffer: 1.25,
    priorityFeeGwei: 30, // Polygon requires higher priority fee
    minPriorityFeeGwei: 30,
    gasForFunding: 21000,
  },
  'base': {
    name: 'Base',
    chainId: 8453,
    jsonKey: 'base-mainnet',
    rpc: 'https://mainnet.base.org',
    mevProtected: false,
    nativeSymbol: 'ETH',
    explorer: 'https://basescan.org',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
  'optimism': {
    name: 'Optimism',
    chainId: 10,
    jsonKey: 'opt-mainnet',
    rpc: 'https://mainnet.optimism.io',
    mevProtected: false,
    nativeSymbol: 'ETH',
    explorer: 'https://optimistic.etherscan.io',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
  'avalanche': {
    name: 'Avalanche',
    chainId: 43114,
    jsonKey: 'avax-mainnet',
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    mevProtected: false,
    nativeSymbol: 'AVAX',
    explorer: 'https://snowtrace.io',
    gasBuffer: 1.25,
    priorityFeeGwei: 25,
    gasForFunding: 21000,
  },
  'apechain': {
    name: 'ApeChain',
    chainId: 33139,
    jsonKey: 'apechain-mainnet',
    rpc: 'https://apechain-mainnet.g.alchemy.com/v2/', // Alchemy key appended at runtime
    mevProtected: false,
    nativeSymbol: 'APE',
    explorer: 'https://apescan.io',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
  'arbitrum': {
    name: 'Arbitrum',
    chainId: 42161,
    jsonKey: 'arb-mainnet',
    rpc: 'https://arb-mainnet.g.alchemy.com/v2/', // Alchemy key appended at runtime
    mevProtected: false,
    nativeSymbol: 'ETH',
    explorer: 'https://arbiscan.io',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
  // ── FRACTAL VISIONS SUPERCHAIN CHAINS (Configured — not yet live-rescue tested) ──
  'shape': {
    name: 'Shape',
    chainId: 360,
    jsonKey: 'shape-mainnet',
    rpc: 'https://mainnet.shape.network',
    mevProtected: false,
    nativeSymbol: 'ETH',
    explorer: 'https://shapescan.xyz',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
  'superseed': {
    name: 'Superseed',
    chainId: 5330,
    jsonKey: 'superseed-mainnet',
    rpc: 'https://mainnet.superseed.xyz',
    mevProtected: false,
    nativeSymbol: 'ETH',
    explorer: 'https://superscan.network',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
  'soneium': {
    name: 'Soneium',
    chainId: 1868,
    jsonKey: 'soneium-mainnet',
    rpc: 'https://rpc.soneium.org',
    mevProtected: false,
    nativeSymbol: 'ETH',
    explorer: 'https://soneium.blockscout.com',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
  'unichain': {
    name: 'Unichain',
    chainId: 130,
    jsonKey: 'unichain-mainnet',
    rpc: 'https://mainnet.unichain.org',
    mevProtected: false,
    nativeSymbol: 'ETH',
    explorer: 'https://uniscan.xyz',
    gasBuffer: 1.25,
    priorityFeeGwei: 0.5,
    gasForFunding: 21000,
  },
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

const MANIFOLD_ABI = [
  'function transferOwnership(address newOwner)',
  'function approveAdmin(address admin)',
  'function setRoyalties(address[] receivers, uint256[] basisPoints)',
  'function owner() view returns (address)',
];

// ── HELPERS ────────────────────────────────────────────────────────────────────
function getProvider(chainKey, alchemyKey) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  let rpc = chain.rpc;
  // Chains that use Alchemy RPC need key appended
  if (chainKey === 'polygon' && alchemyKey) {
    rpc = `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  } else if (chainKey === 'apechain' && alchemyKey) {
    rpc = `https://apechain-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  } else if (chainKey === 'arbitrum' && alchemyKey) {
    rpc = `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }

  // Always specify network statically — prevents "failed to detect network"
  // retry loops on MEV Blocker AND avoids proxy contract call failures on
  // OP-stack chains where eth_chainId probes can interfere with call results.
  return new ethers.JsonRpcProvider(
    rpc,
    null,
    { staticNetwork: ethers.Network.from(chain.chainId) }
  );
}

function validateAddress(addr) {
  try {
    return ethers.getAddress(addr);
  } catch {
    return null;
  }
}

function validatePrivateKey(key) {
  try {
    new ethers.Wallet(key);
    return true;
  } catch {
    return false;
  }
}

// ── LAYER 1: alchemyFetch() — ARMORED HTTP CALL ──────────────────────────────
// Every single Alchemy call in the engine goes through this ONE function.
// Retry with exponential backoff on 429/5xx. 30-second timeout. Structured errors.
// No function calls fetch() to Alchemy directly anymore. Ever.
async function alchemyFetch(url, options = {}) {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 30000;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Success — return data
      if (response.ok) {
        return await response.json();
      }

      // Retryable: 429 (rate limit) or 5xx (server error)
      if (response.status === 429 || response.status >= 500) {
        const waitMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`  ⚠ alchemyFetch: HTTP ${response.status} — retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`);
        lastError = { httpStatus: response.status, attempt, url: url.split('?')[0] };
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
      }

      // Non-retryable HTTP error (400, 401, 403, etc.)
      throw {
        alchemyError: true,
        httpStatus: response.status,
        message: `HTTP ${response.status}`,
        retryCount: attempt,
        url: url.split('?')[0],
      };

    } catch (e) {
      // AbortController timeout
      if (e.name === 'AbortError') {
        console.warn(`  ⚠ alchemyFetch: timeout (${TIMEOUT_MS}ms) — retry ${attempt + 1}/${MAX_RETRIES}`);
        lastError = { httpStatus: 0, message: 'Timeout', attempt, url: url.split('?')[0] };
        if (attempt < MAX_RETRIES) {
          const waitMs = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
      }
      // Already structured error from above
      if (e.alchemyError) throw e;
      // Network error or other
      lastError = { httpStatus: 0, message: e.message, attempt, url: url.split('?')[0] };
      if (attempt < MAX_RETRIES) {
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
    }
  }

  // All retries exhausted
  throw {
    alchemyError: true,
    httpStatus: lastError?.httpStatus || 0,
    message: lastError?.message || 'All retries failed',
    retryCount: MAX_RETRIES,
    url: lastError?.url || url.split('?')[0],
  };
}

// ── LAYER 2: paginatedNFTFetch() — FULL COLLECTION GETTER ───────────────────
// Wraps alchemyFetch for getNFTsForOwner specifically.
// Follows pageKey until done. 200ms pause between pages. Safety cap at 50 pages.
// onPage callback reports progress back for SSE streaming.
async function paginatedNFTFetch(chain, wallet, alchemyKey, onPage) {
  const baseUrl = `https://${chain}.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${wallet}&withMetadata=true&pageSize=100`;
  const MAX_PAGES = 50; // Safety cap: 5000 NFTs per chain
  const PAGE_DELAY_MS = 200; // 200ms between pages — rate limit safe

  let allNfts = [];
  let pageKey = null;
  let pages = 0;

  do {
    let url = baseUrl;
    if (pageKey) url += `&pageKey=${encodeURIComponent(pageKey)}`;

    const data = await alchemyFetch(url);
    const nfts = data.ownedNfts || [];
    allNfts = allNfts.concat(nfts);
    pageKey = data.pageKey || null;
    pages++;

    // Report progress via callback
    if (onPage) {
      onPage({ page: pages, nftsSoFar: allNfts.length, hasMore: !!pageKey });
    }

    // Pause between pages to stay under rate limits
    if (pageKey && pages < MAX_PAGES) {
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }
  } while (pageKey && pages < MAX_PAGES);

  if (pages >= MAX_PAGES && pageKey) {
    console.warn(`  ⚠ paginatedNFTFetch: hit ${MAX_PAGES}-page cap on ${chain} (${allNfts.length} NFTs retrieved, more exist)`);
  }

  return allNfts;
}

// ── SCANNING ───────────────────────────────────────────────────────────────────
// Uses Alchemy NFT API to scan all chains simultaneously
export async function scanAllChains(wallet, alchemyKey, onProgress) {
  const validWallet = validateAddress(wallet);
  if (!validWallet) throw new Error('Invalid wallet address');
  if (!alchemyKey) throw new Error('Alchemy API key required');

  // SCAN ORDER: ETH first (most valuable), Polygon last (most spam)
  const chainKeys = [
    'eth-mainnet',      // Ethereum — highest value NFTs
    'apechain-mainnet', // ApeChain — Yuga/BAYC ecosystem
    'base-mainnet',     // Base — high mint activity
    'arb-mainnet',      // Arbitrum — growing NFT scene
    'opt-mainnet',      // Optimism — standard L2
    'avax-mainnet',     // Avalanche — standard L1
    'polygon-mainnet',  // Polygon — last because most airdrop spam
  ];

  const results = { rescue_from: validWallet, chains: {} };
  const errors = [];

  // SEQUENTIAL — one chain at a time to stay under Alchemy rate limits.
  // With the SSE stream, "slower" doesn't feel slower — user sees per-chain
  // results landing in real time while remaining chains scan.
  for (const key of chainKeys) {
    // Notify: chain starting
    if (onProgress) onProgress({ type: 'chain-start', chain: key });

    try {
      // Layer 2: paginated fetch with per-page progress reporting
      const allNfts = await paginatedNFTFetch(key, validWallet, alchemyKey, (pageData) => {
        if (onProgress) {
          onProgress({ type: 'chain-progress', chain: key, page: pageData.page, nftsSoFar: pageData.nftsSoFar });
        }
      });

      if (allNfts.length === 0) {
        results.chains[key] = [];
        if (onProgress) onProgress({ type: 'chain-complete', chain: key, nfts: 0, collections: 0 });
        continue;
      }

      // Group by collection — same proven logic
      const collections = {};
      for (const nft of allNfts) {
        const contract = nft.contract?.address;
        if (!contract) continue;

        if (!collections[contract]) {
          collections[contract] = {
            collection: nft.contract?.name || nft.collection?.name || 'Unknown Collection',
            contract: contract,
            token_type: nft.contract?.tokenType || 'ERC721',
            tokens: [],
          };
        }

        collections[contract].tokens.push({
          tokenId: nft.tokenId,
          name: nft.name || nft.raw?.metadata?.name || `#${nft.tokenId}`,
          image: nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image || '',
          balance: nft.balance ? parseInt(nft.balance) : 1,
        });
      }

      results.chains[key] = Object.values(collections);

      // Notify: chain complete
      if (onProgress) {
        onProgress({
          type: 'chain-complete',
          chain: key,
          nfts: allNfts.length,
          collections: Object.keys(collections).length,
        });
      }
    } catch (e) {
      const errorInfo = {
        chain: key,
        error: e.alchemyError ? `HTTP ${e.httpStatus} after ${e.retryCount} retries` : e.message,
      };
      errors.push(errorInfo);
      if (onProgress) onProgress({ type: 'chain-error', chain: key, error: errorInfo.error });
    }
  }

  return { success: true, data: results, errors };
}

// ── GAS ESTIMATION ─────────────────────────────────────────────────────────────
// CRITICAL: Per-token estimateGas — this is what makes non-standard contracts work
export async function estimateChainGas(chainKey, rescueData, alchemyKey) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  const collections = rescueData.chains?.[chain.jsonKey];
  if (!collections || collections.length === 0) {
    return {
      success: true,
      data: {
        chain: chainKey,
        chainName: chain.name,
        tokenCount: 0,
        totalGasUnits: 0,
        gasPriceGwei: 0,
        totalCostNative: '0',
        nativeSymbol: chain.nativeSymbol,
        mevProtected: chain.mevProtected,
      }
    };
  }

  const provider = getProvider(chainKey, alchemyKey);
  const fromAddr = rescueData.rescue_from;
  const toAddr = rescueData.rescue_to;

  if (!fromAddr || !toAddr) {
    throw new Error('rescue_from and rescue_to addresses required');
  }

  // Get current gas price
  let feeData;
  try {
    feeData = await provider.getFeeData();
  } catch (e) {
    // Fallback gas price
    feeData = { maxFeePerGas: ethers.parseUnits('20', 'gwei') };
  }

  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
  const iface721 = new ethers.Interface(ERC721_ABI);
  const iface1155 = new ethers.Interface(ERC1155_ABI);

  let totalGas = BigInt(chain.gasForFunding); // Start with funding tx gas
  let erc721Count = 0;
  let erc1155Count = 0;
  let skipped = 0;
  const tokenDetails = [];

  for (const coll of collections) {
    for (const token of coll.tokens) {
      let data, gasEstimate;
      try {
        if (coll.token_type === 'ERC721') {
          data = iface721.encodeFunctionData('safeTransferFrom', [fromAddr, toAddr, token.tokenId]);
        } else {
          const amount = token.balance || 1;
          data = iface1155.encodeFunctionData('safeTransferFrom', [fromAddr, toAddr, token.tokenId, amount, '0x']);
        }

        // CRITICAL: Real estimateGas per token
        gasEstimate = await provider.estimateGas({ from: fromAddr, to: coll.contract, data });
        const buffered = gasEstimate * BigInt(Math.floor(chain.gasBuffer * 100)) / 100n;
        totalGas += buffered;
        
        if (coll.token_type === 'ERC721') erc721Count++; else erc1155Count++;
        
        tokenDetails.push({
          collection: coll.collection,
          tokenId: token.tokenId,
          gasEstimate: buffered.toString(),
          willTransfer: true,
        });
      } catch (e) {
        // Token would revert — skip it
        skipped++;
        tokenDetails.push({
          collection: coll.collection,
          tokenId: token.tokenId,
          gasEstimate: '0',
          willTransfer: false,
          reason: 'Would revert (already moved or restricted)',
        });
      }
    }
  }

  const gasCost = gasPrice * totalGas;
  const gasCostBuffered = gasCost * BigInt(Math.floor(chain.gasBuffer * 100)) / 100n;

  return {
    success: true,
    data: {
      chain: chainKey,
      chainName: chain.name,
      tokenCount: erc721Count + erc1155Count,
      erc721Count,
      erc1155Count,
      skipped,
      totalGasUnits: totalGas.toString(),
      gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
      totalCostNative: ethers.formatEther(gasCostBuffered),
      nativeSymbol: chain.nativeSymbol,
      mevProtected: chain.mevProtected,
      explorer: chain.explorer,
      tokenDetails,
    }
  };
}

// ── BALANCE CHECKING ───────────────────────────────────────────────────────────
export async function getBalances(addresses, chainKey, alchemyKey) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  const provider = getProvider(chainKey, alchemyKey);
  const balances = [];

  for (const addr of addresses) {
    const valid = validateAddress(addr);
    if (!valid) {
      balances.push({ address: addr, balance: '0', error: 'Invalid address' });
      continue;
    }

    try {
      const balance = await provider.getBalance(valid);
      balances.push({
        address: valid,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
      });
    } catch (e) {
      balances.push({ address: valid, balance: '0', error: e.message });
    }
  }

  return {
    success: true,
    data: {
      chain: chainKey,
      nativeSymbol: chain.nativeSymbol,
      balances,
    }
  };
}

// ── BUILD TRANSFER TRANSACTION ─────────────────────────────────────────────────
// Returns null if the transfer would revert (token already moved, restricted, etc.)
async function buildTransferTx(provider, collection, token, fromAddr, toAddr, nonce, maxFee, priorityFee, chainId, gasBuffer) {
  const iface721 = new ethers.Interface(ERC721_ABI);
  const iface1155 = new ethers.Interface(ERC1155_ABI);

  let data;
  if (collection.token_type === 'ERC721') {
    data = iface721.encodeFunctionData('safeTransferFrom', [fromAddr, toAddr, token.tokenId]);
  } else {
    const amount = token.balance || 1;
    data = iface1155.encodeFunctionData('safeTransferFrom', [fromAddr, toAddr, token.tokenId, amount, '0x']);
  }

  let gasLimit;
  try {
    const estimated = await provider.estimateGas({ from: fromAddr, to: collection.contract, data });
    // Apply buffer
    gasLimit = estimated * BigInt(Math.floor(gasBuffer * 100)) / 100n;
  } catch (e) {
    // Token would revert — skip it
    return null;
  }

  return {
    chainId,
    nonce,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
    to: collection.contract,
    value: 0n,
    type: 2,
    gasLimit,
    data,
  };
}

// ── EXECUTE CHAIN RESCUE ───────────────────────────────────────────────────────
// The core execution logic — proven with 411 NFTs rescued
export async function executeChainRescue(chainKey, rescueData, compromisedKey, fundingKey, alchemyKey, onProgress) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  const collections = rescueData.chains?.[chain.jsonKey];
  if (!collections || collections.length === 0) {
    throw new Error(`No NFTs for ${chain.name} in rescue data`);
  }

  // Validate keys
  if (!validatePrivateKey(compromisedKey)) {
    throw new Error('Invalid compromised wallet private key');
  }
  if (!validatePrivateKey(fundingKey)) {
    throw new Error('Invalid funding wallet private key');
  }

  const fromAddr = rescueData.rescue_from;
  const toAddr = rescueData.rescue_to;

  if (!fromAddr || !toAddr) {
    throw new Error('rescue_from and rescue_to addresses required');
  }

  const provider = getProvider(chainKey, alchemyKey);
  const compromisedWallet = new ethers.Wallet(compromisedKey, provider);
  const fundingWallet = new ethers.Wallet(fundingKey, provider);

  // Verify compromised key matches rescue_from
  if (compromisedWallet.address.toLowerCase() !== fromAddr.toLowerCase()) {
    throw new Error(`Compromised key resolves to ${compromisedWallet.address} but rescue_from is ${fromAddr}`);
  }

  const progress = (step, message, data = {}) => {
    if (onProgress) onProgress({ step, message, ...data });
  };

  progress('init', 'Initializing rescue...', { chain: chain.name });

  // Get gas estimate (for gas units — we'll price with live fee data below)
  progress('estimate', 'Calculating gas requirements...');
  const estimate = await estimateChainGas(chainKey, rescueData, alchemyKey);

  // Fetch live fee data NOW — this is what the transfers will actually use
  const feeData = await provider.getFeeData();
  const baseFee = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
  const priorityFeeGwei = chain.minPriorityFeeGwei
    ? Math.max(chain.priorityFeeGwei, chain.minPriorityFeeGwei)
    : chain.priorityFeeGwei;
  const priorityFee = ethers.parseUnits(String(priorityFeeGwei), 'gwei');
  const maxFee = baseFee + priorityFee;

  // Calculate required gas using live fee data × gas units from estimate × 2x buffer,
  // plus a flat 0.001 ETH floor. The floor covers contracts whose live gas estimate
  // comes back higher than the planning estimate. Leftover is swept back automatically.
  const FLAT_FLOOR = ethers.parseEther('0.001');
  const totalGasUnits = BigInt(estimate.data.totalGasUnits);
  const requiredGas = (maxFee * totalGasUnits * 2n) + FLAT_FLOOR;

  // Check funding wallet balance
  const fundingBalance = await provider.getBalance(fundingWallet.address);
  if (fundingBalance < requiredGas) {
    throw new Error(`Insufficient funds: need ${ethers.formatEther(requiredGas)} ${chain.nativeSymbol}, have ${ethers.formatEther(fundingBalance)}`);
  }

  progress('estimate', 'Gas estimate complete', {
    tokenCount: estimate.data.tokenCount,
    gasCost: ethers.formatEther(requiredGas / 2n), // show 1x cost, not 2x buffer
    nativeSymbol: chain.nativeSymbol,
  });

  // ── STEP 1: FUND THE COMPROMISED WALLET ──
  progress('funding', `Sending ${ethers.formatEther(requiredGas)} ${chain.nativeSymbol} to compromised wallet...`, {
    mevProtected: chain.mevProtected,
  });

  const fundingNonce = await provider.getTransactionCount(fundingWallet.address, 'latest');
  const fundTx = await fundingWallet.sendTransaction({
    chainId: chain.chainId,
    type: 2,
    to: fromAddr,
    value: requiredGas,
    gasLimit: BigInt(chain.gasForFunding),
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
    nonce: fundingNonce,
  });

  progress('funding', 'Funding transaction sent, waiting for confirmation...', {
    txHash: fundTx.hash,
  });

  await fundTx.wait(1);
  progress('funding', 'Funding confirmed!', { txHash: fundTx.hash, confirmed: true });

  // ── STEP 2: FIRE ALL TRANSFERS ──
  progress('transferring', 'Submitting NFT transfers...', {
    mevProtected: chain.mevProtected,
    note: chain.mevProtected 
      ? 'Transactions hidden from mempool (bot cannot see them)' 
      : 'Using standard RPC — move fast',
  });

  let compromisedNonce = await provider.getTransactionCount(fromAddr, 'latest');
  const sentTxs = [];
  const totalTokens = collections.reduce((s, c) => s + c.tokens.length, 0);
  let sendCount = 0;
  let skipCount = 0;

  for (const coll of collections) {
    for (const token of coll.tokens) {
      const tx = await buildTransferTx(
        provider, coll, token, fromAddr, toAddr, 
        compromisedNonce, maxFee, priorityFee, chain.chainId, chain.gasBuffer
      );

      if (!tx) {
        skipCount++;
        progress('transferring', `Skipped ${token.tokenId} (${coll.collection}) — would revert`, {
          sent: sendCount,
          total: totalTokens,
          skipped: skipCount,
        });
        continue;
      }

      compromisedNonce++;

      try {
        const sent = await compromisedWallet.sendTransaction(tx);
        sentTxs.push({ tx: sent, collection: coll.collection, tokenId: token.tokenId });
        sendCount++;

        progress('transferring', `Submitted ${sendCount}/${totalTokens}...`, {
          sent: sendCount,
          total: totalTokens,
          skipped: skipCount,
          lastTx: sent.hash,
        });

        // Rate limiting: pause every 5 transactions to avoid 429 errors
        if (sendCount % 5 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e) {
        progress('transferring', `Failed ${token.tokenId} (${coll.collection}): ${e.message}`, {
          sent: sendCount,
          total: totalTokens,
          skipped: skipCount,
          error: true,
        });

        // On rate limit, wait longer
        if (e.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }
  }

  progress('transferring', `All transfers submitted (${sendCount} sent, ${skipCount} skipped)`, {
    sent: sendCount,
    total: totalTokens,
    skipped: skipCount,
  });

  // ── STEP 3: WAIT FOR CONFIRMATIONS ──
  progress('confirming', 'Waiting for confirmations...', {
    total: sentTxs.length,
    note: 'Typically 1-3 minutes. Do not close this window.',
  });

  let confirmed = 0;
  let failed = 0;
  const txHashes = [];

  for (const { tx, collection, tokenId } of sentTxs) {
    try {
      const receipt = await tx.wait(1);
      if (receipt && receipt.status === 1) {
        confirmed++;
        txHashes.push(tx.hash);
      } else {
        failed++;
      }

      progress('confirming', `Confirmed ${confirmed}/${sentTxs.length}...`, {
        confirmed,
        failed,
        total: sentTxs.length,
      });
    } catch (e) {
      failed++;
      progress('confirming', `Tx for ${tokenId} (${collection}) may have failed: ${e.message}`, {
        confirmed,
        failed,
        total: sentTxs.length,
        error: true,
      });
    }
  }

  // ── COMPLETE ──
  const success = confirmed === sentTxs.length;
  progress('complete', success ? 'Rescue complete!' : 'Rescue finished with some failures', {
    success,
    confirmed,
    failed,
    skipped: skipCount,
    total: totalTokens,
    destination: toAddr,
    explorer: `${chain.explorer}/address/${toAddr}`,
  });

  return {
    success: true,
    data: {
      status: success ? 'complete' : 'partial',
      chain: chainKey,
      chainName: chain.name,
      fundingTxHash: fundTx.hash,
      submitted: sendCount,
      confirmed,
      failed,
      skipped: skipCount,
      txHashes,
      destination: toAddr,
      explorer: `${chain.explorer}/address/${toAddr}`,
    }
  };
}

// ── ETH SWEEP ──────────────────────────────────────────────────────────────────
// Sweeps remaining ETH from compromised wallet to destination
export async function sweepETH(fromKey, toAddress, chainKey, alchemyKey) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  if (!validatePrivateKey(fromKey)) {
    throw new Error('Invalid private key');
  }

  const validTo = validateAddress(toAddress);
  if (!validTo) {
    throw new Error('Invalid destination address');
  }

  const provider = getProvider(chainKey, alchemyKey);
  const wallet = new ethers.Wallet(fromKey, provider);

  const balance = await provider.getBalance(wallet.address);
  if (balance === 0n) {
    throw new Error('Wallet has no balance to sweep');
  }

  const feeData = await provider.getFeeData();
  const maxFee = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
  // Cap priorityFee to maxFee — EIP-1559 rejects if priorityFee > maxFee,
  // which happens on ETH when gas is extremely low (e.g. 0.06 gwei base fee).
  const priorityFeeRaw = ethers.parseUnits(String(chain.priorityFeeGwei), 'gwei');
  const priorityFee = priorityFeeRaw < maxFee ? priorityFeeRaw : maxFee;
  const gasLimit = 21000n;
  const gasCost = maxFee * gasLimit;

  if (balance <= gasCost) {
    throw new Error(`Balance (${ethers.formatEther(balance)}) is less than gas cost (${ethers.formatEther(gasCost)})`);
  }

  const sweepAmount = balance - gasCost;

  const tx = await wallet.sendTransaction({
    chainId: chain.chainId,
    type: 2,
    to: validTo,
    value: sweepAmount,
    gasLimit,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
  });

  await tx.wait(1);

  return {
    success: true,
    data: {
      txHash: tx.hash,
      amount: ethers.formatEther(sweepAmount),
      nativeSymbol: chain.nativeSymbol,
      from: wallet.address,
      to: validTo,
      explorer: `${chain.explorer}/tx/${tx.hash}`,
    }
  };
}

// ── QUIET FUND ─────────────────────────────────────────────────────────────────
// Sends a specific amount from funding wallet to a destination wallet.
// On Ethereum mainnet, uses MEV Blocker (private mempool) automatically via
// the chain's RPC config. On other chains, uses standard RPC — no stealth mode.
// Used for: funding gas to a compromised wallet so the user can manually sign
// transactions on third-party sites (ENS, unstake contracts, etc.) without
// the bundled NFT-rescue flow.
export async function quietFund(fromKey, toAddress, amountEth, chainKey, alchemyKey) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  if (!validatePrivateKey(fromKey)) {
    throw new Error('Invalid funding wallet private key');
  }

  const validTo = validateAddress(toAddress);
  if (!validTo) {
    throw new Error('Invalid destination address');
  }

  // Parse the requested amount. ethers.parseEther throws on invalid input
  // (e.g. negative numbers, non-numeric strings, too many decimal places).
  let value;
  try {
    value = ethers.parseEther(String(amountEth));
  } catch (err) {
    throw new Error(`Invalid amount: ${amountEth}. Must be a positive number like 0.005`);
  }
  if (value <= 0n) {
    throw new Error('Amount must be greater than zero');
  }

  const provider = getProvider(chainKey, alchemyKey);
  const wallet = new ethers.Wallet(fromKey, provider);

  // Verify funding wallet has enough to send + cover its own gas
  const balance = await provider.getBalance(wallet.address);
  const feeData = await provider.getFeeData();
  const maxFee = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
  const priorityFeeRaw = ethers.parseUnits(String(chain.priorityFeeGwei), 'gwei');
  const priorityFee = priorityFeeRaw < maxFee ? priorityFeeRaw : maxFee;
  const gasLimit = 21000n;
  const gasCost = maxFee * gasLimit;
  const totalRequired = value + gasCost;

  if (balance < totalRequired) {
    throw new Error(
      `Funding wallet has ${ethers.formatEther(balance)} ${chain.nativeSymbol}, ` +
      `needs ${ethers.formatEther(totalRequired)} ${chain.nativeSymbol} ` +
      `(${ethers.formatEther(value)} to send + ${ethers.formatEther(gasCost)} for gas).`
    );
  }

  const tx = await wallet.sendTransaction({
    chainId: chain.chainId,
    type: 2,
    to: validTo,
    value,
    gasLimit,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
  });

  await tx.wait(1);

  return {
    success: true,
    data: {
      txHash: tx.hash,
      amount: ethers.formatEther(value),
      nativeSymbol: chain.nativeSymbol,
      from: wallet.address,
      to: validTo,
      chain: chainKey,
      mevProtected: chain.mevProtected,
      explorer: `${chain.explorer}/tx/${tx.hash}`,
    }
  };
}

// ── MANIFOLD OWNERSHIP TRANSFER ────────────────────────────────────────────────
export async function transferManifoldOwnership(contractAddress, newOwner, privateKey, alchemyKey) {
  const validContract = validateAddress(contractAddress);
  const validOwner = validateAddress(newOwner);
  
  if (!validContract) throw new Error('Invalid contract address');
  if (!validOwner) throw new Error('Invalid new owner address');
  if (!validatePrivateKey(privateKey)) throw new Error('Invalid private key');

  const provider = getProvider('eth', alchemyKey);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(validContract, MANIFOLD_ABI, wallet);

  // Verify current ownership
  const currentOwner = await contract.owner();
  if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`You are not the owner. Current owner: ${currentOwner}`);
  }

  const feeData = await provider.getFeeData();
  const maxFee = feeData.maxFeePerGas;
  const priorityFee = ethers.parseUnits('1', 'gwei');

  const txs = [];

  // 1. Transfer ownership
  const tx1 = await contract.transferOwnership(validOwner, {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
    type: 2,
  });
  await tx1.wait(1);
  txs.push({ action: 'transferOwnership', hash: tx1.hash });

  // 2. Approve admin
  const tx2 = await contract.approveAdmin(validOwner, {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
    type: 2,
  });
  await tx2.wait(1);
  txs.push({ action: 'approveAdmin', hash: tx2.hash });

  // 3. Set royalties (10%)
  const tx3 = await contract.setRoyalties([validOwner], [1000], {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
    type: 2,
  });
  await tx3.wait(1);
  txs.push({ action: 'setRoyalties', hash: tx3.hash });

  return {
    success: true,
    data: {
      contract: validContract,
      newOwner: validOwner,
      transactions: txs,
      explorer: `https://etherscan.io/address/${validContract}`,
    }
  };
}

// ── ALL-CHAIN BALANCE CHECK ───────────────────────────────────────────────────
export async function getAllBalances(privateKeyOrAddress, alchemyKey) {
  let address;

  // Accept either a private key or a plain public address
  if (privateKeyOrAddress.startsWith('0x') && privateKeyOrAddress.length === 42) {
    // It's a public address — read-only scan, no wallet needed
    address = ethers.getAddress(privateKeyOrAddress);
  } else {
    // It's a private key — derive address as before
    if (!validatePrivateKey(privateKeyOrAddress)) throw new Error('Invalid private key or address');
    const wallet = new ethers.Wallet(privateKeyOrAddress);
    address = wallet.address;
  }

  const balances = [];

  for (const [chainKey, chain] of Object.entries(CHAINS)) {
    try {
      const provider = getProvider(chainKey, alchemyKey);
      const balance = await provider.getBalance(address);
      balances.push({
        chain: chainKey,
        name: chain.name,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
        symbol: chain.nativeSymbol,
        mevProtected: chain.mevProtected,
      });
    } catch (e) {
      balances.push({
        chain: chainKey,
        name: chain.name,
        balance: '0',
        balanceWei: '0',
        symbol: chain.nativeSymbol,
        error: e.message,
      });
    }
  }

  return { success: true, data: { address, balances } };
}

// ── ERC-20 TOKEN SCANNING ────────────────────────────────────────────────────
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
];

export async function scanAllTokens(privateKey, alchemyKey) {
  if (!validatePrivateKey(privateKey)) throw new Error('Invalid private key');
  if (!alchemyKey) throw new Error('Alchemy key required');

  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;

  const chainConfigs = [
    { key: 'eth', jsonKey: 'eth-mainnet', name: 'Ethereum' },
    { key: 'apechain', jsonKey: 'apechain-mainnet', name: 'ApeChain' },
    { key: 'base', jsonKey: 'base-mainnet', name: 'Base' },
    { key: 'arbitrum', jsonKey: 'arb-mainnet', name: 'Arbitrum' },
    { key: 'optimism', jsonKey: 'opt-mainnet', name: 'Optimism' },
    { key: 'avalanche', jsonKey: 'avax-mainnet', name: 'Avalanche' },
    { key: 'polygon', jsonKey: 'polygon-mainnet', name: 'Polygon' },
  ];

  const tokens = [];

  await Promise.all(chainConfigs.map(async (cfg) => {
    try {
      const url = `https://${cfg.jsonKey}.g.alchemy.com/v2/${alchemyKey}`;
      const data = await alchemyFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [address, 'erc20']
        })
      });
      const balances = data.result?.tokenBalances || [];

      for (const tb of balances) {
        if (tb.tokenBalance === '0x0000000000000000000000000000000000000000000000000000000000000000') continue;
        if (tb.tokenBalance === '0x') continue;

        // Get token metadata
        try {
          const metaData = await alchemyFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'alchemy_getTokenMetadata',
              params: [tb.contractAddress]
            })
          });
          const meta = metaData.result || {};
          const decimals = meta.decimals || 18;
          const rawBalance = BigInt(tb.tokenBalance);
          const balance = Number(rawBalance) / Math.pow(10, decimals);

          if (balance > 0) {
            tokens.push({
              chain: cfg.key,
              chainName: cfg.name,
              contract: tb.contractAddress,
              symbol: meta.symbol || '???',
              name: meta.name || 'Unknown Token',
              decimals,
              balance: balance.toString(),
              balanceRaw: rawBalance.toString(),
            });
          }
        } catch (e) {
          // Skip tokens we can't get metadata for
        }
      }
    } catch (e) {
      // Chain failed, continue with others
    }
  }));

  // Sort by balance value descending
  tokens.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

  return { success: true, data: { address, tokens } };
}

// ── ERC-20 TOKEN SWEEP ──────────────────────────────────────────────────────
export async function sweepToken(fromKey, toAddress, chainKey, tokenContract, alchemyKey) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);
  if (!validatePrivateKey(fromKey)) throw new Error('Invalid private key');
  const validTo = validateAddress(toAddress);
  if (!validTo) throw new Error('Invalid destination address');
  const validToken = validateAddress(tokenContract);
  if (!validToken) throw new Error('Invalid token contract');

  const provider = getProvider(chainKey, alchemyKey);
  const wallet = new ethers.Wallet(fromKey, provider);
  const contract = new ethers.Contract(validToken, ERC20_ABI, wallet);

  const balance = await contract.balanceOf(wallet.address);
  if (balance === 0n) throw new Error('Token balance is zero');

  // Check native gas balance before attempting sweep — gives a human error instead of RPC rejection
  const nativeBalance = await provider.getBalance(wallet.address);
  if (nativeBalance === 0n) {
    const nativeSymbol = chain.nativeSymbol || 'native token';
    throw new Error(
      `No gas on ${chain.name}. Send a small amount of ${nativeSymbol} to the compromised wallet first, then retry the sweep.`
    );
  }

  let symbol = '???';
  try { symbol = await contract.symbol(); } catch(e) {}

  const feeData = await provider.getFeeData();
  const maxFee = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
  const priorityFee = ethers.parseUnits(String(chain.priorityFeeGwei), 'gwei');

  const tx = await contract.transfer(validTo, balance, {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
    type: 2,
  });

  await tx.wait(1);

  let decimals = 18;
  try { decimals = await contract.decimals(); } catch(e) {}
  const amount = Number(balance) / Math.pow(10, decimals);

  return {
    success: true,
    data: {
      txHash: tx.hash,
      amount: amount.toString(),
      symbol,
      from: wallet.address,
      to: validTo,
      explorer: `${chain.explorer}/tx/${tx.hash}`,
    }
  };
}

// ── FRACTAL VISIONS ───────────────────────────────────────────────────────────
const FRACTAL_LAUNCHPAD_ADDRESS = '0x7A10b7d6Dc513Ae5F98f2C1546269Be9DE94ebD3';

const FRACTAL_LAUNCHPAD_ABI = [
  'function getERC721sByCreator(address creator) view returns (address[])',
  'function getERC1155sByCreator(address creator) view returns (address[])',
];

// ERC721 ABI — totalSupply() takes no args (selector 0x18160ddd)
const FRACTAL_ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function getLicenseName() view returns (string)',
  'function transferOwnership(address newOwner)',
];

// ERC1155 ABI — totalSupply(uint256) takes a tokenId (selector 0xbd85b039)
const FRACTAL_ERC1155_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply(uint256 id) view returns (uint256)',
  'function owner() view returns (address)',
  'function getLicenseName() view returns (string)',
  'function transferOwnership(address newOwner)',
];

export async function scanFractalCollections(walletAddress, chainKeys, alchemyKey) {
  const validAddress = validateAddress(walletAddress);
  if (!validAddress) throw new Error('Invalid wallet address');

  // Accept a single chain string or an array of chains
  const chains = Array.isArray(chainKeys) ? chainKeys : [chainKeys];

  const allCollections = [];
  const chainErrors = [];

  await Promise.all(chains.map(async (chainKey) => {
    const chain = CHAINS[chainKey];
    if (!chain) {
      chainErrors.push({ chain: chainKey, error: 'Unknown chain' });
      return;
    }

    try {
      const provider = getProvider(chainKey, alchemyKey);
      const launchpad = new ethers.Contract(FRACTAL_LAUNCHPAD_ADDRESS, FRACTAL_LAUNCHPAD_ABI, provider);

      const [erc721s, erc1155s] = await Promise.all([
        launchpad.getERC721sByCreator(validAddress).catch(() => []),
        launchpad.getERC1155sByCreator(validAddress).catch(() => []),
      ]);

      const fetchDetails = async (contractAddress, tokenType) => {
        try {
          // Use correct ABI per type — ERC1155 totalSupply(uint256) vs ERC721 totalSupply()
          const abi = tokenType === 'ERC721' ? FRACTAL_ERC721_ABI : FRACTAL_ERC1155_ABI;
          const coll = new ethers.Contract(contractAddress, abi, provider);

          const [name, symbol, owner, licenseName] = await Promise.all([
            coll.name().catch(() => 'Unknown'),
            coll.symbol().catch(() => '???'),
            coll.owner().catch(() => ''),
            coll.getLicenseName().catch(() => '—'),
          ]);

          let totalSupply = '—';
          try {
            if (tokenType === 'ERC721') {
              const ts = await coll.totalSupply();
              totalSupply = ts.toString();
            } else {
              const ts = await coll.totalSupply(0);
              totalSupply = ts.toString();
            }
          } catch (e) {}

          allCollections.push({
            contract: contractAddress,
            tokenType,
            name,
            symbol,
            totalSupply,
            owner,
            licenseName,
            chain: chainKey,
            chainName: chain.name,
            explorer: `${chain.explorer}/address/${contractAddress}`,
          });
        } catch (e) {
          // Skip contracts we can't read
        }
      };

      await Promise.all([
        ...erc721s.map(addr => fetchDetails(addr, 'ERC721')),
        ...erc1155s.map(addr => fetchDetails(addr, 'ERC1155')),
      ]);
    } catch (e) {
      chainErrors.push({ chain: chainKey, error: e.message });
    }
  }));

  return {
    success: true,
    data: {
      wallet: validAddress,
      collections: allCollections,
      total: allCollections.length,
      chainErrors, // surface errors so UI can show what failed
    }
  };
}

export async function transferFractalOwnership(contractAddress, newOwner, privateKey, chainKey, alchemyKey) {
  const validContract = validateAddress(contractAddress);
  const validOwner = validateAddress(newOwner);

  if (!validContract) throw new Error('Invalid contract address');
  if (!validOwner) throw new Error('Invalid new owner address');
  if (!validatePrivateKey(privateKey)) throw new Error('Invalid private key');

  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  const provider = getProvider(chainKey, alchemyKey);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(validContract, FRACTAL_ERC721_ABI, wallet);

  // Verify caller is actually the owner
  const currentOwner = await contract.owner();
  if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`You are not the owner of this contract. Current owner: ${currentOwner}`);
  }

  const feeData = await provider.getFeeData();
  const maxFee = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
  const priorityFeeGwei = chain.minPriorityFeeGwei
    ? Math.max(chain.priorityFeeGwei, chain.minPriorityFeeGwei)
    : chain.priorityFeeGwei;
  const priorityFee = ethers.parseUnits(String(priorityFeeGwei), 'gwei');

  const tx = await contract.transferOwnership(validOwner, {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee,
    type: 2,
  });

  await tx.wait(1);

  return {
    success: true,
    data: {
      contract: validContract,
      newOwner: validOwner,
      txHash: tx.hash,
      chain: chainKey,
      chainName: chain.name,
      explorer: `${chain.explorer}/tx/${tx.hash}`,
    }
  };
}

// ── EXPORTS ────────────────────────────────────────────────────────────────────
// ── FRACTAL VISIONS — COLLECTOR NFT SCAN (Blockscout) ─────────────────────────
// Uses Blockscout REST API to find NFTs on the 4 Superchain chains Alchemy doesn't cover.
// All 4 chains run Blockscout with the same /api/v2/addresses/{wallet}/nft endpoint.

const FV_BLOCKSCOUT_CHAINS = [
  { key: 'soneium',   name: 'Soneium',   baseUrl: 'https://soneium.blockscout.com',  explorer: 'https://soneium.blockscout.com'  },
  { key: 'shape',     name: 'Shape',     baseUrl: 'https://shapescan.xyz',            explorer: 'https://shapescan.xyz'            },
  { key: 'superseed', name: 'Superseed', baseUrl: 'https://explorer.superseed.xyz',   explorer: 'https://explorer.superseed.xyz'   },
  { key: 'unichain',  name: 'Unichain',  baseUrl: 'https://unichain.blockscout.com',  explorer: 'https://unichain.blockscout.com'  },
];

// ── BLOCKSCOUT RETRY WRAPPER ─────────────────────────────────────────────────
// Same pattern as alchemyFetch: retry 3x with exponential backoff on 429/5xx.
// Blockscout public instances are unauthenticated and rate-limit aggressively.
async function blockscoutFetch(url) {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 30000;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) return await response.json();

      if (response.status === 429 || response.status >= 500) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.warn(`  ⚠ blockscoutFetch: HTTP ${response.status} — retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`);
        lastError = { httpStatus: response.status, attempt, url: url.split('?')[0] };
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
      }

      throw { blockscoutError: true, httpStatus: response.status, message: `HTTP ${response.status}`, url: url.split('?')[0] };
    } catch (e) {
      if (e.name === 'AbortError') {
        console.warn(`  ⚠ blockscoutFetch: timeout (${TIMEOUT_MS}ms) — retry ${attempt + 1}/${MAX_RETRIES}`);
        lastError = { httpStatus: 0, message: 'Timeout', attempt, url: url.split('?')[0] };
        if (attempt < MAX_RETRIES) {
          const waitMs = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
      }
      if (e.blockscoutError) throw e;
      lastError = { httpStatus: 0, message: e.message, attempt, url: url.split('?')[0] };
      if (attempt < MAX_RETRIES) {
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
    }
  }

  throw { blockscoutError: true, httpStatus: lastError?.httpStatus || 0, message: `Failed after ${MAX_RETRIES} retries: ${lastError?.message}`, url: url.split('?')[0] };
}

export async function scanFractalNFTs(walletAddress) {
  const validAddress = validateAddress(walletAddress);
  if (!validAddress) throw new Error('Invalid wallet address');

  const allNFTs = [];
  const chainErrors = [];

  await Promise.all(FV_BLOCKSCOUT_CHAINS.map(async (chain) => {
    try {
      const url = `${chain.baseUrl}/api/v2/addresses/${validAddress}/nft?type=ERC-721,ERC-1155`;
      const data = await blockscoutFetch(url);
      const items = data.items || [];

      // Group by collection contract — same pattern as scanAllChains
      const collections = {};
      for (const item of items) {
        const contract = item.token?.address_hash;
        if (!contract) continue;

        if (!collections[contract]) {
          collections[contract] = {
            collection: item.token?.name || 'Unknown Collection',
            contract,
            token_type: item.token?.type?.replace('-', '') || 'ERC721', // normalize ERC-721 → ERC721
            chain: chain.key,
            chainName: chain.name,
            explorer: `${chain.explorer}/address/${contract}`,
            tokens: [],
          };
        }

        collections[contract].tokens.push({
          tokenId: item.id,
          name: item.metadata?.name || `#${item.id}`,
          image: item.image_url || item.media_url || '',
          balance: parseInt(item.value) || 1,
        });
      }

      allNFTs.push(...Object.values(collections));
    } catch (e) {
      chainErrors.push({ chain: chain.key, error: e.message });
    }
  }));

  return {
    success: true,
    data: {
      wallet: validAddress,
      collections: allNFTs,
      total: allNFTs.reduce((sum, c) => sum + c.tokens.length, 0),
      chainErrors,
    }
  };
}

export default {
  CHAINS,
  scanAllChains,
  estimateChainGas,
  getBalances,
  getAllBalances,
  scanAllTokens,
  sweepToken,
  executeChainRescue,
  sweepETH,
  quietFund,
  transferManifoldOwnership,
  scanFractalCollections,
  transferFractalOwnership,
  scanFractalNFTs,
  validateAddress,
  validatePrivateKey,
};

// Named exports for markv-engine.js
// CHAINS is already exported as: export const CHAINS = { ... } at the top
// Only validateAddress and validatePrivateKey need to be added here
export { validateAddress, validatePrivateKey };
