/**
 * Photon Spectrum iMessage integration using the spectrum-ts SDK.
 *
 * Flow:
 *   1. startSpectrum(onMessage) — connects to Photon and starts listening
 *   2. onMessage({ from, body, space }) fires for every inbound iMessage
 *   3. space.send(reply) or replyToSpace(space, reply) sends the response
 *   4. sendToPhone({ to, body }) opens a new DM to any number (realtor manual replies)
 *
 * Env:
 *   PHOTON_PROJECT_ID  — find in Photon dashboard → Settings
 *   PHOTON_API_KEY     — project secret key
 *   PHOTON_BASE_URL    — default: https://api.photonapp.ai
 */
// spectrum-ts is loaded dynamically inside startSpectrum() so SPECTRUM_CLOUD_URL
// is guaranteed to be set before the SDK module evaluates its cloud URL.

// Must be set BEFORE spectrum-ts is imported (module-level var in the SDK).
// We use dynamic import() inside startSpectrum() to guarantee this runs first.
process.env.SPECTRUM_CLOUD_URL = 'api.photonapp.ai';

let spectrumApp = null;

/**
 * Start the Spectrum iMessage listener.
 * Calls onMessage({ from, body, space }) for every inbound text message.
 * Safe to call multiple times — ignores if already running.
 *
 * @param {(msg: { from: string, body: string, space: object }) => Promise<void>} onMessage
 */
export async function startSpectrum(onMessage) {
  if (spectrumApp) return; // already running

  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_API_KEY;

  if (!projectId || !projectSecret) {
    console.warn('[photon] PHOTON_PROJECT_ID or PHOTON_API_KEY not set — iMessage listener disabled');
    return;
  }

  try {
    const { Spectrum } = await import('spectrum-ts');
    const { imessage } = await import('spectrum-ts/providers/imessage');

    spectrumApp = await Spectrum({
      projectId,
      projectSecret,
      providers: [imessage.config()],
    });

    console.log('[photon] Spectrum connected — listening for iMessages');

    // Run the message loop in the background (non-blocking)
    (async () => {
      for await (const [space, message] of spectrumApp.messages) {
        try {
          if (message.content.type !== 'text') continue;
          const from = message.sender.id;    // phone number e.g. "+15551234567"
          const body = message.content.text;
          await onMessage({ from, body, space });
        } catch (err) {
          console.error('[photon] message handler error:', err.message);
        }
      }
    })().catch(err => console.error('[photon] Spectrum stream error:', err.message));

  } catch (err) {
    console.warn('[photon] Spectrum init failed:', err.message);
    spectrumApp = null;
  }
}

/**
 * Reply into the same conversation space (used inside the message handler).
 * Shows a typing indicator while generating the reply.
 *
 * @param {object} space  — the Space object from the [space, message] tuple
 * @param {string} body   — reply text
 */
export async function replyToSpace(space, body) {
  await space.responding(async () => {
    await space.send(body);
  });
}

/**
 * Open a new DM and send a message to any phone number.
 * Used for realtor manual replies from the dashboard.
 *
 * @param {{ to: string, body: string }} opts
 */
export async function sendIMessage({ to, body }) {
  if (!spectrumApp) {
    console.warn('[photon] Spectrum not connected — cannot send to', to);
    return { simulated: true, to, body };
  }
  const { imessage } = await import('spectrum-ts/providers/imessage');
  const im = imessage(spectrumApp);
  const user = await im.user(to);
  const space = await im.space(user);
  await space.send(body);
  return { sent: true, to };
}

/** @deprecated kept for any remaining callers — use sendIMessage or replyToSpace */
export function normaliseInbound(payload) {
  return {
    from: payload.from || payload.sender || payload.handle || '',
    body: payload.body || payload.message || payload.text || '',
    timestamp: payload.timestamp || payload.sent_at || Date.now(),
  };
}
