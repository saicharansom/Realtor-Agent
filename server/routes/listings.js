import { Router } from 'express';
import bb from '../services/butterbase.js';
import { parseZillow } from '../services/zillow.js';
import {
  rankPhotos,
  generateScript,
  describeImages,
  synthesizeVoiceover,
  generateCumulusVideo,
} from '../services/ionrouter.js';
import { assembleVideo, addTextOverlay } from '../services/video.js';
import { generateVideoFromText, generateVideoFromImage, generateVideoFromImages } from '../services/seedance.js';
import { uploadImages } from '../services/butterbase-storage.js';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const r = Router();

/** POST /api/listings/parse  { zillow_url } */
r.post('/parse', async (req, res, next) => {
  try {
    const { zillow_url } = req.body;
    if (!zillow_url) return res.status(400).json({ error: 'zillow_url required' });
    const parsed = await parseZillow(zillow_url);
    const row = await bb.insert('listings', {
      zillow_url,
      address: parsed.address,
      price: parsed.price,
      beds: parsed.beds,
      baths: parsed.baths,
      sqft: parsed.sqft,
      photos: JSON.stringify(parsed.photos || []),
      description: parsed.description,
    });
    res.json(row);
  } catch (e) { next(e); }
});

/** GET /api/listings/:id */
r.get('/:id', async (req, res, next) => {
  try {
    const row = await bb.one(`SELECT * FROM listings WHERE id=$1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (e) { next(e); }
});

/** GET /api/listings  → recent listings */
r.get('/', async (_req, res, next) => {
  try {
    const rows = await bb.query(
      `SELECT * FROM listings ORDER BY created_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/listings/:id/generate-video */
r.post('/:id/generate-video', async (req, res, next) => {
  try {
    const listing = await bb.one(`SELECT * FROM listings WHERE id=$1`, [req.params.id]);
    if (!listing) return res.status(404).json({ error: 'not found' });

    const photos = normalisePhotos(listing.photos);
    if (!photos.length) return res.status(400).json({ error: 'listing has no photos' });

    // 1. Script
    const script = await generateScript(listing);

    const beats = [script.hook, ...(script.beats || []), script.cta].filter(Boolean);
    let video_url = null;
    let file_path = null;

    // 2. Try Seedance — build a property-specific prompt using listing details + script
    try {
      const propDetails = [
        listing.address,
        listing.price && `Priced at ${listing.price}`,
        listing.beds && listing.baths && `${listing.beds} beds, ${listing.baths} baths`,
        listing.sqft && `${listing.sqft} sqft`,
      ].filter(Boolean).join('. ');

      const seedancePrompt =
        `Cinematic real estate walkthrough tour. ${propDetails}. ` +
        `${script.hook} ${(script.beats || []).join(' ')} ` +
        `Smooth dolly walkthrough moving room to room, slow pan revealing each space. ` +
        `Vertical 9:16 social media reel.`;

      const publicPhotos = photos.filter(p => p?.startsWith('http'));
      const rawUrl = publicPhotos.length > 1
        ? await generateVideoFromImages(seedancePrompt, publicPhotos)
        : publicPhotos.length === 1
          ? await generateVideoFromImage(seedancePrompt, publicPhotos[0])
          : await generateVideoFromText(seedancePrompt);

      console.log('[listings] Seedance video ready:', rawUrl);
      const voText1 = [script.hook, ...(script.beats || []), script.cta].filter(Boolean).join('. ');
      const vo1 = await synthesizeVoiceover(voText1);
      video_url = await addTextOverlay(rawUrl, script, listing.id, vo1);
    } catch (e) {
      console.warn('[listings] Seedance failed, falling back to ffmpeg:', e.message);
    }

    // 3. Cumulus fallback
    if (!video_url) {
      video_url = await generateCumulusVideo(listing, script);
    }

    // 4. ffmpeg slideshow fallback
    if (!video_url) {
      const rankedIdx = await rankPhotos(photos, beats.length);
      const selectedPhotos = rankedIdx.map(i => photos[i]).filter(Boolean);
      const captions = beats.slice(0, selectedPhotos.length);
      while (captions.length < selectedPhotos.length) captions.push('');

      const voText = beats.join(' ');
      const vo = await synthesizeVoiceover(voText);

      file_path = await assembleVideo({
        photoUrls: selectedPhotos,
        voiceover: vo,
        captions,
        listingId: listing.id,
      });
      const publicBase = process.env.PUBLIC_BASE_URL || '';
      video_url = `${publicBase}/media/${listing.id}.mp4`;
    }

    const updated = await bb.update('listings', listing.id, {
      video_url,
      script: JSON.stringify(script),
    });

    res.json({ ...updated, file_path });
  } catch (e) { next(e); }
});

/**
 * POST /api/listings/generate-from-images
 * Body: { images: ["data:image/jpeg;base64,...", ...], prompt?: string }
 * Returns: { video_url, script }
 */
r.post('/generate-from-images', async (req, res, next) => {
  try {
    const { images, prompt: customPrompt } = req.body;
    if (!Array.isArray(images) || images.length === 0)
      return res.status(400).json({ error: 'images array required' });
    if (images.length > 20)
      return res.status(400).json({ error: 'Maximum 20 images allowed' });

    // 1. Upload all images to Butterbase → get public HTTPS URLs for Seedance
    let publicUrls = [];
    try {
      console.log(`[listings] uploading ${images.length} images to Butterbase…`);
      publicUrls = await uploadImages(images);
      console.log(`[listings] ${publicUrls.length} images uploaded`);
    } catch (e) {
      console.warn('[listings] Butterbase upload failed, will use ffmpeg only:', e.message);
    }

    // 2. Generate a real script based on images
    let script = {
      hook: customPrompt || 'Step inside your dream home.',
      beats: ['Stunning spaces designed for modern living.', 'Every detail crafted with care.', 'Your story starts here.'],
      cta: 'DM for a private tour.',
    };

    if (publicUrls.length > 0) {
      const aiScript = await describeImages(publicUrls);
      if (aiScript) {
        script = aiScript;
        if (customPrompt) script.hook = customPrompt; // prefer user hook if provided
      }
    }

    const beats = [script.hook, ...script.beats, script.cta];
    let video_url = null;

    // 3. Seedance image-to-video using uploaded public URLs (up to 9)
    if (publicUrls.length > 0) {
      try {
        const seedancePrompt =
          `Cinematic real estate walkthrough tour. ` +
          `${script.hook} ${(script.beats || []).join(' ')} ` +
          (customPrompt ? `${customPrompt}. ` : '') +
          `Smooth dolly walkthrough moving room to room, slow pan revealing each space. ` +
          `Vertical 9:16 social media reel.`;

        const rawUrl = await generateVideoFromImages(seedancePrompt, publicUrls);
        console.log('[listings] Seedance i2v video ready:', rawUrl);
        const listingId = `upload-${Date.now()}`;
        const voText2 = [script.hook, ...(script.beats || []), script.cta].filter(Boolean).join('. ');
        const vo2 = await synthesizeVoiceover(voText2);
        video_url = await addTextOverlay(rawUrl, script, listingId, vo2);
      } catch (e) {
        console.warn('[listings] Seedance failed, falling back to ffmpeg:', e.message);
      }
    }

    // 3. ffmpeg slideshow fallback using all uploaded images
    if (!video_url) {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rv-upload-'));
      try {
        const localPaths = await Promise.all(
          images.map(async (dataUrl, i) => {
            const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
            const ext = dataUrl.startsWith('data:image/png') ? 'png'
                      : dataUrl.startsWith('data:image/webp') ? 'webp' : 'jpg';
            const p = path.join(tmp, `img${i}.${ext}`);
            await fs.writeFile(p, Buffer.from(base64, 'base64'));
            return p;
          })
        );

        const vo = await synthesizeVoiceover(beats.join(' '));
        const captions = beats.slice(0, localPaths.length);
        while (captions.length < localPaths.length) captions.push('');

        const listingId = `upload-${Date.now()}`;
        await assembleVideo({ photoUrls: localPaths, voiceover: vo, captions, listingId });
        const publicBase = process.env.PUBLIC_BASE_URL || '';
        video_url = `${publicBase}/media/${listingId}.mp4`;
        console.log('[listings] ffmpeg fallback done:', video_url);
      } finally {
        await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
      }
    }

    res.json({ video_url, script });
  } catch (e) { next(e); }
});

function normalisePhotos(p) {
  if (!p) return [];
  if (Array.isArray(p)) return p;
  try { return JSON.parse(p); } catch { return []; }
}

export default r;
