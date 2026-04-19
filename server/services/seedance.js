/**
 * Video generation — via OpenRouter API.
 *
 * Submit:  POST https://openrouter.ai/api/v1/videos
 * Poll:    GET  <polling_url from response>
 * Done:    statusData.status === "completed", URLs in statusData.unsigned_urls[]
 *
 * Env:
 *   OPENROUTER_VIDEO_API_KEY — required for video (sk-or-v1-...)
 *   OPENROUTER_VIDEO_MODEL   — default: openai/sora-2-pro
 */

const BASE_URL = 'https://openrouter.ai/api/v1/videos';
const POLL_INTERVAL_MS = 5_000;
const MODEL = process.env.OPENROUTER_VIDEO_MODEL || 'openai/sora-2-pro';

function apiKey() {
  const key = process.env.OPENROUTER_VIDEO_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_VIDEO_API_KEY not set');
  return key;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Generate a vertical real-estate video from a text prompt.
 * @param {string} prompt
 * @returns {Promise<string>} video URL
 */
export async function generateVideoFromText(prompt) {
  return submitAndPoll({ model: MODEL, prompt });
}

/**
 * Generate a vertical video using one image as the first frame.
 * @param {string} prompt
 * @param {string} imageUrl  — public HTTPS image URL
 * @returns {Promise<string>} video URL
 */
export async function generateVideoFromImage(prompt, imageUrl) {
  if (!imageUrl?.startsWith('http'))
    throw new Error('OpenRouter video generation requires a public HTTPS image URL');
  return submitAndPoll({ model: MODEL, prompt, image: imageUrl });
}

/**
 * Generate a vertical video from multiple reference images (up to 9).
 * First image is the first frame; rest are reference images.
 * @param {string}   prompt
 * @param {string[]} imageUrls — public HTTPS image URLs
 * @returns {Promise<string>} video URL
 */
export async function generateVideoFromImages(prompt, imageUrls) {
  if (!imageUrls?.length) throw new Error('At least one image URL required');
  const urls = imageUrls.slice(0, 9);
  return submitAndPoll({
    model: MODEL,
    prompt,
    image: urls[0],
    ...(urls.length > 1 ? { reference_images: urls.slice(1) } : {}),
  });
}

// ── internal ────────────────────────────────────────────────────────────────

async function submitAndPoll(body) {
  // 1. Submit
  const submitRes = await fetch(BASE_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text().catch(() => '');
    throw new Error(`OpenRouter video submit ${submitRes.status}: ${err.slice(0, 400)}`);
  }

  const result = await submitRes.json();
  const jobId = result.id;
  const pollingUrl = result.polling_url;

  if (!jobId || !pollingUrl) {
    throw new Error(`OpenRouter video: unexpected submit response: ${JSON.stringify(result)}`);
  }
  console.log(`[seedance] job submitted via OpenRouter: ${jobId} (model=${body.model})`);

  // 2. Poll until completed or failed
  let poll = 0;
  while (true) {
    await sleep(POLL_INTERVAL_MS);
    poll++;

    const pollRes = await fetch(pollingUrl, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });

    if (!pollRes.ok) {
      console.warn(`[seedance] poll ${poll} returned ${pollRes.status}, retrying…`);
      continue;
    }

    const statusData = await pollRes.json();
    console.log(`[seedance] poll ${poll}: status=${statusData.status}`);

    if (statusData.status === 'completed') {
      const urls = statusData.unsigned_urls ?? [];
      if (!urls.length) throw new Error('OpenRouter video completed but no URLs returned');
      return urls[0];
    }

    if (statusData.status === 'failed') {
      throw new Error(`OpenRouter video failed: ${statusData.error ?? 'Unknown error'}`);
    }

    // pending / processing — keep polling
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
