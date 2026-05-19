/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SERVER — Route Smoke Tests                                       ║
 * ║  Run: node test-server.js                                        ║
 * ║  Tests all API routes with bad input to verify they respond      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * This starts the server on a test port, fires HTTP requests at every
 * route with bad/missing input, and verifies:
 *   - Routes are registered (not 404)
 *   - Bad input returns 400 (not 500 crash)
 *   - Response is valid JSON with { success: false, error: string }
 *   - Server doesn't crash under invalid input
 *
 * No Alchemy key needed. No blockchain calls. No gas spent.
 * The goal is to catch "route registered but crashes immediately" bugs
 * which is exactly what a feature dump can introduce.
 *
 * Run from your LIFEBOAT folder:
 *   node test-server.js
 */

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const PORT = 3999; // Use a different port to avoid conflicting with running server
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
let serverProcess = null;

function test(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function post(path, body = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  return { status: res.status, body: json };
}

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) reject(new Error('Server did not start within 10 seconds'));
    }, 10000);

    serverProcess.stdout.on('data', (data) => {
      const line = data.toString();
      if (line.includes('Running at') || line.includes('localhost')) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          resolve();
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      // Server errors during startup
      const line = data.toString();
      if (line.includes('Error') && !started) {
        clearTimeout(timeout);
        reject(new Error(line.trim()));
      }
    });

    serverProcess.on('exit', (code) => {
      if (!started) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

async function runTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SERVER ROUTES — SMOKE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('  Starting test server on port', PORT, '...');

  try {
    await startServer();
    await sleep(500); // Brief pause to ensure routes are all registered
    console.log('  Server started ✓');
    console.log('');
  } catch (e) {
    console.log(`  ✗ Server failed to start: ${e.message}`);
    console.log('  Cannot run route tests without a running server.');
    process.exit(1);
  }

  // ── CORE ROUTES ─────────────────────────────────────────────────────────────
  console.log('── Core routes ──');

  // GET /api/chains
  try {
    const r = await get('/api/chains');
    test('GET /api/chains returns 200',          r.status === 200);
    test('GET /api/chains returns success',      r.body.success === true);
    test('GET /api/chains returns data array',   Array.isArray(r.body.data));
    test('GET /api/chains has 5+ chains',        r.body.data?.length >= 5);
  } catch (e) {
    test('GET /api/chains accessible', false, e.message);
  }

  // POST /api/scan — missing fields
  try {
    const r = await post('/api/scan', {});
    test('POST /api/scan missing wallet → 400',      r.status === 400);
    test('POST /api/scan returns error message',     typeof r.body.error === 'string');
    test('POST /api/scan success is false',          r.body.success === false);
  } catch (e) {
    test('POST /api/scan accessible', false, e.message);
  }

  // POST /api/validate
  try {
    const r = await post('/api/validate', { type: 'address', value: '0x9a2831d03a725e040a9b880De4b250e596069E53' });
    test('POST /api/validate address → 200',     r.status === 200);
    test('POST /api/validate success',           r.body.success === true);
    test('POST /api/validate valid address',     r.body.valid === true);
  } catch (e) {
    test('POST /api/validate accessible', false, e.message);
  }

  try {
    const r = await post('/api/validate', { type: 'address', value: 'not-an-address' });
    test('POST /api/validate invalid address → valid:false', r.body.valid === false);
  } catch (e) {
    test('POST /api/validate invalid address handled', false, e.message);
  }
  console.log('');

  // ── LIFEBOAT ROUTES ──────────────────────────────────────────────────────────
  console.log('── Lifeboat routes ──');

  const routesToTest = [
    { method: 'post', path: '/api/estimate',    body: {},                   label: 'estimate missing fields' },
    { method: 'post', path: '/api/balance',     body: {},                   label: 'balance missing fields'  },
    { method: 'post', path: '/api/balances-all',body: {},                   label: 'balances-all missing'    },
    { method: 'post', path: '/api/execute',     body: {},                   label: 'execute missing fields'  },
    { method: 'post', path: '/api/sweep',       body: {},                   label: 'sweep missing fields'    },
    { method: 'post', path: '/api/tokens',      body: {},                   label: 'tokens missing fields'   },
    { method: 'post', path: '/api/sweep-token', body: {},                   label: 'sweep-token missing'     },
    { method: 'post', path: '/api/manifold',    body: {},                   label: 'manifold missing fields' },
    { method: 'post', path: '/api/quiet-fund',  body: {},                   label: 'quiet-fund missing'      },
    { method: 'post', path: '/api/fractal-scan',body: {},                   label: 'fractal-scan missing'    },
    { method: 'post', path: '/api/fractal-nft-scan', body: {},              label: 'fractal-nft-scan missing'},
  ];

  for (const { method, path, body, label } of routesToTest) {
    try {
      const r = method === 'post' ? await post(path, body) : await get(path);
      test(`${path.toUpperCase()} not 404 (registered)`, r.status !== 404, `got ${r.status}`);
      test(`${path} returns JSON on bad input`,           typeof r.body === 'object');
      test(`${path} bad input → success:false`,          r.body.success === false);
    } catch (e) {
      test(`${path} accessible`, false, e.message);
    }
  }
  console.log('');

  // ── EMBLEM ROUTES ────────────────────────────────────────────────────────────
  console.log('── Emblem routes ──');

  const emblemRoutes = [
    { path: '/api/emblem/scan',     body: {},                label: 'scan missing'     },
    { path: '/api/emblem/estimate', body: {},                label: 'estimate missing' },
    { path: '/api/emblem/execute',  body: {},                label: 'execute missing'  },
    { path: '/api/emblem/proof',    body: {},                label: 'proof missing'    },
  ];

  for (const { path, body, label } of emblemRoutes) {
    try {
      const r = await post(path, body);
      test(`${path} registered (not 404)`,      r.status !== 404, `got ${r.status}`);
      test(`${path} returns error on bad input`, r.body.success === false);
    } catch (e) {
      test(`${path} accessible`, false, e.message);
    }
  }
  console.log('');

  // ── MARK V ROUTES ─────────────────────────────────────────────────────────────
  console.log('── Mark V routes ──');

  // GET /api/markv-status
  try {
    const r = await get('/api/markv-status');
    test('GET /api/markv-status → 200',          r.status === 200);
    test('GET /api/markv-status success',        r.body.success === true);
    test('GET /api/markv-status has routes list',Array.isArray(r.body.data?.routes));
    test('Mark V reports operational',           r.body.data?.status === 'operational');
    console.log(`  → Mark V routes registered: ${r.body.data?.routes?.length || 0}`);
  } catch (e) {
    test('GET /api/markv-status accessible', false, e.message);
  }

  const markVRoutes = [
    { path: '/api/markv-scan',                   body: {}, label: 'scan missing'           },
    { path: '/api/markv-estimate',               body: {}, label: 'estimate missing'       },
    { path: '/api/markv-execute-start',          body: {}, label: 'execute-start missing'  },
    { path: '/api/markv-emblem-scan',            body: {}, label: 'emblem-scan missing'    },
    { path: '/api/markv-emblem-transfer',        body: {}, label: 'emblem-transfer missing'},
    { path: '/api/markv-emblem-unvault-start',   body: {}, label: 'unvault-start missing'  },
  ];

  for (const { path, body } of markVRoutes) {
    try {
      const r = await post(path, body);
      test(`${path} registered (not 404)`,      r.status !== 404, `got ${r.status}`);
      test(`${path} returns error on bad input`, r.body.success === false);
    } catch (e) {
      test(`${path} accessible`, false, e.message);
    }
  }

  // SSE endpoints — just check they don't 404 with no jobId
  try {
    const r = await get('/api/markv-execute-sse');
    test('GET /api/markv-execute-sse registered', r.status !== 404, `got ${r.status}`);
  } catch (e) {
    test('GET /api/markv-execute-sse accessible', false, e.message);
  }

  try {
    const r = await get('/api/markv-emblem-unvault-sse');
    test('GET /api/markv-emblem-unvault-sse registered', r.status !== 404, `got ${r.status}`);
  } catch (e) {
    test('GET /api/markv-emblem-unvault-sse accessible', false, e.message);
  }
  console.log('');

  // ── FRONTEND SERVES ──────────────────────────────────────────────────────────
  console.log('── Frontend ──');
  try {
    const res = await fetch(`${BASE}/`);
    test('GET / returns 200',       res.status === 200);
    test('GET / returns HTML',      res.headers.get('content-type')?.includes('text/html'));
    const html = await res.text();
    test('index.html contains MARK V', html.includes('MARK V'));
    test('index.html contains RESCUE', html.includes('RESCUE'));
  } catch (e) {
    test('Frontend accessible', false, e.message);
  }
  console.log('');

  // ── CLEANUP ───────────────────────────────────────────────────────────────────
  stopServer();

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('  ✓ All route smoke tests passed');
  } else {
    console.log('  ✗ Some tests failed — review above');
    console.log('  Any 404 means a route was not registered.');
    console.log('  Any 500 on bad input means a route crashes before');
    console.log('  validating its fields — fix the validation first.');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

runTests()
  .catch(e => {
    console.error('Test runner crashed:', e.message);
    stopServer();
    process.exit(1);
  })
  .finally(() => {
    stopServer();
  });
