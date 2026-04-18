/**
 * Photon Spectrum client (iMessage outbound).
 *
 * We prefer `spectrum-ts` when available. If the package shape differs from
 * what we expect, we fall back to a plain fetch against PHOTON_BASE_URL.
 * That makes the build robust to SDK churn during the hackathon.
 */
let SpectrumClient = null;
try {
  const mod = await import('spectrum-ts');
  SpectrumClient = mod.Spectrum || mod.SpectrumClient || mod.default || null;
} catch {
  /* not installed yet — fetch fallback only */
}

const BASE = process.env.PHOTON_BASE_URL || 'https://api.photonapp.ai';
const KEY = process.env.PHOTON_API_KEY;

let sdk = null;
if (SpectrumClient && KEY) {
  try {
    sdk = new SpectrumClient({ apiKey: KEY });
  } catch (e) {
    console.warn('[photon] spectrum-ts init failed, using fetch fallback', e.message);
  }
}

export async function sendIMessage({ to, body }) {
  if (!KEY) {
    console.warn('[photon] PHOTON_API_KEY missing — simulating send');
    return { simulated: true, to, body };
  }

  if (sdk?.messages?.send) {
    return sdk.messages.send({ to, body });
  }

  const res = await fetch(`${BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({ to, body }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`photon send ${res.status}: ${t}`);
  }
  return res.json();
}

/** Normalize inbound webhook payloads — Photon shapes may vary. */
export function normaliseInbound(payload) {
  return {
    from: payload.from || payload.sender || payload.handle || '',
    body: payload.body || payload.message || payload.text || '',
    timestamp: payload.timestamp || payload.sent_at || Date.now(),
  };
}
