/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LIFEBOAT V10 — Emblem Vault Rescue Engine                        ║
 * ║  Scan, rescue, inspect, and prove ownership of Emblem Vaults      ║
 * ║  by Kane Mayfield · kanemayfield.com                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { ethers } from 'ethers';

// ── EMBLEM VAULT CONTRACTS ────────────────────────────────────────────────────
export const EMBLEM_V2_ADDRESS = '0x82C7a8f707110f5FBb16184A5933E9F78a34c6ab';
export const EMBLEM_LEGACY_ADDRESS = '0x6Fc355D4e0EE44b292E50878F49798ff755A5bbC';
const VAULT_CONTRACTS = [EMBLEM_V2_ADDRESS, EMBLEM_LEGACY_ADDRESS];

const CONTRACT_NAMES = {
  [EMBLEM_V2_ADDRESS.toLowerCase()]: 'Emblem Vault V2',
  [EMBLEM_LEGACY_ADDRESS.toLowerCase()]: 'Emblem Vault Legacy',
};

// ── ABI FRAGMENTS ─────────────────────────────────────────────────────────────
const EMBLEM_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function totalSupply() view returns (uint256)',
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
// Matches engine.js getProvider pattern exactly for MEV Blocker
function getEthProvider() {
  return new ethers.JsonRpcProvider(
    'https://rpc.mevblocker.io',
    { chainId: 1, name: 'Ethereum Mainnet' },
    { staticNetwork: true }
  );
}

