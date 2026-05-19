/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  RESCUE LIFEBOAT + MARK V — Full Test Suite                       ║
 * ║  Run: node test-suite.js                                         ║
 * ║  Runs all test modules and reports a combined pass/fail summary  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Runs in order:
 *   1. test-engine.js  — engine.js pure logic + read-only Alchemy calls
 *   2. test-markv.js   — Mark V pure logic, input validation, gas math
 *   3. test-emblem.js  — Emblem Vault scan + ownership proof
 *   4. test-server.js  — API route smoke tests (starts server on port 3999)
 *
 * Options:
 *   node test-suite.js              — run all tests
 *   node test-suite.js --no-network — skip tests that call Alchemy (tests 1,2 only)
 *   node test-suite.js --no-server  — skip server smoke tests (tests 1,2,3 only)
 *
 * Environment:
 *   ALCHEMY_KEY=your_key node test-suite.js
 *
 * Run from your LIFEBOAT folder:
 *   node test-suite.js
 */

import { spawn } from 'child_process';

const args = process.argv.slice(2);
const NO_NETWORK = args.includes('--no-network');
const NO_SERVER  = args.includes('--no-server');

const ALCHEMY_KEY = process.env.ALCHEMY_KEY || 'V_jOlBzCzkYv5HVey0r6Q';

// ── Test modules to run ────────────────────────────────────────────────────────
const modules = [
  {
    file: 'test-engine.js',
    label: 'ENGINE',
    skip: false,
    description: 'engine.js pure logic + read-only Alchemy scan',
  },
  {
    file: 'test-markv.js',
    label: 'MARK V',
    skip: false,
    description: 'Mark V input validation + gas calculator math',
  },
  {
    file: 'test-emblem.js',
    label: 'EMBLEM',
    skip: NO_NETWORK,
    description: 'Emblem Vault scan + ownership proof (live Alchemy)',
  },
  {
    file: 'test-server.js',
    label: 'SERVER',
    skip: NO_SERVER || NO_NETWORK,
    description: 'API route smoke tests (starts local server on port 3999)',
  },
];

function runModule(file) {
  return new Promise((resolve) => {
    const proc = spawn('node', [file], {
      env: { ...process.env, ALCHEMY_KEY },
      stdio: 'inherit', // pipe output directly to terminal
    });

    proc.on('exit', (code) => {
      resolve({ file, exitCode: code });
    });

    proc.on('error', (err) => {
      resolve({ file, exitCode: 1, error: err.message });
    });
  });
}

async function runSuite() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RESCUE LIFEBOAT + MARK V — FULL TEST SUITE                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (NO_NETWORK) {
    console.log('  Mode: --no-network (skipping Alchemy and server tests)');
    console.log('');
  } else if (NO_SERVER) {
    console.log('  Mode: --no-server (skipping server smoke tests)');
    console.log('');
  } else {
    console.log('  Mode: full suite (all tests including live Alchemy calls)');
    console.log('');
  }

  const results = [];

  for (const mod of modules) {
    if (mod.skip) {
      console.log(`  ⊘ SKIPPED — ${mod.label}: ${mod.description}`);
      console.log('');
      results.push({ ...mod, skipped: true });
      continue;
    }

    console.log(`${'═'.repeat(57)}`);
    console.log(`  RUNNING: ${mod.label}`);
    console.log(`  ${mod.description}`);
    console.log(`${'═'.repeat(57)}`);

    const result = await runModule(mod.file);
    results.push({ ...mod, ...result, skipped: false });
  }

  // ── Final summary ────────────────────────────────────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SUITE SUMMARY                                                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  let anyFailed = false;
  for (const r of results) {
    if (r.skipped) {
      console.log(`║  ⊘ SKIPPED  ${r.label.padEnd(10)}  ${r.description.slice(0, 38).padEnd(38)} ║`);
    } else if (r.exitCode === 0) {
      console.log(`║  ✓ PASSED   ${r.label.padEnd(10)}  ${r.description.slice(0, 38).padEnd(38)} ║`);
    } else {
      console.log(`║  ✗ FAILED   ${r.label.padEnd(10)}  ${r.description.slice(0, 38).padEnd(38)} ║`);
      anyFailed = true;
    }
  }

  console.log('╠══════════════════════════════════════════════════════════════╣');
  if (!anyFailed) {
    console.log('║                                                               ║');
    console.log('║  ✓ ALL TESTS PASSED — safe to ship                            ║');
    console.log('║                                                               ║');
  } else {
    console.log('║                                                               ║');
    console.log('║  ✗ SOME TESTS FAILED — review output above before shipping    ║');
    console.log('║                                                               ║');
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  process.exit(anyFailed ? 1 : 0);
}

runSuite().catch(e => {
  console.error('Suite runner crashed:', e.message);
  process.exit(1);
});
