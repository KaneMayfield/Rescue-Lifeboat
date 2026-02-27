/**
 * Unit tests for server.js API routes
 * Framework: Mocha + Chai + Supertest + esmock
 *
 * Routes under test:
 *   GET  /api/chains
 *   POST /api/scan
 *   POST /api/estimate
 *   POST /api/balance
 *   POST /api/execute
 *   POST /api/sweep
 *   POST /api/balances-all
 *   POST /api/tokens
 *   POST /api/sweep-token
 *   POST /api/manifold
 *   POST /api/validate
 *   GET  /  (frontend serve)
 *   GET  *  (SPA catch-all)
 */

import esmock from 'esmock';
import request from 'supertest';
import { expect } from 'chai';
import { ethers } from 'ethers';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_ADDRESS   = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const VALID_ADDRESS_2 = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const VALID_KEY       = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const VALID_KEY_ADDR  = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ALCHEMY_KEY     = 'test-alchemy-key';

const MINIMAL_RESCUE_DATA = {
  rescue_from: VALID_KEY_ADDR,
  rescue_to:   VALID_ADDRESS_2,
  chains: {
    'eth-mainnet': [
      {
        collection: 'Test',
        contract: VALID_ADDRESS,
        token_type: 'ERC721',
        tokens: [{ tokenId: '1', name: 'Token #1', image: '', balance: 1 }],
      },
    ],
  },
};

// ─── Engine mock factory ─────────────────────────────────────────────────────
// Returns an engine mock with all exported functions as no-ops by default.
// Individual tests override only what they need.

import { CHAINS, validatePrivateKey as realValidatePrivateKey } from '../engine.js';

function makeEngineMock(overrides = {}) {
  return {
    CHAINS,
    validateAddress:            (addr) => { try { return ethers.getAddress(addr); } catch { return null; } },
    validatePrivateKey:         realValidatePrivateKey,
    scanAllChains:              async () => ({ success: true, data: { rescue_from: VALID_ADDRESS, chains: {} }, errors: [] }),
    estimateChainGas:           async () => ({ success: true, data: { tokenCount: 0, totalCostNative: '0', nativeSymbol: 'ETH' } }),
    getBalances:                async () => ({ success: true, data: { chain: 'eth', nativeSymbol: 'ETH', balances: [] } }),
    executeChainRescue:         async () => ({ success: true, data: { status: 'complete', confirmed: 1, submitted: 1, failed: 0, skipped: 0, txHashes: [] } }),
    sweepETH:                   async () => ({ success: true, data: { txHash: '0xabc', amount: '0.5', nativeSymbol: 'ETH' } }),
    getAllBalances:              async () => ({ success: true, data: { address: VALID_ADDRESS, balances: [] } }),
    scanAllTokens:              async () => ({ success: true, data: { address: VALID_KEY_ADDR, tokens: [] } }),
    sweepToken:                 async () => ({ success: true, data: { txHash: '0xdef', amount: '100', symbol: 'USDC' } }),
    transferManifoldOwnership:  async () => ({ success: true, data: { contract: VALID_ADDRESS, newOwner: VALID_ADDRESS_2, transactions: [] } }),
    ...overrides,
  };
}

// Load a fresh server instance with a given engine mock.
// esmock replaces the engine module for that import only.
async function loadApp(engineOverrides = {}) {
  const { app } = await esmock('../server.js', {
    '../engine.js': makeEngineMock(engineOverrides),
    'open': { default: async () => {} },
  });
  return app;
}

// ─── GET /api/chains ─────────────────────────────────────────────────────────

describe('GET /api/chains', () => {
  let app;
  before(async () => { app = await loadApp(); });

  it('returns 200 with success:true', async () => {
    const res = await request(app).get('/api/chains');
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('returns an array of chain objects', async () => {
    const res = await request(app).get('/api/chains');
    expect(res.body.data).to.be.an('array').with.length.greaterThan(0);
  });

  it('each chain entry has key, name, nativeSymbol, mevProtected, explorer', async () => {
    const res = await request(app).get('/api/chains');
    for (const chain of res.body.data) {
      expect(chain).to.include.all.keys('key', 'name', 'nativeSymbol', 'mevProtected', 'explorer');
    }
  });

  it('includes eth, polygon, base, optimism, avalanche', async () => {
    const res = await request(app).get('/api/chains');
    const keys = res.body.data.map(c => c.key);
    expect(keys).to.include.members(['eth', 'polygon', 'base', 'optimism', 'avalanche']);
  });
});

// ─── POST /api/scan ───────────────────────────────────────────────────────────

describe('POST /api/scan', () => {
  it('returns 400 when wallet is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/scan').send({ alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.error).to.match(/wallet/i);
  });

  it('returns 400 when alchemyKey is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/scan').send({ wallet: VALID_ADDRESS });
    expect(res.status).to.equal(400);
    expect(res.body.success).to.equal(false);
    expect(res.body.error).to.match(/alchemy/i);
  });

  it('returns 200 with engine result on valid input', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/scan')
      .send({ wallet: VALID_ADDRESS, alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      scanAllChains: async () => { throw new Error('RPC failed'); },
    });
    const res = await request(app)
      .post('/api/scan')
      .send({ wallet: VALID_ADDRESS, alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(500);
    expect(res.body.success).to.equal(false);
    expect(res.body.error).to.equal('RPC failed');
  });
});

