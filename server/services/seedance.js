/**
 * Seedance video generation — ByteDance ARK API (bytepluses.com international).
 *
 * Confirmed working endpoints (tested 2026-04-19):
 *   Submit:  POST /api/v3/contents/generations/tasks
 *   Poll:    GET  /api/v3/contents/generations/tasks/{id}
 *   Video:   response.content.video_url
 *
 * Working models (access confirmed with this API key):
 *   dreamina-seedance-2-0-fast-260128   ← fastest
 *   dreamina-seedance-2-0-260128        ← highest quality
 *   seedance-1-5-pro-251215
 *   seedance-1-0-pro-fast-251015
 *   seedance-1-0-pro-250528
 *
 * Env:
 *   SEEDANCE_API_KEY   — required
 *   SEEDANCE_BASE_URL  — default: https://ark.ap-southeast.bytepluses.com/api/v3
 *   SEEDANCE_MODEL     — override model (default: dreamina-seedance-2-0-fast-260128)
 */

// Read env at call-time (not module-load-time) to avoid ESM hoisting issue
// where dotenv.config() in index.js hasn't run yet when this module is evaluated.
const TASK_PATH        = '/contents/generations/tasks';
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS        = 60; // 10 minutes

function cfg() {
  return {
    apiKey  : process.env.SEEDANCE_API_KEY,
    baseUrl : process.env.SEEDANCE_BASE_URL || 'https://ark.ap-southeast.bytepluses.com/api/v3',
    model   : process.env.SEEDANCE_MODEL    || 'dreamina-seedance-2-0-260128',
  };
}

function authHeaders() {
  return {
    Authorization: `Bearer ${cfg().apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Generate a vertical real-estate video from a text prompt.
 * @param {string} prompt
 * @param {string} [model]
 * @returns {Promise<string>} hosted video URL (valid ~24h)
 */
export async function generateVideoFromText(prompt, model) {
  const { apiKey, baseUrl, model: defaultModel } = cfg();
  model = model || defaultModel;
  if (!apiKey) throw new Error('SEEDANCE_API_KEY not set');

  return submitAndPoll({
    model,
    content: [{ type: 'text', text: prompt }],
    ratio: '9:16',
    duration: 15,
  });
}

/**
 * Generate a vertical video using one image as the first frame.
 * NOTE: imageUrl MUST be a public HTTPS URL — base64 data URLs are not accepted.
 * @param {string} prompt
 * @param {string} imageUrl  — public HTTPS image URL
 * @param {string} [model]
 * @returns {Promise<string>}
 */
export async function generateVideoFromImage(prompt, imageUrl, model) {
  const { apiKey, model: defaultModel } = cfg();
  model = model || defaultModel;
  if (!apiKey) throw new Error('SEEDANCE_API_KEY not set');
  if (!imageUrl?.startsWith('http'))
    throw new Error('Seedance image-to-video requires a public HTTPS URL');

  return submitAndPoll({
    model,
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageUrl }, role: 'first_frame' },
    ],
    ratio: '9:16',
    duration: 15,
  });
}

/**
 * Generate a vertical video from multiple reference images (up to 9).
 * All imageUrls must be public HTTPS URLs.
 * @param {string}   prompt
 * @param {string[]} imageUrls — public HTTPS image URLs
 * @param {string}  [model]
 * @returns {Promise<string>}
 */
export async function generateVideoFromImages(prompt, imageUrls, model) {
  const { apiKey, model: defaultModel } = cfg();
  model = model || defaultModel;
  if (!apiKey) throw new Error('SEEDANCE_API_KEY not set');
  if (!imageUrls?.length) throw new Error('At least one image URL required');

  // Seedance 2.0 supports max 9 reference images
  const urls = imageUrls.slice(0, 9);

  const content = [
    { type: 'text', text: prompt },
    // First image anchors the video's opening frame
    { type: 'image_url', image_url: { url: urls[0] }, role: 'first_frame' },
    // Remaining images are reference frames
    ...urls.slice(1).map(url => ({
      type: 'image_url',
      image_url: { url },
      role: 'reference_image',
    })),
  ];

  return submitAndPoll({ model, content, ratio: '9:16', duration: 15 });
}

// ── internal ────────────────────────────────────────────────────────────────

async function submitAndPoll(body) {
  const { baseUrl } = cfg();
  // 1. Submit
  const createRes = await fetch(`${baseUrl}${TASK_PATH}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '');
    throw new Error(`Seedance submit ${createRes.status}: ${err.slice(0, 400)}`);
  }

  const task = await createRes.json();
  const taskId = task.id;
  if (!taskId) throw new Error(`Seedance: no task id in response: ${JSON.stringify(task)}`);
  console.log(`[seedance] task submitted: ${taskId} (model=${body.model})`);

  // 2. Poll until done
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(`${baseUrl}${TASK_PATH}/${taskId}`, {
      headers: authHeaders(),
    });

    if (!pollRes.ok) {
      console.warn(`[seedance] poll ${i + 1} returned ${pollRes.status}, retrying…`);
      continue;
    }

    const data = await pollRes.json();
    console.log(`[seedance] poll ${i + 1}/${MAX_POLLS}: status=${data.status}`);

    if (data.status === 'succeeded') {
      const url = data.content?.video_url;
      if (!url) throw new Error(`Seedance succeeded but content.video_url missing: ${JSON.stringify(data)}`);
      return url;
    }

    if (['failed', 'expired', 'cancelled'].includes(data.status)) {
      throw new Error(`Seedance task ${data.status}: ${JSON.stringify(data.error || {})}`);
    }
    // 'submitted' | 'queued' | 'running' — keep polling
  }

  throw new Error(`Seedance: timed out after ${(MAX_POLLS * POLL_INTERVAL_MS) / 60000} minutes`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
