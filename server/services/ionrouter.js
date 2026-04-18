/**
 * Cumulus Labs / IonRouter client — OpenAI-compatible.
 *
 * One key (`IONROUTER_API_KEY`) covers text, vision, voice, and video.
 * Base URL and models come from env so you can point at different
 * Cumulus endpoints without touching code.
 *
 * Exposed helpers:
 *   - generateScript(listing)          → {hook, beats[], cta}
 *   - rankPhotos(urls, max)            → indices best→worst
 *   - synthesizeVoiceover(text)        → Buffer (mp3) | null
 *   - generateCumulusVideo(listing)    → url | null  (optional: if Cumulus returns a hosted MP4)
 */
import OpenAI from 'openai';

// Read env at call-time to avoid ESM hoisting issue (dotenv not yet run at import time).
let _client = null;

function requireClient() {
  if (_client) return _client;
  const KEY  = process.env.IONROUTER_API_KEY;
  const BASE = process.env.IONROUTER_BASE_URL || 'https://glm.ionrouter.io/v1';
  if (!KEY) throw new Error('IONROUTER_API_KEY missing');
  _client = new OpenAI({ apiKey: KEY, baseURL: BASE });
  return _client;
}

function model(key, fallback) {
  return process.env[key] || fallback;
}

// ---------------------------------------------------------------------------
// Text — script generation
// ---------------------------------------------------------------------------
export async function generateScript(listing) {
  const c = requireClient();
  const prompt = `Write a punchy 25-second TikTok/Reels script for this listing.
Structure: one-line hook, 3 highlight beats, call-to-action.
Avoid clichés like "stunning" and "gem." Use vivid, concrete details.
Return ONLY JSON: {"hook":"...","beats":["...","...","..."],"cta":"..."}

Listing:
${JSON.stringify({
    address: listing.address,
    price: listing.price,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    description: (listing.description || '').slice(0, 800),
  }, null, 2)}`;

  const out = await c.chat.completions.create({
    model: model('IONROUTER_TEXT_MODEL', 'glm-5'),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    top_p: 0.9,
    max_tokens: 600,
  });
  const txt = out.choices?.[0]?.message?.content || '{}';
  return parseJsonLoose(txt) || {
    hook: txt.slice(0, 140),
    beats: [],
    cta: 'DM me for a private tour.',
  };
}

// ---------------------------------------------------------------------------
// Vision — photo ranking & description
// ---------------------------------------------------------------------------
export async function describeImages(photoUrls) {
  if (!photoUrls?.length) return null;

  const c = requireClient();
  const content = [
    {
      type: 'text',
      text:
        'You are a real-estate social-media editor. Look at these images of a house and write a punchy 25-second TikTok/Reels script. ' +
        'Describe what you actually see (e.g. marble countertops, hardwood floors, natural light, pool). ' +
        'Structure: one-line hook, 3 highlight beats, call-to-action. ' +
        'Avoid clichés. Return ONLY JSON: {"hook":"...","beats":["...","...","..."],"cta":"..."}',
    },
    ...photoUrls.slice(0, 5).map(u => ({ type: 'image_url', image_url: { url: u } })),
  ];

  try {
    const out = await c.chat.completions.create({
      model: model('IONROUTER_VISION_MODEL', 'glm-5'),
      messages: [{ role: 'user', content }],
      temperature: 0.7,
      max_tokens: 600,
    });
    const txt = out.choices?.[0]?.message?.content || '{}';
    return parseJsonLoose(txt);
  } catch (e) {
    console.warn('[ionrouter] describeImages failed:', e.message);
    return null;
  }
}

export async function rankPhotos(photoUrls, max = 8) {
  if (!photoUrls?.length) return [];
  if (photoUrls.length <= max) return photoUrls.map((_, i) => i);

  const c = requireClient();
  const content = [
    {
      type: 'text',
      text:
        'You are a real-estate social-media editor. Rank these listing photos ' +
        'from most to least scroll-stopping for a 30-second vertical reel. ' +
        'Return ONLY JSON: {"ranking":[<index>, ...]}. Include every index exactly once.',
    },
    ...photoUrls.map(u => ({ type: 'image_url', image_url: { url: u } })),
  ];

  try {
    const out = await c.chat.completions.create({
      model: model('IONROUTER_VISION_MODEL', 'glm-5'),
      messages: [{ role: 'user', content }],
      temperature: 0.2,
      max_tokens: 400,
    });
    const txt = out.choices?.[0]?.message?.content || '{}';
    const parsed = parseJsonLoose(txt) || {};
    return (parsed.ranking || []).slice(0, max);
  } catch (e) {
    console.warn('[ionrouter] rankPhotos failed, falling back to insertion order:', e.message);
    return photoUrls.slice(0, max).map((_, i) => i);
  }
}

// ---------------------------------------------------------------------------
// Voice — TTS
// ---------------------------------------------------------------------------
export async function synthesizeVoiceover(text, voice = 'alloy') {
  const c = requireClient();
  try {
    const res = await c.audio.speech.create({
      model: model('IONROUTER_TTS_MODEL', 'tts-1'),
      voice,
      input: text,
      response_format: 'mp3',
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  } catch (e) {
    console.warn('[ionrouter] TTS unavailable, rendering silent video:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Video — Cumulus-native generation (optional)
// If Cumulus exposes a video model via this endpoint, we ask for a URL back.
// Falls back to ffmpeg slideshow assembly if unavailable.
// ---------------------------------------------------------------------------
export async function generateCumulusVideo(listing, script) {
  const model = process.env.IONROUTER_VIDEO_MODEL;
  if (!model) return null; // not configured

  const c = requireClient();
  const prompt = `Generate a 25-second vertical (9:16) real-estate reel for this listing.
Return ONLY JSON: {"video_url":"https://..."}

Listing: ${JSON.stringify(listing)}
Script: ${JSON.stringify(script)}`;

  try {
    const out = await c.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });
    const parsed = parseJsonLoose(out.choices?.[0]?.message?.content || '{}');
    return parsed?.video_url || null;
  } catch (e) {
    console.warn('[ionrouter] Cumulus video gen unavailable:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function parseJsonLoose(text) {
  const stripped = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try { return JSON.parse(stripped); } catch { /* try harder */ }
  const m = stripped.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch { /* give up */ }
  return null;
}
