/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ENGINE — Test Script                                             ║
 * ║  Run: node test-engine.js                                        ║
 * ║  Tests pure logic (no network) + read-only Alchemy calls         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Pure logic tests run with no network at all.
 * Read-only tests hit live Alchemy API but spend nothing.
 * No private keys needed. No transactions sent.
 *
 * Run from your LIFEBOAT folder:
 *   node test-engine.js
 *
 * Or with your own Alchemy key:
 *   ALCHEMY_KEY=your_key node test-engine.js
 */

import engine from './engine.js';
import { ethers } from 'ethers';

const ALCHEMY_KEY = process.env.ALCHEMY_KEY || 'V_jOlBzCzkYv5HVey0r6Q';

// Known wallet with NFTs — Kane's original compromised wallet, now empty but scannable
const TEST_WALLET = '0x9a2831d03a725e040a9b880De4b250e596069E53';

// A throwaway private key — not a real wallet, just used to test key validation
const TEST_THROWAWAY_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

let passed = 0;
let failed = 0;

function test(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ENGINE MODULE — TEST SUITE');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── TEST 1: Module loads and exports correctly ──────────────────────────────
  console.log('── Module exports ──');
  test('engine.default exports object',     typeof engine === 'object');
  test('validateAddress exported',          typeof engine.validateAddress === 'function');
  test('validatePrivateKey exported',       typeof engine.validatePrivateKey === 'function');
  test('scanAllChains exported',            typeof engine.scanAllChains === 'function');
  test('estimateChainGas exported',         typeof engine.estimateChainGas === 'function');
  test('executeChainRescue exported',       typeof engine.executeChainRescue === 'function');
  test('getBalances exported',              typeof engine.getBalances === 'function');
  test('getAllBalances exported',           typeof engine.getAllBalances === 'function');
  test('scanAllTokens exported',            typeof engine.scanAllTokens === 'function');
  test('sweepETH exported',                 typeof engine.sweepETH === 'function');
  test('sweepToken exported',               typeof engine.sweepToken === 'function');
  test('quietFund exported',                typeof engine.quietFund === 'function');
  test('transferManifoldOwnership exported',typeof engine.transferManifoldOwnership === 'function');
  test('scanFractalNFTs exported',          typeof engine.scanFractalNFTs === 'function');
  test('CHAINS exported',                   typeof engine.CHAINS === 'object');
  console.log('');

  // ── TEST 2: CHAINS config ───────────────────────────────────────────────────
  console.log('── CHAINS config ──');
  const requiredChains = ['eth', 'polygon', 'base', 'optimism', 'avalanche'];
  for (const chain of requiredChains) {
    test(`CHAINS.${chain} exists`, !!engine.CHAINS[chain]);
    if (engine.CHAINS[chain]) {
      test(`CHAINS.${chain}.chainId is number`, typeof engine.CHAINS[chain].chainId === 'number');
      test(`CHAINS.${chain}.rpc is string`,     typeof engine.CHAINS[chain].rpc === 'string');
      test(`CHAINS.${chain}.nativeSymbol`,      typeof engine.CHAINS[chain].nativeSymbol === 'string');
    }
  }
  // ETH should be MEV protected
  test('ETH chain has MEV RPC', engine.CHAINS.eth?.rpc?.includes('mevblocker') ||
    engine.CHAINS.eth?.mevRpc?.includes('mevblocker'));
  console.log('');

  // ── TEST 3: validateAddress ─────────────────────────────────────────────────
  console.log('── validateAddress ──');
  // This is the function that broke when ethers v5 was installed
  // If it returns null for a valid address, ethers version is wrong
  const checksummed = engine.validateAddress('0x9a2831d03a725e040a9b880De4b250e596069E53');
  test('Valid address returns checksummed string',  typeof checksummed === 'string');
  test('Returns checksummed version',               checksummed === '0x9a2831d03a725e040a9b880De4b250e596069E53');
  test('Lowercase address normalizes correctly',    engine.validateAddress('0x9a2831d03a725e040a9b880de4b250e596069e53') !== null);
  test('Invalid address returns null',              engine.validateAddress('not-an-address') === null);
  test('Empty string returns null',                 engine.validateAddress('') === null);
  test('Null returns null',                         engine.validateAddress(null) === null);
  test('Short address returns null',                engine.validateAddress('0x1234') === null);
  test('ethers version is v6',                      ethers.version?.startsWith('6'));
  console.log('');

  // ── TEST 4: validatePrivateKey ──────────────────────────────────────────────
  console.log('── validatePrivateKey ──');
  test('Valid throwaway key returns true',   engine.validatePrivateKey(TEST_THROWAWAY_KEY));
  test('Invalid key returns false',          !engine.validatePrivateKey('not-a-key'));
  test('Empty string returns false',         !engine.validatePrivateKey(''));
  test('Short hex returns false',            !engine.validatePrivateKey('0x1234'));
  test('Address (not key) returns false',    !engine.validatePrivateKey(TEST_WALLET));
  console.log('');

  // ── TEST 5: scanAllChains — shape validation (live Alchemy, read-only) ──────
  console.log('── scanAllChains (live read-only scan) ──');
  try {
    const result = await engine.scanAllChains(TEST_WALLET, ALCHEMY_KEY);
    test('Returns success: true',         result.success === true);
    test('Returns data object',           typeof result.data === 'object');
    test('data.chains is object',         typeof result.data.chains === 'object');
    test('data.rescue_from is address',   result.data.rescue_from?.startsWith('0x'));

    const chainKeys = Object.keys(result.data.chains);
    test('Returns at least one chain key', chainKeys.length > 0);

    // Check shape of each chain result
    for (const key of chainKeys) {
      test(`Chain ${key} is array`, Array.isArray(result.data.chains[key]));
    }

    // If any NFTs were found, check the shape
    const allCollections = Object.values(result.data.chains).flat();
    if (allCollections.length > 0) {
      const coll = allCollections[0];
      test('Collection has contract',    typeof coll.contract === 'string');
      test('Collection has token_type',  typeof coll.token_type === 'string');
      test('Collection has tokens array',Array.isArray(coll.tokens));
      if (coll.tokens.length > 0) {
        test('Token has tokenId',        coll.tokens[0].tokenId !== undefined);
      }
    }

    const total = allCollections.reduce((s, c) => s + c.tokens.length, 0);
    console.log(`  → Found ${total} NFTs across ${chainKeys.length} chains`);
  } catch (e) {
    test('scanAllChains completes without error', false, e.message);
  }
  console.log('');

  // ── TEST 6: scanAllChains error handling ────────────────────────────────────
  console.log('── scanAllChains error handling ──');
  try {
    await engine.scanAllChains('not-an-address', ALCHEMY_KEY);
    test('Invalid address throws', false, 'Should have thrown');
  } catch (e) {
    test('Invalid address throws', e.message.includes('Invalid') || e.message.includes('wallet'));
  }

  try {
    await engine.scanAllChains(TEST_WALLET, '');
    test('Missing Alchemy key throws', false, 'Should have thrown');
  } catch (e) {
    test('Missing Alchemy key throws', e.message.includes('Alchemy') || e.message.includes('key'));
  }
  console.log('');

  // ── TEST 7: getAllBalances — shape validation ────────────────────────────────
  console.log('── getAllBalances (live read-only) ──');
  try {
    const result = await engine.getAllBalances(TEST_WALLET, ALCHEMY_KEY);
    test('Returns success: true',           result.success === true);
    test('Returns data.balances array',     Array.isArray(result.data.balances));
    test('Has at least 5 chain results',     result.data.balances.length >= 5);

    for (const bal of result.data.balances) {
      test(`Balance entry has chain`,       typeof bal.chain === 'string');
      test(`Balance entry has balance`,     typeof bal.balance === 'string');
      test(`Balance entry has symbol`,      typeof bal.symbol === 'string');
    }
  } catch (e) {
    test('getAllBalances completes without error', false, e.message);
  }
  console.log('');

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('  ✓ All tests passed');
  } else {
    console.log('  ✗ Some tests failed — review above');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('NOTE: Write operations (transfers, sweeps) are not tested');
  console.log('here — they require funded wallets and spend real gas.');
  console.log('Test those manually via the UI after a scan confirms data.');
  console.log('');
}

runTests().catch(e => {
  console.error('Test runner crashed:', e.message);
  process.exit(1);
});
