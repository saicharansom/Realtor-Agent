import { Router } from 'express';
import bb from '../services/butterbase.js';
import { parseZillow } from '../services/zillow.js';
import {
  rankPhotos,
  generateScript,
  synthesizeVoiceover,
  generateCumulusVideo,
} from '../services/ionrouter.js';
import { assembleVideo } from '../services/video.js';

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

    // 2. Try Cumulus-native video generation first; fall back to ffmpeg slideshow.
    let video_url = await generateCumulusVideo(listing, script);
    let file_path = null;

    if (!video_url) {
      const beats = [script.hook, ...(script.beats || []), script.cta].filter(Boolean);
      const rankedIdx = await rankPhotos(photos, beats.length);
      const selectedPhotos = rankedIdx.map(i => photos[i]).filter(Boolean);
      const captions = beats.slice(0, selectedPhotos.length);
      while (captions.length < selectedPhotos.length) captions.push('');

      const voText = [script.hook, ...(script.beats || []), script.cta]
        .filter(Boolean)
        .join(' ');
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

function normalisePhotos(p) {
  if (!p) return [];
  if (Array.isArray(p)) return p;
  try { return JSON.parse(p); } catch { return []; }
}

export default r;