// ─── POST /api/estimate ───────────────────────────────────────────────────────

describe('POST /api/estimate', () => {
  it('returns 400 when chain is missing', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/estimate')
      .send({ rescueData: MINIMAL_RESCUE_DATA });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/chain/i);
  });

  it('returns 400 when rescueData is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/estimate').send({ chain: 'eth' });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/rescue data/i);
  });

  it('returns 200 with estimate result on valid input', async () => {
    const app = await loadApp({
      estimateChainGas: async () => ({
        success: true,
        data: { tokenCount: 1, totalCostNative: '0.001', nativeSymbol: 'ETH' },
      }),
    });
    const res = await request(app)
      .post('/api/estimate')
      .send({ chain: 'eth', rescueData: MINIMAL_RESCUE_DATA, alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      estimateChainGas: async () => { throw new Error('Provider error'); },
    });
    const res = await request(app)
      .post('/api/estimate')
      .send({ chain: 'eth', rescueData: MINIMAL_RESCUE_DATA });
    expect(res.status).to.equal(500);
    expect(res.body.error).to.equal('Provider error');
  });
});

// ─── POST /api/balance ────────────────────────────────────────────────────────

describe('POST /api/balance', () => {
  it('returns 400 when addresses is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/balance').send({ chain: 'eth' });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/addresses/i);
  });

  it('returns 400 when addresses is not an array', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/balance')
      .send({ addresses: VALID_ADDRESS, chain: 'eth' });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/addresses/i);
  });

  it('returns 400 when chain is missing', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/balance')
      .send({ addresses: [VALID_ADDRESS] });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/chain/i);
  });

  it('returns 200 on valid input', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/balance')
      .send({ addresses: [VALID_ADDRESS], chain: 'eth' });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      getBalances: async () => { throw new Error('Unknown chain: bad'); },
    });
    const res = await request(app)
      .post('/api/balance')
      .send({ addresses: [VALID_ADDRESS], chain: 'bad' });
    expect(res.status).to.equal(500);
  });
});

// ─── POST /api/execute ────────────────────────────────────────────────────────

describe('POST /api/execute', () => {
  it('returns 400 when chain is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/execute').send({
      rescueData: MINIMAL_RESCUE_DATA,
      compromisedKey: VALID_KEY,
      fundingKey: VALID_KEY,
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/chain/i);
  });

  it('returns 400 when rescueData is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/execute').send({
      chain: 'eth',
      compromisedKey: VALID_KEY,
      fundingKey: VALID_KEY,
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/rescue data/i);
  });

  it('returns 400 when compromisedKey is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/execute').send({
      chain: 'eth',
      rescueData: MINIMAL_RESCUE_DATA,
      fundingKey: VALID_KEY,
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/compromised/i);
  });

  it('returns 400 when fundingKey is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/execute').send({
      chain: 'eth',
      rescueData: MINIMAL_RESCUE_DATA,
      compromisedKey: VALID_KEY,
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/funding/i);
  });

  it('returns 400 when compromisedKey is invalid', async () => {
    const app = await loadApp({
      validatePrivateKey: (k) => k === VALID_KEY, // only VALID_KEY passes
    });
    const res = await request(app).post('/api/execute').send({
      chain: 'eth',
      rescueData: MINIMAL_RESCUE_DATA,
      compromisedKey: 'bad-key',
      fundingKey: VALID_KEY,
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/compromised/i);
  });

  it('returns 400 when fundingKey is invalid', async () => {
    let callCount = 0;
    const app = await loadApp({
      validatePrivateKey: () => callCount++ === 0, // first call true, second false
    });
    const res = await request(app).post('/api/execute').send({
      chain: 'eth',
      rescueData: MINIMAL_RESCUE_DATA,
      compromisedKey: VALID_KEY,
      fundingKey: 'bad-key',
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/funding/i);
  });

  it('returns 200 with progress log on success', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/execute').send({
      chain: 'eth',
      rescueData: MINIMAL_RESCUE_DATA,
      compromisedKey: VALID_KEY,
      fundingKey: VALID_KEY,
      alchemyKey: ALCHEMY_KEY,
    });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.data).to.have.property('progressLog');
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      executeChainRescue: async () => { throw new Error('Insufficient funds'); },
    });
    const res = await request(app).post('/api/execute').send({
      chain: 'eth',
      rescueData: MINIMAL_RESCUE_DATA,
      compromisedKey: VALID_KEY,
      fundingKey: VALID_KEY,
    });
    expect(res.status).to.equal(500);
    expect(res.body.error).to.equal('Insufficient funds');
  });
});

