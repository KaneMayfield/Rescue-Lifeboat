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
  // Polygon needs Alchemy key appended
  if (chainKey === 'polygon' && alchemyKey) {
    rpc = `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }

  // MEV Blocker doesn't respond to eth_chainId probes — specify network statically
  // to prevent "failed to detect network" retry loops on every call.
  if (rpc.includes('mevblocker.io')) {
    return new ethers.JsonRpcProvider(rpc, { chainId: chain.chainId, name: chain.name }, { staticNetwork: true });
  }

  return new ethers.JsonRpcProvider(rpc);
}

export function validateAddress(addr) {
  try {
    return ethers.getAddress(addr);
  } catch {
    return null;
  }
}

export function validatePrivateKey(key) {
  try {
    new ethers.Wallet(key);
    return true;
  } catch {
    return false;
  }
}

// ── SCANNING ───────────────────────────────────────────────────────────────────
// Uses Alchemy NFT API to scan all chains simultaneously
export async function scanAllChains(wallet, alchemyKey) {
  const validWallet = validateAddress(wallet);
  if (!validWallet) throw new Error('Invalid wallet address');
  if (!alchemyKey) throw new Error('Alchemy API key required');

  const chainConfigs = [
    { key: 'eth-mainnet', url: `https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${validWallet}&withMetadata=true&pageSize=100` },
    { key: 'polygon-mainnet', url: `https://polygon-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${validWallet}&withMetadata=true&pageSize=100` },
    { key: 'base-mainnet', url: `https://base-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${validWallet}&withMetadata=true&pageSize=100` },
    { key: 'opt-mainnet', url: `https://opt-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${validWallet}&withMetadata=true&pageSize=100` },
    { key: 'avax-mainnet', url: `https://avax-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${validWallet}&withMetadata=true&pageSize=100` },
  ];

  const results = { rescue_from: validWallet, chains: {} };
  const errors = [];

  await Promise.all(chainConfigs.map(async ({ key, url }) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push({ chain: key, error: `HTTP ${response.status}` });
        return;
      }
      
      const data = await response.json();
      const nfts = data.ownedNfts || [];
      
      if (nfts.length === 0) {
        results.chains[key] = [];
        return;
      }

      // Group by collection
      const collections = {};
      for (const nft of nfts) {
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
    } catch (e) {
      errors.push({ chain: key, error: e.message });
    }
  }));

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
    { key: 'polygon', jsonKey: 'polygon-mainnet', name: 'Polygon' },
    { key: 'base', jsonKey: 'base-mainnet', name: 'Base' },
    { key: 'optimism', jsonKey: 'opt-mainnet', name: 'Optimism' },
    { key: 'avalanche', jsonKey: 'avax-mainnet', name: 'Avalanche' },
  ];

  const tokens = [];

  await Promise.all(chainConfigs.map(async (cfg) => {
    try {
      const url = `https://${cfg.jsonKey}.g.alchemy.com/v2/${alchemyKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [address, 'erc20']
        })
      });
      const data = await response.json();
      const balances = data.result?.tokenBalances || [];

      for (const tb of balances) {
        if (tb.tokenBalance === '0x0000000000000000000000000000000000000000000000000000000000000000') continue;
        if (tb.tokenBalance === '0x') continue;

        // Get token metadata
        try {
          const metaRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'alchemy_getTokenMetadata',
              params: [tb.contractAddress]
            })
          });
          const metaData = await metaRes.json();
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

// ── EXPORTS ────────────────────────────────────────────────────────────────────
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
  transferManifoldOwnership,
  validateAddress,
  validatePrivateKey,
};