function getAlchemyProvider(alchemyKey) {
  return new ethers.JsonRpcProvider(
    `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
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

/**
 * Decode tokenURI — Emblem returns data:application/json;base64,...
 * Strip the prefix, decode base64, parse JSON.
 */
function decodeTokenURI(uri) {
  if (!uri) return null;

  // Handle data URI (base64-encoded JSON)
  if (uri.startsWith('data:')) {
    const commaIdx = uri.indexOf(',');
    if (commaIdx === -1) return null;
    const b64 = uri.slice(commaIdx + 1);
    try {
      const json = Buffer.from(b64, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  // Handle IPFS or HTTP URIs — return raw for the caller to fetch if needed
  return { _uri: uri, _needsFetch: true };
}

/**
 * Extract "Contained Assets" from metadata attributes array.
 */
function extractContainedAssets(metadata) {
  if (!metadata || !metadata.attributes) return '';
  const attr = metadata.attributes.find(
    a => a.trait_type === 'Contained Assets'
  );
  return attr ? attr.value : '';
}


// ── SCANNING ──────────────────────────────────────────────────────────────────

// Curated collections API endpoint — returns live list of all Emblem contracts
const EMBLEM_CURATED_API = 'https://v2.emblemvault.io/curated';
const EMBLEM_MYVAULTS_API = 'https://v2.emblemvault.io/myvaults';

/**
 * fetchCuratedContracts()
 * Fetches the live curated contract list from Emblem's API.
 * Returns array of { address, name, standard } for Ethereum mainnet.
 */
async function fetchCuratedContracts() {
  try {
    const res = await fetch(EMBLEM_CURATED_API);
    if (!res.ok) return [];
    const curated = await res.json();
    const CHAIN_ID = '1'; // Ethereum mainnet
    return curated
      .filter(c => c.contracts && c.contracts[CHAIN_ID])
      .map(c => ({
        address: c.contracts[CHAIN_ID],
        name: c.name || 'Emblem Curated',
        standard: c.collectionType || 'ERC-1155',
      }));
  } catch {
    return [];
  }
}

/**
 * scanEmblemVaults(walletAddress, alchemyKey)
 *
 * Primary: Uses Emblem Vault's own /myvaults API — contract-agnostic,
 * returns all vaults across ALL Emblem systems including curated collections.
 *
 * Fallback: Scans V2 and Legacy contracts via Alchemy if the primary API
 * returns no results or fails.
 *
 * This fixes the missing Rare Pepe / curated ERC-1155 issue where Alchemy's
 * contract-filtered getNFTsForOwner silently missed ERC-1155 vaults.
 */
export async function scanEmblemVaults(walletAddress, alchemyKey) {
  const validWallet = validateAddress(walletAddress);
  if (!validWallet) throw new Error('Invalid wallet address');
  if (!alchemyKey) throw new Error('Alchemy API key required');

  const vaults = [];

  // ── PRIMARY: Emblem's own myvaults API ────────────────────────────────────
  try {
    const url = `${EMBLEM_MYVAULTS_API}/${validWallet}?vaultType=vaulted`;
    const res = await fetch(url);

    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.vaults || data.items || []);

      for (const item of items) {
        // Normalize fields from Emblem API response
        const contractAddr = item.contract || item.contractAddress || EMBLEM_V2_ADDRESS;
        const contractName = CONTRACT_NAMES[contractAddr.toLowerCase()] || item.collectionName || 'Emblem Vault';

        // Extract contained assets from attributes
        let containedAssets = '';
        if (item.attributes) {
          containedAssets = extractContainedAssets({ attributes: item.attributes });
        } else if (item.containedAssets) {
          containedAssets = item.containedAssets;
        }

        vaults.push({
          contract: contractAddr,
          contractName,
          tokenId: String(item.tokenId || item.id || ''),
          name: item.name || `Vault #${item.tokenId}`,
          image: item.image || item.imageUrl || item.cachedImage || '',
          description: item.description || '',
          containedAssets,
          rawMetadata: item,
          source: 'emblem-api',
        });
      }
    }
  } catch {
    // Primary API failed — fall through to Alchemy fallback
  }

  // ── FALLBACK: Alchemy scan if primary returned nothing ────────────────────
  if (vaults.length === 0) {
    // Fetch live curated contract list + hardcoded V2/Legacy
    const curatedContracts = await fetchCuratedContracts();
    const allContracts = [
      { address: EMBLEM_V2_ADDRESS, name: 'Emblem Vault V2', standard: 'ERC-721' },
      { address: EMBLEM_LEGACY_ADDRESS, name: 'Emblem Vault Legacy', standard: 'ERC-721' },
      ...curatedContracts,
    ];

    const provider = getAlchemyProvider(alchemyKey);

    await Promise.all(allContracts.map(async ({ address: contractAddr, name: contractName }) => {
      try {
        const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${validWallet}&contractAddresses[]=${contractAddr}&withMetadata=true&pageSize=100`;
        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();
        const nfts = data.ownedNfts || [];
        if (nfts.length === 0) return;

        const contract = new ethers.Contract(contractAddr, EMBLEM_ABI, provider);

        for (const nft of nfts) {
          const tokenId = nft.tokenId;

          let metadata = null;
          let containedAssets = '';
          try {
            const uri = await contract.tokenURI(tokenId);
            metadata = decodeTokenURI(uri);
            if (metadata && !metadata._needsFetch) {
              containedAssets = extractContainedAssets(metadata);
            }
          } catch {
            // tokenURI may fail on ERC-1155 — fall back to Alchemy metadata
          }

          if (!metadata || metadata._needsFetch) {
            const alchemyMeta = nft.raw?.metadata || {};
            metadata = alchemyMeta;
            containedAssets = extractContainedAssets(alchemyMeta);
          }

          vaults.push({
            contract: contractAddr,
            contractName,
            tokenId,
            name: metadata?.name || nft.name || `Vault #${tokenId}`,
            image: metadata?.image || nft.image?.cachedUrl || nft.image?.originalUrl || '',
            description: metadata?.description || nft.description || '',
            containedAssets,
            rawMetadata: metadata,
            source: 'alchemy-fallback',
          });
        }
      } catch {
        // Contract scan failed — skip silently
      }
    }));
  }

  return {
    success: true,
    data: {
      wallet: validWallet,
      vaults,
      totalFound: vaults.length,
    }
  };
}


// ── GAS ESTIMATION ────────────────────────────────────────────────────────────
/**
 * estimateEmblemRescueGas(vaultTokenIds, fromAddress, toAddress, alchemyKey)
 *
 * vaultTokenIds: array of { contract, tokenId }
 * Estimates gas for safeTransferFrom on each vault token via MEV Blocker RPC.
 * Return shape mirrors engine.js estimateChainGas.
 */
