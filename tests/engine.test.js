/**
 * Unit tests for engine.js
 * Framework: Mocha + Chai + esmock
 *
 * Functions under test:
 *   - CHAINS (exported constant)
 *   - validateAddress
 *   - validatePrivateKey
 *   - scanAllChains
 *   - estimateChainGas
 *   - getBalances
 *   - executeChainRescue
 *   - sweepETH
 *   - getAllBalances
 *   - scanAllTokens
 *   - sweepToken
 *   - transferManifoldOwnership
 *
 * Async throws are tested with explicit try/catch (Chai 5 dropped rejectedWith).
 * ethers constructors are injected via esmock to avoid ESM stubbing limitations.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { ethers as realEthers } from 'ethers';
import {
  CHAINS,
  validateAddress,
  validatePrivateKey,
  scanAllChains,
} from '../engine.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_ADDRESS   = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth checksummed
const VALID_ADDRESS_2 = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const INVALID_ADDRESS = 'not-an-address';

// A known-good 32-byte private key (test vector only — no real funds)
const VALID_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
// The address that corresponds to the key above (Hardhat account #0)
const VALID_KEY_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
// A second Hardhat key whose address differs from VALID_KEY_ADDRESS
const DIFFERENT_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const VALID_ALCHEMY_KEY = 'test-alchemy-key-1234';

// Minimal rescue data structure
function makeRescueData(chainJsonKey) {
  return {
    rescue_from: VALID_KEY_ADDRESS,
    rescue_to:   VALID_ADDRESS_2,
    chains: {
      [chainJsonKey]: [
        {
          collection: 'Test Collection',
          contract: VALID_ADDRESS,
          token_type: 'ERC721',
          tokens: [{ tokenId: '1', name: 'Token #1', image: '', balance: 1 }],
        },
      ],
    },
  };
}

// Helper: load engine with a fake ethers implementation injected via esmock.
// fakeEthersOverrides is merged onto a base fake that passes through pure
// utility functions (formatEther, parseUnits, etc.) from the real ethers.
async function loadEngineWith(fakeEthersOverrides = {}) {
  const fakeEthers = {
    ...realEthers,
    ...fakeEthersOverrides,
  };
  return esmock('../engine.js', { 'ethers': { ethers: fakeEthers } });
}

// Helper: assert an async function rejects with a message matching a string/regex.
async function assertRejects(fn, msgMatcher) {
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = true;
    if (typeof msgMatcher === 'string') {
      expect(e.message).to.include(msgMatcher);
    } else {
      expect(e.message).to.match(msgMatcher);
    }
  }
  expect(threw, 'Expected function to throw but it did not').to.equal(true);
}

// ─── validateAddress ─────────────────────────────────────────────────────────

describe('validateAddress', () => {
  it('returns checksummed address for a valid address', () => {
    const result = validateAddress(VALID_ADDRESS.toLowerCase());
    expect(result).to.equal(VALID_ADDRESS);
  });

  it('returns null for an invalid address string', () => {
    expect(validateAddress(INVALID_ADDRESS)).to.be.null;
  });

  it('returns null for an empty string', () => {
    expect(validateAddress('')).to.be.null;
  });

  it('returns null for undefined input', () => {
    expect(validateAddress(undefined)).to.be.null;
  });

  it('accepts a zero address', () => {
    const zero = '0x0000000000000000000000000000000000000000';
    expect(validateAddress(zero)).to.equal(zero);
  });
});

// ─── validatePrivateKey ───────────────────────────────────────────────────────

describe('validatePrivateKey', () => {
  it('returns true for a valid 32-byte hex private key', () => {
    expect(validatePrivateKey(VALID_PRIVATE_KEY)).to.equal(true);
  });

  it('returns false for an arbitrary string', () => {
    expect(validatePrivateKey('not-a-key')).to.equal(false);
  });

  it('returns false for an empty string', () => {
    expect(validatePrivateKey('')).to.equal(false);
  });

  it('returns false for a valid address (not a private key)', () => {
    expect(validatePrivateKey(VALID_ADDRESS)).to.equal(false);
  });

  it('returns false for a key that is too short', () => {
    expect(validatePrivateKey('0x1234')).to.equal(false);
  });
});

// ─── CHAINS constant ─────────────────────────────────────────────────────────

describe('CHAINS', () => {
  it('exports an object', () => {
    expect(CHAINS).to.be.an('object');
  });

  it('contains the five expected chain keys', () => {
    expect(CHAINS).to.have.all.keys('eth', 'polygon', 'base', 'optimism', 'avalanche');
  });

  it('each chain has required fields', () => {
    const required = ['name', 'chainId', 'jsonKey', 'rpc', 'nativeSymbol', 'explorer', 'gasBuffer', 'gasForFunding'];
    for (const [key, chain] of Object.entries(CHAINS)) {
      for (const field of required) {
        expect(chain, `${key}.${field}`).to.have.property(field);
      }
    }
  });

  it('eth chain uses MEV Blocker RPC', () => {
    expect(CHAINS.eth.rpc).to.include('mevblocker.io');
    expect(CHAINS.eth.mevProtected).to.equal(true);
  });

  it('non-eth chains are not MEV-protected', () => {
    for (const key of ['polygon', 'base', 'optimism', 'avalanche']) {
      expect(CHAINS[key].mevProtected).to.equal(false);
    }
  });

  it('all chains have positive chainId', () => {
    for (const [key, chain] of Object.entries(CHAINS)) {
      expect(chain.chainId, key).to.be.a('number').and.to.be.greaterThan(0);
    }
  });

  it('gasBuffer is greater than 1 for all chains (i.e. adds overhead)', () => {
    for (const [key, chain] of Object.entries(CHAINS)) {
      expect(chain.gasBuffer, key).to.be.greaterThan(1);
    }
  });
});

// ─── scanAllChains ────────────────────────────────────────────────────────────
// scanAllChains only uses fetch (no ethers constructors), so global.fetch
// stubs work fine here without esmock.

describe('scanAllChains', () => {
  let fetchStub;

  beforeEach(() => {
    fetchStub = sinon.stub(global, 'fetch');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('throws on invalid wallet address', async () => {
    await assertRejects(() => scanAllChains(INVALID_ADDRESS, VALID_ALCHEMY_KEY), 'Invalid wallet address');
  });

  it('throws when alchemy key is missing', async () => {
    await assertRejects(() => scanAllChains(VALID_ADDRESS, ''), 'Alchemy API key required');
  });

  it('throws when alchemy key is null', async () => {
    await assertRejects(() => scanAllChains(VALID_ADDRESS, null), 'Alchemy API key required');
  });

  it('returns success:true with empty chains on HTTP error', async () => {
    fetchStub.resolves({ ok: false, status: 401, json: async () => ({}) });
    const result = await scanAllChains(VALID_ADDRESS, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(result.errors).to.be.an('array').with.length.greaterThan(0);
  });

  it('returns success:true with populated chains on valid response', async () => {
    const mockResponse = {
      ownedNfts: [
        {
          tokenId: '42',
          name: 'Cool NFT',
          contract: { address: VALID_ADDRESS, name: 'Cool Collection', tokenType: 'ERC721' },
          image: { cachedUrl: 'https://example.com/img.png' },
          balance: '1',
        },
      ],
    };
    fetchStub.resolves({ ok: true, json: async () => mockResponse });

    const result = await scanAllChains(VALID_ADDRESS, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(result.data.rescue_from.toLowerCase()).to.equal(VALID_ADDRESS.toLowerCase());
    expect(result.data.chains).to.be.an('object');
  });

  it('groups multiple tokens from same contract into one collection', async () => {
    const mockResponse = {
      ownedNfts: [
        {
          tokenId: '1',
          name: 'NFT #1',
          contract: { address: VALID_ADDRESS, name: 'MyCollection', tokenType: 'ERC721' },
          image: {},
          balance: '1',
        },
        {
          tokenId: '2',
          name: 'NFT #2',
          contract: { address: VALID_ADDRESS, name: 'MyCollection', tokenType: 'ERC721' },
          image: {},
          balance: '1',
        },
      ],
    };
    fetchStub.resolves({ ok: true, json: async () => mockResponse });

    const result = await scanAllChains(VALID_ADDRESS, VALID_ALCHEMY_KEY);
    const ethChain = result.data.chains['eth-mainnet'];
    expect(ethChain).to.be.an('array').with.lengthOf(1);
    expect(ethChain[0].tokens).to.have.lengthOf(2);
  });

  it('normalizes wallet address to checksummed form in response', async () => {
    fetchStub.resolves({ ok: true, json: async () => ({ ownedNfts: [] }) });
    const lower = VALID_ADDRESS.toLowerCase();
    const result = await scanAllChains(lower, VALID_ALCHEMY_KEY);
    expect(result.data.rescue_from).to.equal(VALID_ADDRESS);
  });

  it('collects errors per chain without throwing', async () => {
    fetchStub.rejects(new Error('network failure'));
    const result = await scanAllChains(VALID_ADDRESS, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(result.errors.length).to.equal(5);
  });
});

// ─── estimateChainGas ─────────────────────────────────────────────────────────

describe('estimateChainGas', () => {
  it('throws on unknown chain key', async () => {
    const { estimateChainGas } = await loadEngineWith();
    await assertRejects(() => estimateChainGas('unknown-chain', {}, VALID_ALCHEMY_KEY), 'Unknown chain: unknown-chain');
  });

  it('returns zero-cost result when chain has no collections in rescue data', async () => {
    const { estimateChainGas } = await loadEngineWith();
    const rescueData = { chains: { 'eth-mainnet': [] } };
    const result = await estimateChainGas('eth', rescueData, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(result.data.tokenCount).to.equal(0);
    expect(result.data.totalGasUnits).to.equal(0);
    expect(result.data.totalCostNative).to.equal('0');
  });

  it('returns zero-cost result when chain key not present in rescue data', async () => {
    const { estimateChainGas } = await loadEngineWith();
    const rescueData = { chains: {} };
    const result = await estimateChainGas('eth', rescueData, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(result.data.tokenCount).to.equal(0);
  });

  it('throws when rescue_from is missing and collections exist', async () => {
    const { estimateChainGas } = await loadEngineWith({
      JsonRpcProvider: function() {
        return {
          getFeeData: async () => ({ maxFeePerGas: realEthers.parseUnits('20', 'gwei') }),
          estimateGas: async () => 65000n,
        };
      },
    });
    const rescueData = makeRescueData('eth-mainnet');
    delete rescueData.rescue_from;
    await assertRejects(() => estimateChainGas('eth', rescueData, VALID_ALCHEMY_KEY), 'rescue_from and rescue_to addresses required');
  });

  it('response shape contains all expected fields for empty chain', async () => {
    const { estimateChainGas } = await loadEngineWith();
    const rescueData = { chains: { 'eth-mainnet': [] } };
    const result = await estimateChainGas('eth', rescueData, VALID_ALCHEMY_KEY);
    const d = result.data;
    expect(d).to.include.all.keys(
      'chain', 'chainName', 'tokenCount', 'totalGasUnits',
      'gasPriceGwei', 'totalCostNative', 'nativeSymbol', 'mevProtected'
    );
    expect(d.chain).to.equal('eth');
    expect(d.nativeSymbol).to.equal('ETH');
    expect(d.mevProtected).to.equal(true);
  });
});

// ─── getBalances ──────────────────────────────────────────────────────────────

describe('getBalances', () => {
  it('throws on unknown chain key', async () => {
    const { getBalances } = await loadEngineWith();
    await assertRejects(() => getBalances([VALID_ADDRESS], 'unknown', VALID_ALCHEMY_KEY), 'Unknown chain: unknown');
  });

  it('returns error entry for invalid address without throwing', async () => {
    const { getBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => 0n }; },
    });
    const result = await getBalances([INVALID_ADDRESS], 'eth', VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    const entry = result.data.balances.find(b => b.address === INVALID_ADDRESS);
    expect(entry).to.exist;
    expect(entry.error).to.equal('Invalid address');
  });

  it('response contains chain and nativeSymbol', async () => {
    const { getBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => 0n }; },
    });
    const result = await getBalances([], 'polygon', VALID_ALCHEMY_KEY);
    expect(result.data.chain).to.equal('polygon');
    expect(result.data.nativeSymbol).to.equal('POL');
  });

  it('handles mix of valid and invalid addresses gracefully', async () => {
    const { getBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => 1000000000000000000n }; },
    });
    const result = await getBalances([VALID_ADDRESS, INVALID_ADDRESS], 'eth', VALID_ALCHEMY_KEY);
    expect(result.data.balances).to.have.lengthOf(2);
    const valid = result.data.balances.find(b => b.address === VALID_ADDRESS);
    const invalid = result.data.balances.find(b => b.address === INVALID_ADDRESS);
    expect(valid.error).to.be.undefined;
    expect(invalid.error).to.equal('Invalid address');
  });

  it('formats balance as ETH string', async () => {
    const oneEth = 1000000000000000000n;
    const { getBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => oneEth }; },
    });
    const result = await getBalances([VALID_ADDRESS], 'eth', VALID_ALCHEMY_KEY);
    expect(result.data.balances[0].balance).to.equal('1.0');
  });
});

// ─── sweepETH ─────────────────────────────────────────────────────────────────

describe('sweepETH', () => {
  it('throws on unknown chain key', async () => {
    const { sweepETH } = await loadEngineWith();
    await assertRejects(() => sweepETH(VALID_PRIVATE_KEY, VALID_ADDRESS, 'unknown-chain', VALID_ALCHEMY_KEY), 'Unknown chain: unknown-chain');
  });

  it('throws on invalid private key', async () => {
    const { sweepETH } = await loadEngineWith();
    await assertRejects(() => sweepETH('bad-key', VALID_ADDRESS, 'eth', VALID_ALCHEMY_KEY), 'Invalid private key');
  });

  it('throws on invalid destination address', async () => {
    const { sweepETH } = await loadEngineWith();
    await assertRejects(() => sweepETH(VALID_PRIVATE_KEY, INVALID_ADDRESS, 'eth', VALID_ALCHEMY_KEY), 'Invalid destination address');
  });

  it('throws when wallet balance is zero', async () => {
    const { sweepETH } = await loadEngineWith({
      JsonRpcProvider: function() {
        return {
          getBalance: async () => 0n,
          getFeeData: async () => ({ maxFeePerGas: realEthers.parseUnits('20', 'gwei') }),
        };
      },
    });
    await assertRejects(() => sweepETH(VALID_PRIVATE_KEY, VALID_ADDRESS, 'eth', VALID_ALCHEMY_KEY), 'Wallet has no balance to sweep');
  });

  it('throws when balance is less than or equal to gas cost', async () => {
    const gasPrice = realEthers.parseUnits('20', 'gwei');
    const gasCost = gasPrice * 21000n;
    const { sweepETH } = await loadEngineWith({
      JsonRpcProvider: function() {
        return {
          getBalance: async () => gasCost,
          getFeeData: async () => ({ maxFeePerGas: gasPrice }),
        };
      },
    });
    await assertRejects(() => sweepETH(VALID_PRIVATE_KEY, VALID_ADDRESS, 'eth', VALID_ALCHEMY_KEY), 'is less than gas cost');
  });

  it('caps priorityFee to maxFee when maxFee is very low', async () => {
    const veryLowFee = realEthers.parseUnits('0.1', 'gwei');
    const sufficientBalance = realEthers.parseEther('1.0');
    let capturedTx;
    const fakeTx = { hash: '0xabc', wait: async () => ({ status: 1 }) };
    const { sweepETH } = await loadEngineWith({
      JsonRpcProvider: function() {
        return {
          getBalance: async () => sufficientBalance,
          getFeeData: async () => ({ maxFeePerGas: veryLowFee }),
        };
      },
      Wallet: function(key, provider) {
        return {
          address: VALID_KEY_ADDRESS,
          sendTransaction: async (tx) => { capturedTx = tx; return fakeTx; },
        };
      },
    });
    const result = await sweepETH(VALID_PRIVATE_KEY, VALID_ADDRESS, 'eth', VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(capturedTx.maxPriorityFeePerGas <= capturedTx.maxFeePerGas).to.equal(true);
  });
});

// ─── getAllBalances ───────────────────────────────────────────────────────────

describe('getAllBalances', () => {
  it('throws on invalid private key input', async () => {
    const { getAllBalances } = await loadEngineWith();
    await assertRejects(() => getAllBalances('not-a-key-or-address', VALID_ALCHEMY_KEY), 'Invalid private key or address');
  });

  it('accepts a plain public address (read-only mode)', async () => {
    const { getAllBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => 0n }; },
    });
    const result = await getAllBalances(VALID_ADDRESS, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(result.data.address.toLowerCase()).to.equal(VALID_ADDRESS.toLowerCase());
  });

  it('accepts a private key and derives the address', async () => {
    const { getAllBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => 0n }; },
    });
    const result = await getAllBalances(VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(result.data.address.toLowerCase()).to.equal(VALID_KEY_ADDRESS.toLowerCase());
  });

  it('returns balances for all five chains', async () => {
    const { getAllBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => 0n }; },
    });
    const result = await getAllBalances(VALID_ADDRESS, VALID_ALCHEMY_KEY);
    expect(result.data.balances).to.have.lengthOf(Object.keys(CHAINS).length);
  });

  it('records error on chain without throwing if provider fails', async () => {
    const { getAllBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => { throw new Error('RPC down'); } }; },
    });
    const result = await getAllBalances(VALID_ADDRESS, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    for (const entry of result.data.balances) {
      expect(entry).to.have.property('error');
    }
  });

  it('each balance entry includes chain, name, balance, symbol', async () => {
    const { getAllBalances } = await loadEngineWith({
      JsonRpcProvider: function() { return { getBalance: async () => 0n }; },
    });
    const result = await getAllBalances(VALID_ADDRESS, VALID_ALCHEMY_KEY);
    for (const entry of result.data.balances) {
      expect(entry).to.include.all.keys('chain', 'name', 'balance', 'symbol');
    }
  });
});

// ─── executeChainRescue ───────────────────────────────────────────────────────

describe('executeChainRescue', () => {
  it('throws on unknown chain key', async () => {
    const { executeChainRescue } = await loadEngineWith();
    await assertRejects(
      () => executeChainRescue('unknown', makeRescueData('eth-mainnet'), VALID_PRIVATE_KEY, VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY),
      'Unknown chain: unknown'
    );
  });

  it('throws when chain has no NFTs in rescue data', async () => {
    const { executeChainRescue } = await loadEngineWith();
    const rescueData = { chains: { 'eth-mainnet': [] }, rescue_from: VALID_KEY_ADDRESS, rescue_to: VALID_ADDRESS_2 };
    await assertRejects(
      () => executeChainRescue('eth', rescueData, VALID_PRIVATE_KEY, VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY),
      'No NFTs for Ethereum Mainnet in rescue data'
    );
  });

  it('throws on invalid compromised wallet key', async () => {
    const { executeChainRescue } = await loadEngineWith();
    await assertRejects(
      () => executeChainRescue('eth', makeRescueData('eth-mainnet'), 'bad-key', VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY),
      'Invalid compromised wallet private key'
    );
  });

  it('throws on invalid funding wallet key', async () => {
    const { executeChainRescue } = await loadEngineWith();
    await assertRejects(
      () => executeChainRescue('eth', makeRescueData('eth-mainnet'), VALID_PRIVATE_KEY, 'bad-key', VALID_ALCHEMY_KEY),
      'Invalid funding wallet private key'
    );
  });

  it('throws when rescue_from and rescue_to are absent', async () => {
    const { executeChainRescue } = await loadEngineWith();
    const rescueData = makeRescueData('eth-mainnet');
    delete rescueData.rescue_from;
    delete rescueData.rescue_to;
    await assertRejects(
      () => executeChainRescue('eth', rescueData, VALID_PRIVATE_KEY, VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY),
      'rescue_from and rescue_to addresses required'
    );
  });

  it('throws when compromised key does not match rescue_from address', async () => {
    const { executeChainRescue } = await loadEngineWith({
      JsonRpcProvider: function() {
        return {
          getFeeData: async () => ({ maxFeePerGas: realEthers.parseUnits('20', 'gwei') }),
          getBalance: async () => realEthers.parseEther('10'),
          getTransactionCount: async () => 0,
          estimateGas: async () => 65000n,
        };
      },
    });
    const rescueData = makeRescueData('eth-mainnet');
    await assertRejects(
      () => executeChainRescue('eth', rescueData, DIFFERENT_PRIVATE_KEY, VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY),
      'Compromised key resolves to'
    );
  });
});

// ─── scanAllTokens ────────────────────────────────────────────────────────────
// scanAllTokens only uses fetch (no ethers constructors beyond Wallet for
// address derivation), so global.fetch stubs work fine here.

describe('scanAllTokens', () => {
  let fetchStub;

  beforeEach(() => {
    fetchStub = sinon.stub(global, 'fetch');
  });

  afterEach(() => sinon.restore());

  it('throws on invalid private key', async () => {
    const { scanAllTokens } = await loadEngineWith();
    await assertRejects(() => scanAllTokens('not-a-key', VALID_ALCHEMY_KEY), 'Invalid private key');
  });

  it('throws when alchemy key is missing', async () => {
    const { scanAllTokens } = await loadEngineWith();
    await assertRejects(() => scanAllTokens(VALID_PRIVATE_KEY, ''), 'Alchemy key required');
  });

  it('throws when alchemy key is null', async () => {
    const { scanAllTokens } = await loadEngineWith();
    await assertRejects(() => scanAllTokens(VALID_PRIVATE_KEY, null), 'Alchemy key required');
  });

  it('returns success:true with empty tokens when all chains fail', async () => {
    fetchStub.rejects(new Error('network error'));
    const { scanAllTokens } = await loadEngineWith();
    const result = await scanAllTokens(VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY);
    expect(result.success).to.equal(true);
    expect(result.data.tokens).to.be.an('array').with.lengthOf(0);
  });

  it('skips tokens with zero balance hex string', async () => {
    const zeroBalance = '0x0000000000000000000000000000000000000000000000000000000000000000';
    fetchStub.resolves({
      ok: true,
      json: async () => ({
        result: { tokenBalances: [{ contractAddress: VALID_ADDRESS, tokenBalance: zeroBalance }] },
      }),
    });
    const { scanAllTokens } = await loadEngineWith();
    const result = await scanAllTokens(VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY);
    expect(result.data.tokens).to.have.lengthOf(0);
  });

  it('returns address derived from private key', async () => {
    fetchStub.resolves({
      ok: true,
      json: async () => ({ result: { tokenBalances: [] } }),
    });
    const { scanAllTokens } = await loadEngineWith();
    const result = await scanAllTokens(VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY);
    expect(result.data.address.toLowerCase()).to.equal(VALID_KEY_ADDRESS.toLowerCase());
  });

  it('sorts tokens by balance descending', async () => {
    const mockBalancesResponse = {
      result: {
        tokenBalances: [
          { contractAddress: VALID_ADDRESS, tokenBalance: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000' },
          { contractAddress: VALID_ADDRESS_2, tokenBalance: '0x00000000000000000000000000000000000000000000d3c21bcecceda1000000' },
        ],
      },
    };
    const mockMetaResponse = (symbol, decimals) => ({ result: { symbol, name: symbol, decimals } });
    let callCount = 0;
    fetchStub.callsFake(async (_url, opts) => {
      const body = JSON.parse(opts?.body || '{}');
      if (body.method === 'alchemy_getTokenBalances') return { ok: true, json: async () => mockBalancesResponse };
      if (body.method === 'alchemy_getTokenMetadata') {
        callCount++;
        return { ok: true, json: async () => mockMetaResponse(callCount % 2 === 1 ? 'SMALL' : 'BIG', 18) };
      }
      return { ok: true, json: async () => ({}) };
    });
    const { scanAllTokens } = await loadEngineWith();
    const result = await scanAllTokens(VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY);
    if (result.data.tokens.length >= 2) {
      const [first, second] = result.data.tokens;
      expect(parseFloat(first.balance)).to.be.greaterThanOrEqual(parseFloat(second.balance));
    }
  });
});

// ─── sweepToken ───────────────────────────────────────────────────────────────

describe('sweepToken', () => {
  it('throws on unknown chain key', async () => {
    const { sweepToken } = await loadEngineWith();
    await assertRejects(() => sweepToken(VALID_PRIVATE_KEY, VALID_ADDRESS, 'unknown', VALID_ADDRESS, VALID_ALCHEMY_KEY), 'Unknown chain: unknown');
  });

  it('throws on invalid private key', async () => {
    const { sweepToken } = await loadEngineWith();
    await assertRejects(() => sweepToken('bad-key', VALID_ADDRESS, 'eth', VALID_ADDRESS, VALID_ALCHEMY_KEY), 'Invalid private key');
  });

  it('throws on invalid destination address', async () => {
    const { sweepToken } = await loadEngineWith();
    await assertRejects(() => sweepToken(VALID_PRIVATE_KEY, INVALID_ADDRESS, 'eth', VALID_ADDRESS, VALID_ALCHEMY_KEY), 'Invalid destination address');
  });

  it('throws on invalid token contract address', async () => {
    const { sweepToken } = await loadEngineWith();
    await assertRejects(() => sweepToken(VALID_PRIVATE_KEY, VALID_ADDRESS, 'eth', INVALID_ADDRESS, VALID_ALCHEMY_KEY), 'Invalid token contract');
  });

  it('throws when token balance is zero', async () => {
    const { sweepToken } = await loadEngineWith({
      JsonRpcProvider: function() {
        return {
          getBalance: async () => realEthers.parseEther('1'),
          getFeeData: async () => ({ maxFeePerGas: realEthers.parseUnits('20', 'gwei') }),
        };
      },
      Wallet: function() { return { address: VALID_KEY_ADDRESS }; },
      Contract: function() { return { balanceOf: async () => 0n }; },
    });
    await assertRejects(() => sweepToken(VALID_PRIVATE_KEY, VALID_ADDRESS, 'eth', VALID_ADDRESS_2, VALID_ALCHEMY_KEY), 'Token balance is zero');
  });

  it('throws when native balance is zero (cannot pay gas)', async () => {
    const { sweepToken } = await loadEngineWith({
      JsonRpcProvider: function() {
        return {
          getBalance: async () => 0n,
          getFeeData: async () => ({ maxFeePerGas: realEthers.parseUnits('20', 'gwei') }),
        };
      },
      Wallet: function() { return { address: VALID_KEY_ADDRESS }; },
      Contract: function() { return { balanceOf: async () => 1000000n }; },
    });
    await assertRejects(() => sweepToken(VALID_PRIVATE_KEY, VALID_ADDRESS, 'eth', VALID_ADDRESS_2, VALID_ALCHEMY_KEY), /no.*gas|native.*balance|ETH/i);
  });
});

// ─── transferManifoldOwnership ────────────────────────────────────────────────

describe('transferManifoldOwnership', () => {
  it('throws on invalid contract address', async () => {
    const { transferManifoldOwnership } = await loadEngineWith();
    await assertRejects(() => transferManifoldOwnership(INVALID_ADDRESS, VALID_ADDRESS, VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY), 'Invalid contract address');
  });

  it('throws on invalid new owner address', async () => {
    const { transferManifoldOwnership } = await loadEngineWith();
    await assertRejects(() => transferManifoldOwnership(VALID_ADDRESS, INVALID_ADDRESS, VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY), 'Invalid new owner address');
  });

  it('throws on invalid private key', async () => {
    const { transferManifoldOwnership } = await loadEngineWith();
    await assertRejects(() => transferManifoldOwnership(VALID_ADDRESS, VALID_ADDRESS_2, 'bad-key', VALID_ALCHEMY_KEY), 'Invalid private key');
  });

  it('throws when caller is not the current owner', async () => {
    const differentOwner = VALID_ADDRESS;
    const { transferManifoldOwnership } = await loadEngineWith({
      JsonRpcProvider: function() {
        return { getFeeData: async () => ({ maxFeePerGas: realEthers.parseUnits('20', 'gwei') }) };
      },
      Contract: function() {
        return {
          owner: async () => differentOwner,
          transferOwnership: async () => {},
          approveAdmin: async () => {},
          setRoyalties: async () => {},
        };
      },
    });
    await assertRejects(
      () => transferManifoldOwnership(VALID_ADDRESS, VALID_ADDRESS_2, VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY),
      'You are not the owner'
    );
  });

  it('succeeds and returns transactions array when caller is owner', async () => {
    const fakeTx = (label) => ({ hash: `0x${label}`, wait: async () => ({ status: 1 }) });
    const { transferManifoldOwnership } = await loadEngineWith({
      JsonRpcProvider: function() {
        return { getFeeData: async () => ({ maxFeePerGas: realEthers.parseUnits('20', 'gwei') }) };
      },
      Contract: function() {
        return {
          owner: async () => VALID_KEY_ADDRESS,
          transferOwnership: async () => fakeTx('transfer'),
          approveAdmin: async () => fakeTx('approve'),
          setRoyalties: async () => fakeTx('royalties'),
        };
      },
    });
    const result = await transferManifoldOwnership(
      VALID_ADDRESS, VALID_ADDRESS_2, VALID_PRIVATE_KEY, VALID_ALCHEMY_KEY
    );
    expect(result.success).to.equal(true);
    expect(result.data.transactions).to.have.lengthOf(3);
    const actions = result.data.transactions.map(t => t.action);
    expect(actions).to.include.members(['transferOwnership', 'approveAdmin', 'setRoyalties']);
  });
});