// ─── POST /api/sweep ──────────────────────────────────────────────────────────

describe('POST /api/sweep', () => {
  it('returns 400 when fromKey is missing', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/sweep')
      .send({ toAddress: VALID_ADDRESS, chain: 'eth' });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/source/i);
  });

  it('returns 400 when toAddress is missing', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/sweep')
      .send({ fromKey: VALID_KEY, chain: 'eth' });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/destination/i);
  });

  it('returns 400 when chain is missing', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/sweep')
      .send({ fromKey: VALID_KEY, toAddress: VALID_ADDRESS });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/chain/i);
  });

  it('returns 200 on success', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/sweep')
      .send({ fromKey: VALID_KEY, toAddress: VALID_ADDRESS, chain: 'eth' });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      sweepETH: async () => { throw new Error('No balance'); },
    });
    const res = await request(app)
      .post('/api/sweep')
      .send({ fromKey: VALID_KEY, toAddress: VALID_ADDRESS, chain: 'eth' });
    expect(res.status).to.equal(500);
  });
});

// ─── POST /api/balances-all ───────────────────────────────────────────────────

describe('POST /api/balances-all', () => {
  it('returns 400 when neither privateKey nor address is provided', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/balances-all').send({});
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/key or address/i);
  });

  it('accepts address field (read-only mode)', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/balances-all')
      .send({ address: VALID_ADDRESS, alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('accepts privateKey field', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/balances-all')
      .send({ privateKey: VALID_KEY, alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(200);
  });

  it('address field takes precedence over privateKey', async () => {
    let receivedArg;
    const app = await loadApp({
      getAllBalances: async (keyOrAddr) => {
        receivedArg = keyOrAddr;
        return { success: true, data: { address: VALID_ADDRESS, balances: [] } };
      },
    });
    await request(app)
      .post('/api/balances-all')
      .send({ privateKey: VALID_KEY, address: VALID_ADDRESS });
    expect(receivedArg).to.equal(VALID_ADDRESS);
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      getAllBalances: async () => { throw new Error('Bad key'); },
    });
    const res = await request(app)
      .post('/api/balances-all')
      .send({ privateKey: VALID_KEY });
    expect(res.status).to.equal(500);
  });
});

// ─── POST /api/tokens ─────────────────────────────────────────────────────────

describe('POST /api/tokens', () => {
  it('returns 400 when privateKey is missing', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/tokens')
      .send({ alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/private key/i);
  });

  it('returns 400 when alchemyKey is missing', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/tokens')
      .send({ privateKey: VALID_KEY });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/alchemy/i);
  });

  it('returns 200 with tokens array on success', async () => {
    const app = await loadApp();
    const res = await request(app)
      .post('/api/tokens')
      .send({ privateKey: VALID_KEY, alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      scanAllTokens: async () => { throw new Error('Scan error'); },
    });
    const res = await request(app)
      .post('/api/tokens')
      .send({ privateKey: VALID_KEY, alchemyKey: ALCHEMY_KEY });
    expect(res.status).to.equal(500);
    expect(res.body.error).to.equal('Scan error');
  });
});

// ─── POST /api/sweep-token ────────────────────────────────────────────────────

