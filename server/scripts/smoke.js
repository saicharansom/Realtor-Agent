/**
 * End-to-end smoke test. Run after `npm run dev` to verify plumbing.
 *
 *   node server/scripts/smoke.js
 *
 * Exits non-zero on any failure so you can wire it into CI.
 */
const BASE = process.env.SMOKE_BASE || 'http://localhost:8787';

async function step(name, fn) {
  process.stdout.write(`→ ${name} ... `);
  try {
    const out = await fn();
    console.log('ok');
    return out;
  } catch (e) {
    console.log('FAIL');
    console.error('   ', e.message);
    process.exit(1);
  }
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

await step('health', () => get('/api/health'));

await step('webhook simulates an inbound iMessage', () =>
  post('/api/webhook/imessage', {
    from: '+15555550100',
    body: 'Hi! Is the listing on Oak Ave still available?',
    timestamp: Date.now(),
  })
);

const leads = await step('leads list includes the simulated lead', () =>
  get('/api/leads')
);
if (!leads.some(l => l.phone === '+15555550100')) {
  console.error('   simulated lead not present');
  process.exit(1);
}

console.log('\n🎉  smoke test passed.');
