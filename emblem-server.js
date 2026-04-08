/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LIFEBOAT V10 — Emblem Vault Server Routes                        ║
 * ║  Drop-in route module for server.js                               ║
 * ║  by Kane Mayfield · kanemayfield.com                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Usage in server.js:
 *   import { registerEmblemRoutes } from './emblem-server.js';
 *   // ...after all existing routes, before app.listen:
 *   registerEmblemRoutes(app);
 */

import emblemEngine from './emblem-engine.js';
import engine from './engine.js';

export function registerEmblemRoutes(app) {

  /**
   * POST /api/emblem/scan
   * Scans wallet for Emblem Vault NFTs (V2 + Legacy)
   * Body: { wallet: string, alchemyKey: string }
   */
  app.post('/api/emblem/scan', async (req, res) => {
    try {
      const { wallet, alchemyKey } = req.body;

      if (!wallet) {
        return res.status(400).json({ success: false, error: 'Wallet address required' });
      }
      if (!alchemyKey) {
        return res.status(400).json({ success: false, error: 'Alchemy API key required' });
      }

      console.log(`  Emblem scan: ${wallet.slice(0, 10)}...`);
      const result = await emblemEngine.scanEmblemVaults(wallet, alchemyKey);
      console.log(`  Emblem scan: found ${result.data.totalFound} vaults`);

      res.json(result);
    } catch (e) {
      console.error('  Emblem scan error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  /**
   * POST /api/emblem/estimate
   * Estimates gas for Emblem Vault rescue
   * Body: { vaultTokenIds: [{contract, tokenId}], fromAddress, toAddress, alchemyKey }
   */
  app.post('/api/emblem/estimate', async (req, res) => {
    try {
      const { vaultTokenIds, fromAddress, toAddress, alchemyKey } = req.body;

      if (!vaultTokenIds || !Array.isArray(vaultTokenIds) || vaultTokenIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Vault token IDs required' });
      }
      if (!fromAddress) {
        return res.status(400).json({ success: false, error: 'FROM address required' });
      }
      if (!toAddress) {
        return res.status(400).json({ success: false, error: 'TO address required' });
      }

      console.log(`  Emblem estimate: ${vaultTokenIds.length} vaults...`);
      const result = await emblemEngine.estimateEmblemRescueGas(vaultTokenIds, fromAddress, toAddress, alchemyKey);
      console.log(`  Emblem gas estimate: ${result.data.tokenCount} vaults, ${result.data.totalCostNative} ETH`);

      res.json(result);
    } catch (e) {
      console.error('  Emblem estimate error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  /**
   * POST /api/emblem/execute
   * Executes Emblem Vault rescue via MEV Blocker
   * Body: { vaultTokenIds, compromisedKey, fundingKey, toAddress, alchemyKey }
   */
  app.post('/api/emblem/execute', async (req, res) => {
    try {
      const { vaultTokenIds, compromisedKey, fundingKey, toAddress, alchemyKey } = req.body;

      if (!vaultTokenIds || !Array.isArray(vaultTokenIds) || vaultTokenIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Vault token IDs required' });
      }
      if (!compromisedKey) {
        return res.status(400).json({ success: false, error: 'Compromised wallet key required' });
      }
      if (!fundingKey) {
        return res.status(400).json({ success: false, error: 'Funding wallet key required' });
      }
      if (!toAddress) {
        return res.status(400).json({ success: false, error: 'Destination address required' });
      }

      // Validate keys — import validatePrivateKey from main engine
      if (!engine.validatePrivateKey(compromisedKey)) {
        return res.status(400).json({ success: false, error: 'Invalid compromised wallet private key' });
      }
      if (!engine.validatePrivateKey(fundingKey)) {
        return res.status(400).json({ success: false, error: 'Invalid funding wallet private key' });
      }

      console.log(`  Executing Emblem rescue: ${vaultTokenIds.length} vaults...`);

      const progressLog = [];
      const onProgress = (p) => {
        progressLog.push({ ...p, timestamp: Date.now() });
        console.log(`    [${p.step}] ${p.message}`);
      };

      const result = await emblemEngine.executeEmblemRescue(
        vaultTokenIds,
        compromisedKey,
        fundingKey,
        toAddress,
        alchemyKey,
        onProgress
      );

      console.log(`  Emblem rescue: ${result.data.confirmed}/${result.data.submitted} confirmed`);

      result.data.progressLog = progressLog;
      res.json(result);
    } catch (e) {
      console.error('  Emblem execute error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  /**
   * POST /api/emblem/proof
   * Generates gas-free ownership proof signature
   * Body: { tokenId, contractAddress, privateKey }
   */
  app.post('/api/emblem/proof', async (req, res) => {
    try {
      const { tokenId, contractAddress, privateKey } = req.body;

      if (!tokenId) {
        return res.status(400).json({ success: false, error: 'Token ID required' });
      }
      if (!contractAddress) {
        return res.status(400).json({ success: false, error: 'Contract address required' });
      }
      if (!privateKey) {
        return res.status(400).json({ success: false, error: 'Private key required' });
      }

      if (!engine.validatePrivateKey(privateKey)) {
        return res.status(400).json({ success: false, error: 'Invalid private key' });
      }

      const result = await emblemEngine.generateOwnershipProof(tokenId, contractAddress, privateKey);
      console.log(`  Ownership proof generated for token ${tokenId}`);

      res.json(result);
    } catch (e) {
      console.error('  Emblem proof error:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  console.log('  Emblem Vault routes registered (/api/emblem/*)');
}
