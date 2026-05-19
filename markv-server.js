/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  MARK V — API Routes                                              ║
 * ║  Express routes for fleet-scale multi-wallet operations           ║
 * ║  Imported by server.js — not a standalone server                  ║
 * ║  by Kane Mayfield · kanemayfield.com                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * USAGE in server.js:
 *   import { registerMarkVRoutes } from './markv-server.js';
 *   registerMarkVRoutes(app);
 *
 * All routes follow the same pattern as server.js:
 *   - Validate required fields, return 400 on missing
 *   - Call engine function, return result directly
 *   - Catch all errors, return 500 with message
 *   - console.log non-sensitive info only (no keys, no addresses in full)
 *
 * Private keys are received from localhost only — they never leave
 * the user's machine. They are held in memory for the duration of
 * the request and then garbage collected. Never logged.
 */

import markv from './markv-engine.js';

// ── HELPER ─────────────────────────────────────────────────────────────────────
// Short address for safe logging — same pattern as server.js
function short(addr) {
  if (!addr || typeof addr !== 'string') return '—';
  return addr.slice(0, 8) + '...';
}

// ── ROUTE REGISTRATION ─────────────────────────────────────────────────────────
export function registerMarkVRoutes(app) {

  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/markv-scan
  // Fleet scan — all wallets, all chains simultaneously
  //
  // Body: {
  //   wallets:    [{ address: string, nick: string }]  — up to 50
  //   destination: string                              — clean destination wallet
  //   alchemyKey:  string                              — Growth plan required
  // }
  //
  // Returns: {
  //   success: true,
  //   data: {
  //     results: { [walletAddr_lower]: { address, nick, chains, errors } }
  //     destination: string
  //     stats: { wallets, nfts, tokens, chains }
  //   }
  // }
  // ════════════════════════════════════════════════════════════════════════════
  app.post('/api/markv-scan', async (req, res) => {
    try {
      const { wallets, destination, alchemyKey } = req.body;

      if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
        return res.status(400).json({ success: false, error: 'wallets array required' });
      }
      if (!destination) {
        return res.status(400).json({ success: false, error: 'destination address required' });
      }
      if (!alchemyKey) {
        return res.status(400).json({ success: false, error: 'Alchemy API key required — Mark V requires a Growth plan key' });
      }
      if (wallets.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximum 50 wallets per fleet operation' });
      }

      console.log(`  [Mark V] Fleet scan — ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''} → ${short(destination)}`);

      const result = await markv.scanFleet(wallets, destination, alchemyKey);

      const stats = result.data.stats;
      console.log(`  [Mark V] Scan complete — ${stats.wallets} wallets, ${stats.nfts} NFTs, ${stats.chains} chains`);

      res.json(result);
    } catch (e) {
      console.error('  [Mark V] Scan error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });


  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/markv-estimate
  // Fleet gas estimation — per chain, across all wallets
  //
  // Body: {
  //   scanResults: object    — output from /api/markv-scan
  //   destination: string
  //   alchemyKey:  string
  //   gasTier:     'recommended' | 'safe' | 'maximum'   (default: 'recommended')
  // }
  //
  // Returns: {
  //   success: true,
  //   data: {
  //     estimates: { [chainKey]: { tokenCount, totalCostNative, nativeSymbol, ... } }
  //     gasTier: string
  //     buffer:  number
  //   }
  // }
  // ════════════════════════════════════════════════════════════════════════════
  app.post('/api/markv-estimate', async (req, res) => {
    try {
      const { scanResults, destination, alchemyKey, gasTier } = req.body;

      if (!scanResults || Object.keys(scanResults).length === 0) {
        return res.status(400).json({ success: false, error: 'scanResults required — run fleet scan first' });
      }
      if (!destination) {
        return res.status(400).json({ success: false, error: 'destination address required' });
      }
      if (!alchemyKey) {
        return res.status(400).json({ success: false, error: 'Alchemy API key required' });
      }

      const tier = gasTier || 'recommended';
      const validTiers = ['recommended', 'safe', 'maximum'];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ success: false, error: `gasTier must be one of: ${validTiers.join(', ')}` });
      }

      console.log(`  [Mark V] Gas estimate — ${Object.keys(scanResults).length} wallets, tier: ${tier}`);

      const result = await markv.estimateFleetGas(scanResults, destination, alchemyKey, tier);

      const chains = Object.keys(result.data.estimates).filter(k => parseFloat(result.data.estimates[k].totalCostNative) > 0);
      console.log(`  [Mark V] Estimate complete — ${chains.length} chains have costs`);

      res.json(result);
    } catch (e) {
      console.error('  [Mark V] Estimate error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });


  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/markv-execute-sse
  // Fleet execution via Server-Sent Events — streams progress in real time.
  //
  // WHY SSE: A 50-wallet fleet operation can take 10-20 minutes. A regular
  // POST would require the HTTP connection to stay open the entire time —
  // fragile even on localhost due to OS-level socket idle timeouts during
  // confirmation waits. SSE keeps the connection alive with a heartbeat and
  // streams each progress event as it fires. The client receives live updates
  // without polling. The connection closes cleanly when the operation ends.
  //
  // Query params (GET):
  //   payload: base64-encoded JSON of the execute body (see below)
  //
  // POST /api/markv-execute-start
  // Stores the execute payload server-side, returns a jobId.
  // Client then opens GET /api/markv-execute-sse?jobId=xxx to stream.
  //
  // Event types streamed:
  //   progress  — { walletAddr, step, message, ...data }
  //   complete  — { walletsCleared, walletsTotal, totalConfirmed, walletResults }
  //   error     — { message }
  //   heartbeat — {} (every 15s to keep connection alive)
  // ════════════════════════════════════════════════════════════════════════════

  // In-memory job store — keyed by jobId, holds payload until SSE picks it up
  const executeJobs = new Map();

  app.post('/api/markv-execute-start', (req, res) => {
    const { wallets, destination, fundingKey, scanResults, alchemyKey, gasTier } = req.body;

    // Validate before storing
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return res.status(400).json({ success: false, error: 'wallets array required' });
    }
    if (!destination) {
      return res.status(400).json({ success: false, error: 'destination address required' });
    }
    if (!fundingKey) {
      return res.status(400).json({ success: false, error: 'fundingKey required' });
    }
    if (!scanResults || Object.keys(scanResults).length === 0) {
      return res.status(400).json({ success: false, error: 'scanResults required — run fleet scan first' });
    }
    if (!alchemyKey) {
      return res.status(400).json({ success: false, error: 'Alchemy API key required' });
    }

    const walletsWithKeys = wallets.filter(w => w.privateKey && w.privateKey.length > 10);
    if (walletsWithKeys.length === 0) {
      return res.status(400).json({ success: false, error: 'No wallet private keys provided' });
    }

    // Generate a simple job ID — random hex, not a secret, just a lookup key
    const jobId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    executeJobs.set(jobId, { wallets, destination, fundingKey, scanResults, alchemyKey, gasTier });

    // Auto-expire job after 5 minutes if SSE never connects
    setTimeout(() => executeJobs.delete(jobId), 5 * 60 * 1000);

    console.log(`  [Mark V] Job queued — ${walletsWithKeys.length} wallets, jobId: ${jobId.slice(0, 8)}...`);
    res.json({ success: true, jobId });
  });

  app.get('/api/markv-execute-sse', async (req, res) => {
    const { jobId } = req.query;
    const job = executeJobs.get(jobId);

    if (!jobId || !job) {
      res.status(400).json({ success: false, error: 'Invalid or expired jobId — start a new execute job' });
      return;
    }

    // Claim and remove job so it can only be consumed once
    executeJobs.delete(jobId);
    const { wallets, destination, fundingKey, scanResults, alchemyKey, gasTier } = job;
    const tier = gasTier || 'recommended';
    const walletsWithKeys = wallets.filter(w => w.privateKey && w.privateKey.length > 10);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if present
    res.flushHeaders();

    // Helper to send an SSE event
    const send = (type, data) => {
      if (res.writableEnded) return;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Heartbeat every 15s — prevents OS from closing idle socket during confirmation waits
    const heartbeat = setInterval(() => send('heartbeat', { ts: Date.now() }), 15000);

    // Clean up on client disconnect
    req.on('close', () => clearInterval(heartbeat));

    console.log(`  [Mark V] SSE stream open — ${walletsWithKeys.length} wallets → ${short(destination)}`);
    send('progress', { walletAddr: null, step: 'init', message: `Fleet operation starting — ${walletsWithKeys.length} wallets` });

    try {
      // onProgress fires on every engine event — stream each one directly to client
      const onProgress = (progressData) => {
        console.log(`  [Mark V] [${progressData.step}] ${progressData.message}`);
        send('progress', progressData);
      };

      const result = await markv.executeFleet(
        wallets, destination, fundingKey, scanResults, alchemyKey, tier, onProgress
      );

      const d = result.data;
      console.log(`  [Mark V] Complete — ${d.walletsCleared}/${d.walletsTotal} cleared, ${d.totalConfirmed} confirmed`);

      send('complete', d);

    } catch (e) {
      console.error('  [Mark V] Execute error:', e.message);
      send('error', { message: e.message });
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });


  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/markv-emblem-scan
  // Bulk Emblem Vault scan across fleet
  //
  // Body: {
  //   wallets:    [{ address, nick }]
  //   alchemyKey: string
  // }
  //
  // Returns: {
  //   success: true,
  //   data: {
  //     vaults: [{ ...vaultData, walletAddress, walletNick }]
  //     total:  number
  //     errors: [{ wallet, error }]
  //   }
  // }
  // ════════════════════════════════════════════════════════════════════════════
  app.post('/api/markv-emblem-scan', async (req, res) => {
    try {
      const { wallets, alchemyKey } = req.body;

      if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
        return res.status(400).json({ success: false, error: 'wallets array required' });
      }
      if (!alchemyKey) {
        return res.status(400).json({ success: false, error: 'Alchemy API key required' });
      }

      console.log(`  [Mark V] Emblem vault scan — ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''}`);

      const result = await markv.scanEmblemFleet(wallets, alchemyKey);

      console.log(`  [Mark V] Emblem scan complete — ${result.data.total} vault${result.data.total !== 1 ? 's' : ''} found`);

      res.json(result);
    } catch (e) {
      console.error('  [Mark V] Emblem scan error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });


  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/markv-emblem-transfer
  // Bulk vault NFT transfer (EVM) — moves the vault token, not the contents
  //
  // Body: {
  //   vaults:      [{ tokenId, contract, walletAddress }]
  //   destination: string
  //   fundingKey:  string
  //   walletKeys:  { [walletAddress]: privateKey }
  //   alchemyKey:  string
  // }
  //
  // Returns: {
  //   success: true,
  //   data: {
  //     confirmed:     number
  //     walletResults: [{ wallet, success, confirmed, error }]
  //     destination:   string
  //   }
  // }
  // ════════════════════════════════════════════════════════════════════════════
  app.post('/api/markv-emblem-transfer', async (req, res) => {
    try {
      const { vaults, destination, fundingKey, walletKeys, alchemyKey } = req.body;

      if (!vaults || !Array.isArray(vaults) || vaults.length === 0) {
        return res.status(400).json({ success: false, error: 'vaults array required' });
      }
      if (!destination) {
        return res.status(400).json({ success: false, error: 'destination address required' });
      }
      if (!fundingKey) {
        return res.status(400).json({ success: false, error: 'fundingKey required' });
      }
      if (!walletKeys || Object.keys(walletKeys).length === 0) {
        return res.status(400).json({ success: false, error: 'walletKeys required — at least one vault owner key needed' });
      }
      if (!alchemyKey) {
        return res.status(400).json({ success: false, error: 'Alchemy API key required' });
      }

      console.log(`  [Mark V] Emblem bulk transfer — ${vaults.length} vault${vaults.length !== 1 ? 's' : ''} → ${short(destination)}`);

      const result = await markv.executeEmblemFleetTransfer(
        vaults,
        destination,
        fundingKey,
        walletKeys,
        alchemyKey,
      );

      console.log(`  [Mark V] Emblem transfer complete — ${result.data.confirmed} confirmed`);

      res.json(result);
    } catch (e) {
      console.error('  [Mark V] Emblem transfer error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });


  // ════════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/markv-emblem-unvault-start + GET /api/markv-emblem-unvault-sse
  // Unvault via SSE — same two-step pattern as Fleet Execute.
  // WHY SSE: Sequential Torus round-trips take 3-8s each. 10 vaults = ~1 min.
  // SSE streams per-vault progress live rather than holding a silent POST open.
  // ════════════════════════════════════════════════════════════════════════════

  const unvaultJobs = new Map();

  app.post('/api/markv-emblem-unvault-start', (req, res) => {
    const { vaults, xcpDestination, btcFeeAmount, walletKeys, alchemyKey } = req.body;

    if (!vaults || !Array.isArray(vaults) || vaults.length === 0) {
      return res.status(400).json({ success: false, error: 'vaults array required' });
    }
    if (!xcpDestination) {
      return res.status(400).json({ success: false, error: 'xcpDestination required' });
    }
    if (!walletKeys || Object.keys(walletKeys).length === 0) {
      return res.status(400).json({ success: false, error: 'walletKeys required' });
    }

    const jobId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    unvaultJobs.set(jobId, { vaults, xcpDestination, btcFeeAmount, walletKeys, alchemyKey });
    setTimeout(() => unvaultJobs.delete(jobId), 5 * 60 * 1000);

    console.log(`  [Mark V] Unvault job queued — ${vaults.length} vault${vaults.length !== 1 ? 's' : ''}, jobId: ${jobId.slice(0, 8)}...`);
    res.json({ success: true, jobId });
  });

  app.get('/api/markv-emblem-unvault-sse', async (req, res) => {
    const { jobId } = req.query;
    const job = unvaultJobs.get(jobId);

    if (!jobId || !job) {
      return res.status(400).json({ success: false, error: 'Invalid or expired jobId' });
    }

    unvaultJobs.delete(jobId);
    const { vaults, xcpDestination, btcFeeAmount, walletKeys, alchemyKey } = job;
    const fee = typeof btcFeeAmount === 'number' ? btcFeeAmount : 0.0001;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (type, data) => {
      if (res.writableEnded) return;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => send('heartbeat', { ts: Date.now() }), 15000);
    req.on('close', () => clearInterval(heartbeat));

    console.log(`  [Mark V] Unvault SSE open — ${vaults.length} vault${vaults.length !== 1 ? 's' : ''} → ${xcpDestination.slice(0, 12)}...`);

    try {
      const onProgress = ({ vault, step, msg }) => {
        console.log(`  [Mark V] [unvault/${step}] Vault #${vault?.tokenId || '?'}: ${msg}`);
        send('progress', { tokenId: vault?.tokenId, step, msg });
      };

      const result = await markv.executeEmblemUnvault(
        vaults, xcpDestination, fee, walletKeys, alchemyKey, onProgress
      );

      console.log(`  [Mark V] Unvault complete — ${result.data.confirmed} XCP assets transferred`);
      send('complete', result.data);

    } catch (e) {
      console.error('  [Mark V] Unvault error:', e.message);
      const errMsg = e.message.includes('npm install')
        ? e.message + '\n\nRun the npm install command above, then restart the server.'
        : e.message;
      send('error', { message: errMsg });
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });


  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/markv-status
  // Health check — confirms Mark V routes are registered and engine is loaded
  //
  // Returns: {
  //   success: true,
  //   data: {
  //     status:  'operational'
  //     routes:  string[]
  //     version: string
  //   }
  // }
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/api/markv-status', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'operational',
        version: 'Mark V — Massive Tactical Extraction',
        routes: [
          'POST /api/markv-scan',
          'POST /api/markv-estimate',
          'POST /api/markv-execute-start',
          'GET  /api/markv-execute-sse',
          'POST /api/markv-emblem-scan',
          'POST /api/markv-emblem-transfer',
          'POST /api/markv-emblem-unvault-start',
          'GET  /api/markv-emblem-unvault-sse',
          'GET  /api/markv-status',
        ],
        note: 'Clean wallets only. No MEV Blocker. Alchemy Growth plan required.',
      }
    });
  });

  console.log('  [Mark V] Routes registered — 7 endpoints active');
}
