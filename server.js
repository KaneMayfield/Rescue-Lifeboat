/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LIFEBOAT V10 — Local Web Server                                  ║
 * ║  by Kane Mayfield · kanemayfield.com                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * This server runs LOCALLY on your machine. Private keys are sent 
 * to localhost only — they never leave your computer.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import open from 'open';
import engine from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ── CORS for local development ──
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Request logging (no sensitive data) ──
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chains
 * Returns available chain configurations
 */
app.get('/api/chains', (req, res) => {
  const chains = Object.entries(engine.CHAINS).map(([key, chain]) => ({
    key,
    name: chain.name,
    jsonKey: chain.jsonKey,
    nativeSymbol: chain.nativeSymbol,
    mevProtected: chain.mevProtected,
    explorer: chain.explorer,
  }));
  res.json({ success: true, data: chains });
});

/**
 * POST /api/scan
 * Scans a wallet for NFTs across all chains
 * Body: { wallet: string, alchemyKey: string }
 */
app.post('/api/scan', async (req, res) => {
  try {
    const { wallet, alchemyKey } = req.body;
    
    if (!wallet) {
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }
    if (!alchemyKey) {
      return res.status(400).json({ success: false, error: 'Alchemy API key required' });
    }

    console.log(`  Scanning wallet: ${wallet.slice(0, 10)}...`);
    const result = await engine.scanAllChains(wallet, alchemyKey);
    
    // Count total NFTs found
    let totalNFTs = 0;
    for (const chain of Object.values(result.data.chains)) {
      for (const coll of chain) {
        totalNFTs += coll.tokens.length;
      }
    }
    console.log(`  Found ${totalNFTs} NFTs across all chains`);

    res.json(result);
  } catch (e) {
    console.error('  Scan error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/estimate
 * Estimates gas costs for a chain rescue
 * Body: { chain: string, rescueData: object, alchemyKey?: string }
 */
app.post('/api/estimate', async (req, res) => {
  try {
    const { chain, rescueData, alchemyKey } = req.body;
    
    if (!chain) {
      return res.status(400).json({ success: false, error: 'Chain required' });
    }
    if (!rescueData) {
      return res.status(400).json({ success: false, error: 'Rescue data required' });
    }

    console.log(`  Estimating gas for ${chain}...`);
    const result = await engine.estimateChainGas(chain, rescueData, alchemyKey);
    console.log(`  Estimate: ${result.data.tokenCount} tokens, ${result.data.totalCostNative} ${result.data.nativeSymbol}`);

    res.json(result);
  } catch (e) {
    console.error('  Estimate error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/balance
 * Checks wallet balances
 * Body: { addresses: string[], chain: string, alchemyKey?: string }
 */
app.post('/api/balance', async (req, res) => {
  try {
    const { addresses, chain, alchemyKey } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ success: false, error: 'Addresses array required' });
    }
    if (!chain) {
      return res.status(400).json({ success: false, error: 'Chain required' });
    }

    const result = await engine.getBalances(addresses, chain, alchemyKey);
    res.json(result);
  } catch (e) {
    console.error('  Balance error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/execute
 * Executes the NFT rescue for a specific chain
 * Body: { chain, rescueData, compromisedKey, fundingKey, alchemyKey? }
 * 
 * SECURITY NOTE: Keys are received, used, and discarded.
 * They are never logged or stored.
 */
app.post('/api/execute', async (req, res) => {
  try {
    const { chain, rescueData, compromisedKey, fundingKey, alchemyKey } = req.body;
    
    if (!chain) {
      return res.status(400).json({ success: false, error: 'Chain required' });
    }
    if (!rescueData) {
      return res.status(400).json({ success: false, error: 'Rescue data required' });
    }
    if (!compromisedKey) {
      return res.status(400).json({ success: false, error: 'Compromised wallet key required' });
    }
    if (!fundingKey) {
      return res.status(400).json({ success: false, error: 'Funding wallet key required' });
    }

    // Validate keys before starting
    if (!engine.validatePrivateKey(compromisedKey)) {
      return res.status(400).json({ success: false, error: 'Invalid compromised wallet private key' });
    }
    if (!engine.validatePrivateKey(fundingKey)) {
      return res.status(400).json({ success: false, error: 'Invalid funding wallet private key' });
    }

    console.log(`  Executing rescue on ${chain}...`);
    
    // Track progress for potential SSE streaming in future
    const progressLog = [];
    const onProgress = (p) => {
      progressLog.push({ ...p, timestamp: Date.now() });
      console.log(`    [${p.step}] ${p.message}`);
    };

    const result = await engine.executeChainRescue(
      chain, 
      rescueData, 
      compromisedKey, 
      fundingKey, 
      alchemyKey,
      onProgress
    );

    console.log(`  Rescue complete: ${result.data.confirmed}/${result.data.submitted} confirmed`);

    // Include progress log in response
    result.data.progressLog = progressLog;
    res.json(result);
  } catch (e) {
    console.error('  Execute error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/sweep
 * Sweeps remaining ETH from a wallet
 * Body: { fromKey, toAddress, chain, alchemyKey? }
 */
app.post('/api/sweep', async (req, res) => {
  try {
    const { fromKey, toAddress, chain, alchemyKey } = req.body;
    
    if (!fromKey) {
      return res.status(400).json({ success: false, error: 'Source wallet key required' });
    }
    if (!toAddress) {
      return res.status(400).json({ success: false, error: 'Destination address required' });
    }
    if (!chain) {
      return res.status(400).json({ success: false, error: 'Chain required' });
    }

    console.log(`  Sweeping ${chain}...`);
    const result = await engine.sweepETH(fromKey, toAddress, chain, alchemyKey);
    console.log(`  Swept ${result.data.amount} ${result.data.nativeSymbol}`);

    res.json(result);
  } catch (e) {
    console.error('  Sweep error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/manifold
 * Transfers Manifold contract ownership
 * Body: { contractAddress, newOwner, privateKey, alchemyKey? }
 */

/**
 * POST /api/balances-all
 * Checks native balances across ALL chains for a given private key
 * Body: { privateKey, alchemyKey? }
 */
app.post('/api/balances-all', async (req, res) => {
  try {
    const { privateKey, address, alchemyKey } = req.body;
    const keyOrAddress = address || privateKey;
    if (!keyOrAddress) {
      return res.status(400).json({ success: false, error: 'Private key or address required' });
    }

    const result = await engine.getAllBalances(keyOrAddress, alchemyKey);
    console.log(`  Balances checked across ${result.data.balances.length} chains`);
    res.json(result);
  } catch (e) {
    console.error('  Balance-all error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/tokens
 * Scans all chains for ERC-20 token balances
 * Body: { privateKey, alchemyKey }
 */
app.post('/api/tokens', async (req, res) => {
  try {
    const { privateKey, alchemyKey } = req.body;
    if (!privateKey) {
      return res.status(400).json({ success: false, error: 'Private key required' });
    }
    if (!alchemyKey) {
      return res.status(400).json({ success: false, error: 'Alchemy key required' });
    }

    const result = await engine.scanAllTokens(privateKey, alchemyKey);
    console.log(`  Found ${result.data.tokens.length} tokens with balances`);
    res.json(result);
  } catch (e) {
    console.error('  Token scan error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/sweep-token
 * Sweeps an ERC-20 token from compromised wallet
 * Body: { fromKey, toAddress, chain, tokenContract, alchemyKey? }
 */
app.post('/api/sweep-token', async (req, res) => {
  try {
    const { fromKey, toAddress, chain, tokenContract, alchemyKey } = req.body;
    if (!fromKey || !toAddress || !chain || !tokenContract) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    console.log(`  Sweeping token ${tokenContract} on ${chain}...`);
    const result = await engine.sweepToken(fromKey, toAddress, chain, tokenContract, alchemyKey);
    console.log(`  Swept ${result.data.amount} ${result.data.symbol}`);
    res.json(result);
  } catch (e) {
    console.error('  Token sweep error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/manifold', async (req, res) => {
  try {
    const { contractAddress, newOwner, privateKey, alchemyKey } = req.body;
    
    if (!contractAddress) {
      return res.status(400).json({ success: false, error: 'Contract address required' });
    }
    if (!newOwner) {
      return res.status(400).json({ success: false, error: 'New owner address required' });
    }
    if (!privateKey) {
      return res.status(400).json({ success: false, error: 'Private key required' });
    }

    console.log(`  Transferring Manifold ownership...`);
    const result = await engine.transferManifoldOwnership(
      contractAddress, 
      newOwner, 
      privateKey, 
      alchemyKey
    );
    console.log(`  Ownership transferred to ${newOwner.slice(0, 10)}...`);

    res.json(result);
  } catch (e) {
    console.error('  Manifold error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/validate
 * Validates addresses and keys (without exposing them)
 * Body: { type: 'address'|'key', value: string }
 */
app.post('/api/validate', (req, res) => {
  const { type, value } = req.body;
  
  if (type === 'address') {
    const valid = engine.validateAddress(value);
    res.json({ success: true, valid: !!valid, normalized: valid || null });
  } else if (type === 'key') {
    const valid = engine.validatePrivateKey(value);
    res.json({ success: true, valid });
  } else {
    res.status(400).json({ success: false, error: 'Type must be "address" or "key"' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SERVE FRONTEND
// ══════════════════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

export { app };

// ══════════════════════════════════════════════════════════════════════════════
// START SERVER (only when run directly, not when imported by tests)
// ══════════════════════════════════════════════════════════════════════════════

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     LIFEBOAT V10                              ║');
  console.log('║              NFT Rescue Tool · Local Server                   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║                                                               ║');
  console.log(`║   Running at: http://localhost:${PORT}                          ║`);
  console.log('║                                                               ║');
  console.log('║   Your private keys NEVER leave this machine.                 ║');
  console.log('║   All blockchain operations run locally.                      ║');
  console.log('║                                                               ║');
  console.log('║   Press Ctrl+C to stop the server.                            ║');
  console.log('║                                                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Auto-open browser
  open(`http://localhost:${PORT}`);
});