export async function estimateEmblemRescueGas(vaultTokenIds, fromAddress, toAddress, alchemyKey) {
  const validFrom = validateAddress(fromAddress);
  const validTo = validateAddress(toAddress);
  if (!validFrom) throw new Error('Invalid FROM address');
  if (!validTo) throw new Error('Invalid TO address');

  const provider = getEthProvider();
  const iface = new ethers.Interface(EMBLEM_ABI);

  let feeData;
  try {
    feeData = await provider.getFeeData();
  } catch {
    feeData = { maxFeePerGas: ethers.parseUnits('20', 'gwei') };
  }
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');

  let totalGas = 21000n; // Funding transaction
  const tokenDetails = [];
  const gasBuffer = 1.25;

  for (const { contract, tokenId } of vaultTokenIds) {
    const data = iface.encodeFunctionData('safeTransferFrom', [validFrom, validTo, tokenId]);
    try {
      const gasEstimate = await provider.estimateGas({
        from: validFrom,
        to: contract,
        data,
      });
      const buffered = gasEstimate * BigInt(Math.floor(gasBuffer * 100)) / 100n;
      totalGas += buffered;
      tokenDetails.push({ tokenId, contract, gasEstimate: buffered.toString(), willTransfer: true });
    } catch {
      // Token would revert — already moved, burned, or restricted
      tokenDetails.push({ tokenId, contract, gasEstimate: '0', willTransfer: false, reason: 'Would revert (already moved or restricted)' });
    }
  }

  const gasCost = gasPrice * totalGas;
  const gasCostBuffered = gasCost * BigInt(Math.floor(gasBuffer * 100)) / 100n;

  return {
    success: true,
    data: {
      chain: 'eth',
      chainName: 'Ethereum Mainnet',
      tokenCount: tokenDetails.filter(t => t.willTransfer).length,
      totalGasUnits: totalGas.toString(),
      gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
      totalCostNative: ethers.formatEther(gasCostBuffered),
      nativeSymbol: 'ETH',
      mevProtected: true,
      tokenDetails,
    }
  };
}


// ── EXECUTE RESCUE ────────────────────────────────────────────────────────────
/**
 * executeEmblemRescue(vaultTokenIds, compromisedKey, fundingKey, toAddress, alchemyKey, onProgress)
 *
 * Identical execution pattern to executeChainRescue in engine.js.
 * Uses MEV Blocker RPC for all transactions.
 */