describe('POST /api/sweep-token', () => {
  it('returns 400 when any required field is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/sweep-token').send({});
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/missing/i);
  });

  it('returns 400 when tokenContract is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/sweep-token').send({
      fromKey: VALID_KEY,
      toAddress: VALID_ADDRESS,
      chain: 'eth',
    });
    expect(res.status).to.equal(400);
  });

  it('returns 200 on success', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/sweep-token').send({
      fromKey: VALID_KEY,
      toAddress: VALID_ADDRESS,
      chain: 'eth',
      tokenContract: VALID_ADDRESS_2,
      alchemyKey: ALCHEMY_KEY,
    });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      sweepToken: async () => { throw new Error('Zero balance'); },
    });
    const res = await request(app).post('/api/sweep-token').send({
      fromKey: VALID_KEY,
      toAddress: VALID_ADDRESS,
      chain: 'eth',
      tokenContract: VALID_ADDRESS_2,
    });
    expect(res.status).to.equal(500);
    expect(res.body.error).to.equal('Zero balance');
  });
});

// ─── POST /api/manifold ───────────────────────────────────────────────────────

describe('POST /api/manifold', () => {
  it('returns 400 when contractAddress is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/manifold').send({
      newOwner: VALID_ADDRESS,
      privateKey: VALID_KEY,
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/contract/i);
  });

  it('returns 400 when newOwner is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/manifold').send({
      contractAddress: VALID_ADDRESS,
      privateKey: VALID_KEY,
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/owner/i);
  });

  it('returns 400 when privateKey is missing', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/manifold').send({
      contractAddress: VALID_ADDRESS,
      newOwner: VALID_ADDRESS_2,
    });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/private key/i);
  });

  it('returns 200 on success', async () => {
    const app = await loadApp();
    const res = await request(app).post('/api/manifold').send({
      contractAddress: VALID_ADDRESS,
      newOwner: VALID_ADDRESS_2,
      privateKey: VALID_KEY,
      alchemyKey: ALCHEMY_KEY,
    });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('returns 500 when engine throws', async () => {
    const app = await loadApp({
      transferManifoldOwnership: async () => { throw new Error('Not owner'); },
    });
    const res = await request(app).post('/api/manifold').send({
      contractAddress: VALID_ADDRESS,
      newOwner: VALID_ADDRESS_2,
      privateKey: VALID_KEY,
    });
    expect(res.status).to.equal(500);
    expect(res.body.error).to.equal('Not owner');
  });
});

// ─── POST /api/validate ───────────────────────────────────────────────────────

describe('POST /api/validate', () => {
  let app;
  before(async () => { app = await loadApp(); });

  it('returns 400 for unknown type', async () => {
    const res = await request(app)
      .post('/api/validate')
      .send({ type: 'unknown', value: VALID_ADDRESS });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/address.*key/i);
  });

  it('validates a correct Ethereum address', async () => {
    const res = await request(app)
      .post('/api/validate')
      .send({ type: 'address', value: VALID_ADDRESS });
    expect(res.status).to.equal(200);
    expect(res.body.valid).to.equal(true);
    expect(res.body.normalized).to.equal(VALID_ADDRESS);
  });

  it('rejects an invalid address', async () => {
    const res = await request(app)
      .post('/api/validate')
      .send({ type: 'address', value: 'not-an-address' });
    expect(res.status).to.equal(200);
    expect(res.body.valid).to.equal(false);
    expect(res.body.normalized).to.be.null;
  });

  it('normalises a lowercase address to checksummed form', async () => {
    const lower = VALID_ADDRESS.toLowerCase();
    const res = await request(app)
      .post('/api/validate')
      .send({ type: 'address', value: lower });
    expect(res.status).to.equal(200);
    expect(res.body.valid).to.equal(true);
    expect(res.body.normalized).to.equal(VALID_ADDRESS);
  });

  it('validates a correct private key', async () => {
    const res = await request(app)
      .post('/api/validate')
      .send({ type: 'key', value: VALID_KEY });
    expect(res.status).to.equal(200);
    expect(res.body.valid).to.equal(true);
  });

  it('rejects an invalid private key', async () => {
    const res = await request(app)
      .post('/api/validate')
      .send({ type: 'key', value: 'bad-key' });
    expect(res.status).to.equal(200);
    expect(res.body.valid).to.equal(false);
  });

  it('returns success:true regardless of validity', async () => {
    const res = await request(app)
      .post('/api/validate')
      .send({ type: 'address', value: 'garbage' });
    expect(res.body.success).to.equal(true);
  });
});

// ─── Frontend routes ──────────────────────────────────────────────────────────

describe('GET / and SPA catch-all', () => {
  let app;
  before(async () => { app = await loadApp(); });

  it('GET / returns 200 with HTML content', async () => {
    const res = await request(app).get('/');
    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.match(/html/i);
  });

  it('GET /some/unknown/path returns 200 (SPA catch-all)', async () => {
    const res = await request(app).get('/some/unknown/path');
    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.match(/html/i);
  });
});
