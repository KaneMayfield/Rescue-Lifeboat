/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  EMBLEM VAULT MODULE — Test Script                                ║
 * ║  Run: node test-emblem.js                                        ║
 * ║  Tests scan, inspect, and proof (no private keys for execution)  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * This tests against LIVE Alchemy API. No private keys needed for
 * scan and inspect tests. The proof test uses a throwaway key.
 *
 * Run from your LIFEBOAT folder:
 *   node test-emblem.js
 */

import emblemEngine from './emblem-engine.js';

const ALCHEMY_KEY = process.env.ALCHEMY_KEY || 'V_jOlBzCzkYv5HVey0r6Q';
const COMPROMISED_WALLET = '0x9a2831d03a725e040a9b880De4b250e596069E53';

// A throwaway private key for signing test ONLY — not a real wallet
// (just used to test the proof signature function works)
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
  console.log('  EMBLEM VAULT MODULE — TEST SUITE');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── TEST 1: Constants ──
  console.log('── Constants ──');
  test('EMBLEM_V2_ADDRESS exists', !!emblemEngine.EMBLEM_V2_ADDRESS);
  test('EMBLEM_LEGACY_ADDRESS exists', !!emblemEngine.EMBLEM_LEGACY_ADDRESS);
  test('V2 address is checksummed', emblemEngine.EMBLEM_V2_ADDRESS === '0x82C7a8f707110f5FBb16184A5933E9F78a34c6ab');
  test('Legacy address is checksummed', emblemEngine.EMBLEM_LEGACY_ADDRESS === '0x6Fc355D4e0EE44b292E50878F49798ff755A5bbC');
  console.log('');

  // ── TEST 2: Scan ──
  console.log('── Scan (live Alchemy call) ──');
  try {
    const scanResult = await emblemEngine.scanEmblemVaults(COMPROMISED_WALLET, ALCHEMY_KEY);
    test('Scan returns success', scanResult.success === true);
    test('Scan returns data object', !!scanResult.data);
    test('Scan returns wallet address', scanResult.data.wallet === COMPROMISED_WALLET);
    test('Scan returns vaults array', Array.isArray(scanResult.data.vaults));
    test('Scan returns totalFound number', typeof scanResult.data.totalFound === 'number');

    const vaults = scanResult.data.vaults;
    console.log(`  → Found ${vaults.length} vaults`);

    if (vaults.length > 0) {
      const v = vaults[0];
      console.log('');
      console.log('── First Vault Shape ──');
      test('Has contract field', typeof v.contract === 'string' && v.contract.startsWith('0x'));
      test('Has contractName field', typeof v.contractName === 'string');
      test('Has tokenId field', typeof v.tokenId === 'string');
      test('Has name field', typeof v.name === 'string');
      test('Has image field', typeof v.image === 'string');
      test('Has description field', typeof v.description === 'string');
      test('Has containedAssets field', typeof v.containedAssets === 'string');
      test('Has rawMetadata field', typeof v.rawMetadata === 'object');

      console.log('');
      console.log('── Vault Details ──');
      for (const vault of vaults) {
        const contractLabel = vault.contract.toLowerCase() === emblemEngine.EMBLEM_V2_ADDRESS.toLowerCase() ? 'V2' : 'Legacy';
        const assets = vault.containedAssets || '(no contents detected)';
        console.log(`  📦 [${contractLabel}] ${vault.name} — ${assets}`);
      }
    } else {
      console.log('  ⚠ No vaults found — wallet may have already been rescued');
      console.log('    This is not a test failure if the vaults were already moved.');
    }
  } catch (e) {
    test('Scan completes without error', false, e.message);
  }
  console.log('');

  // ── TEST 3: Scan with invalid address ──
  console.log('── Error Handling ──');
  try {
    await emblemEngine.scanEmblemVaults('not-an-address', ALCHEMY_KEY);
    test('Invalid address throws', false, 'Should have thrown');
  } catch (e) {
    test('Invalid address throws', e.message.includes('Invalid'));
  }

  try {
    await emblemEngine.scanEmblemVaults(COMPROMISED_WALLET, '');
    test('Missing Alchemy key throws', false, 'Should have thrown');
  } catch (e) {
    test('Missing Alchemy key throws', e.message.includes('Alchemy'));
  }
  console.log('');

  // ── TEST 4: Ownership Proof ──
  console.log('── Ownership Proof (gas-free signing) ──');
  try {
    const proofResult = await emblemEngine.generateOwnershipProof(
      '12345',
      emblemEngine.EMBLEM_V2_ADDRESS,
      TEST_THROWAWAY_KEY
    );
    test('Proof returns success', proofResult.success === true);
    test('Proof returns data', !!proofResult.data);
    test('Proof has signerAddress', typeof proofResult.data.signerAddress === 'string' && proofResult.data.signerAddress.startsWith('0x'));
    test('Proof has message', typeof proofResult.data.message === 'string' && proofResult.data.message.includes('12345'));
    test('Proof has signature', typeof proofResult.data.signature === 'string' && proofResult.data.signature.startsWith('0x'));
    test('Proof has timestamp', typeof proofResult.data.timestamp === 'number');
    test('Proof has instructions', typeof proofResult.data.instructions === 'string');
    test('Signature is 132 chars (65 bytes hex)', proofResult.data.signature.length === 132);

    console.log(`  → Signer: ${proofResult.data.signerAddress}`);
    console.log(`  → Signature: ${proofResult.data.signature.slice(0, 20)}...`);
  } catch (e) {
    test('Proof generation works', false, e.message);
  }
  console.log('');

  // ── TEST 5: Proof with invalid inputs ──
  console.log('── Proof Error Handling ──');
  try {
    await emblemEngine.generateOwnershipProof('12345', 'bad-address', TEST_THROWAWAY_KEY);
    test('Invalid contract address throws', false);
  } catch (e) {
    test('Invalid contract address throws', e.message.includes('Invalid'));
  }

  try {
    await emblemEngine.generateOwnershipProof('12345', emblemEngine.EMBLEM_V2_ADDRESS, 'bad-key');
    test('Invalid private key throws', false);
  } catch (e) {
    test('Invalid private key throws', e.message.includes('Invalid'));
  }
  console.log('');

  // ── SUMMARY ──
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('  ✓ All tests passed');
  } else {
    console.log('  ✗ Some tests failed — review above');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('NOTE: Execute/gas-estimate tests require funded wallets');
  console.log('and are tested manually via the UI. The scan and proof');
  console.log('tests above verify the module works end-to-end.');
  console.log('');
}

runTests().catch(e => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