export async function executeEmblemRescue(vaultTokenIds, compromisedKey, fundingKey, toAddress, alchemyKey, onProgress) {
  // Validate keys
  if (!validatePrivateKey(compromisedKey)) throw new Error('Invalid compromised wallet private key');
  if (!validatePrivateKey(fundingKey)) throw new Error('Invalid funding wallet private key');
  const validTo = validateAddress(toAddress);
  if (!validTo) throw new Error('Invalid destination address');

  const provider = getEthProvider();
  const compromisedWallet = new ethers.Wallet(compromisedKey, provider);
  const fundingWallet = new ethers.Wallet(fundingKey, provider);
  const fromAddr = compromisedWallet.address;

  const progress = (step, message, data = {}) => {
    if (onProgress) onProgress({ step, message, ...data });
  };

  progress('init', 'Initializing Emblem Vault rescue...', { chain: 'Ethereum Mainnet' });

  // Filter to transferable vaults only
  const transferable = vaultTokenIds.filter(v => v.willTransfer !== false);
  if (transferable.length === 0) throw new Error('No transferable vaults selected');

  // Gas estimate
  progress('estimate', 'Calculating gas requirements...');
  const estimate = await estimateEmblemRescueGas(transferable, fromAddr, validTo, alchemyKey);

  // Live fee data
  const feeData = await provider.getFeeData();
  const baseFee = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
  const priorityFee = ethers.parseUnits('0.5', 'gwei');
  const maxFee = baseFee + priorityFee;

  // Required gas — same formula as engine.js
  const FLAT_FLOOR = ethers.parseEther('0.001');
  const totalGasUnits = BigInt(estimate.data.totalGasUnits);
  const requiredGas = (maxFee * totalGasUnits * 2n) + FLAT_FLOOR;

  // Check funding balance
  const fundingBalance = await provider.getBalance(fundingWallet.address);
  if (fundingBalance < requiredGas) {
    throw new Error(`Insufficient funds: need ${ethers.formatEther(requiredGas)} ETH, have ${ethers.formatEther(fundingBalance)}`);
  }

  progress('estimate', 'Gas estimate complete', {
    tokenCount: estimate.data.tokenCount,
    gasCost: ethers.formatEther(requiredGas / 2n),
    nativeSymbol: 'ETH',
  });

  // ── STEP 1: FUND THE COMPROMISED WALLET ──
  progress('funding', `Sending ${ethers.formatEther(requiredGas)} ETH to compromised wallet...`, {
    mevProtected: true,
  });

  const fundingNonce = await provider.getTransactionCount(fundingWallet.address, 'latest');
  const fundTx = await fundingWallet.sendTransaction({
    chainId: 1,
    type: 2,
    to: fromAddr,
    value: requiredGas,
    gasLimit: 21000n,
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
  progress('transferring', 'Submitting vault transfers via MEV Blocker...', {
    mevProtected: true,
    note: 'Transactions hidden from mempool (bot cannot see them)',
  });

  const iface = new ethers.Interface(EMBLEM_ABI);
  let compromisedNonce = await provider.getTransactionCount(fromAddr, 'latest');
  const sentTxs = [];
  let sendCount = 0;
  let skipCount = 0;
  const totalTokens = transferable.length;

  for (const { contract, tokenId } of transferable) {
    const data = iface.encodeFunctionData('safeTransferFrom', [fromAddr, validTo, tokenId]);

    let gasLimit;
    try {
      const estimated = await provider.estimateGas({ from: fromAddr, to: contract, data });
      gasLimit = estimated * BigInt(Math.floor(1.25 * 100)) / 100n;
    } catch {
      skipCount++;
      progress('transferring', `Skipped vault ${tokenId} — would revert`, {
        sent: sendCount,
        total: totalTokens,
        skipped: skipCount,
      });
      continue;
    }

    const tx = {
      chainId: 1,
      nonce: compromisedNonce,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: priorityFee,
      to: contract,
      value: 0n,
      type: 2,
      gasLimit,
      data,
    };

    compromisedNonce++;

    try {
      const sent = await compromisedWallet.sendTransaction(tx);
      sentTxs.push({ tx: sent, tokenId });
      sendCount++;

      progress('transferring', `Submitted ${sendCount}/${totalTokens}...`, {
        sent: sendCount,
        total: totalTokens,
        skipped: skipCount,
        lastTx: sent.hash,
      });

      // Rate limiting: pause every 5 transactions
      if (sendCount % 5 === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      progress('transferring', `Failed vault ${tokenId}: ${e.message}`, {
        sent: sendCount,
        total: totalTokens,
        skipped: skipCount,
        error: true,
      });

      if (e.message?.includes('429')) {
        await new Promise(r => setTimeout(r, 3000));
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

  for (const { tx, tokenId } of sentTxs) {
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
      progress('confirming', `Tx for vault ${tokenId} may have failed: ${e.message}`, {
        confirmed,
        failed,
        total: sentTxs.length,
        error: true,
      });
    }
  }

  // ── COMPLETE ──
  const success = confirmed === sentTxs.length;
  progress('complete', success ? 'Emblem Vault rescue complete!' : 'Rescue finished with some failures', {
    success,
    confirmed,
    failed,
    skipped: skipCount,
    total: totalTokens,
    destination: validTo,
    explorer: `https://etherscan.io/address/${validTo}`,
  });

  return {
    success: true,
    data: {
      status: success ? 'complete' : 'partial',
      chain: 'eth',
      chainName: 'Ethereum Mainnet',
      fundingTxHash: fundTx.hash,
      submitted: sendCount,
      confirmed,
      failed,
      skipped: skipCount,
      txHashes,
      destination: validTo,
      explorer: `https://etherscan.io/address/${validTo}`,
    }
  };
}


// ── OWNERSHIP PROOF ───────────────────────────────────────────────────────────
/**
 * generateOwnershipProof(tokenId, contractAddress, privateKey)
 *
 * Signs a message proving vault ownership. Gas-free — no transaction.
 * The sweeper bot cannot see this.
 */
export async function generateOwnershipProof(tokenId, contractAddress, privateKey) {
  if (!validatePrivateKey(privateKey)) throw new Error('Invalid private key');
  const validContract = validateAddress(contractAddress);
  if (!validContract) throw new Error('Invalid contract address');

  const wallet = new ethers.Wallet(privateKey);
  const message = `I own Emblem Vault token ${tokenId} on contract ${validContract} — signed by Lifeboat V10`;
  const signature = await wallet.signMessage(message);

  return {
    success: true,
    data: {
      tokenId,
      contract: validContract,
      signerAddress: wallet.address,
      message,
      signature,
      timestamp: Date.now(),
      instructions: 'Submit this signature to Emblem vault support to prove ownership without revealing your private key',
    }
  };
}


// ── EXPORTS ───────────────────────────────────────────────────────────────────
export default {
  scanEmblemVaults,
  estimateEmblemRescueGas,
  executeEmblemRescue,
  generateOwnershipProof,
  EMBLEM_V2_ADDRESS,
  EMBLEM_LEGACY_ADDRESS,
};
