/**
 * Video generation via JSON2Video API.
 *
 * Creates a vertical 1080x1920 real-estate slideshow with Ken Burns
 * zoom/pan effects from public image URLs.
 *
 * Docs: https://json2video.com/docs/v2/
 *
 * POST https://api.json2video.com/v2/movies   → { project }
 * GET  https://api.json2video.com/v2/movies?project=<id>
 *      → { movie: { status: "done"|"running"|"pending"|"error", url } }
 *
 * Env: JSON2VIDEO_API_KEY
 */

const BASE_URL          = 'https://api.json2video.com/v2/movies';
const POLL_INTERVAL_MS  = 6_000;
const MAX_POLLS         = 60;       // ~6 min max wait

function apiKey() {
  const k = process.env.JSON2VIDEO_API_KEY;
  if (!k) throw new Error('JSON2VIDEO_API_KEY not set');
  return k;
}

function headers() {
  return { 'x-api-key': apiKey(), 'Content-Type': 'application/json' };
}

// Cycle through 4 Ken Burns motion styles
const KB = [
  { zoom: 3,  pan: 'bottom-right' },
  { zoom: -2, pan: 'top-left'     },
  { zoom: 3,  pan: 'top'          },
  { zoom: 2,  pan: 'right'        },
];

/**
 * Build the JSON2Video movie payload.
 *
 * @param {string[]} imageUrls    — public HTTPS image URLs
 * @param {string[]} textOverlays — one caption per image (optional)
 * @returns {object}              — movie JSON body
 */
function buildMovie(imageUrls, textOverlays = []) {
  const perScene = 3.2;

  const scenes = imageUrls.map((src, i) => {
    const kb = KB[i % KB.length];
    const isFirst = i === 0;
    const isLast  = i === imageUrls.length - 1;

    const scene = {
      duration: perScene,
      elements: [
        {
          type:           'image',
          src,
          resize:         'cover',
          zoom:           kb.zoom,
          pan:            kb.pan,
          'pan-distance': 0.08,
          'fade-in':      isFirst ? 0   : 0.4,
          'fade-out':     isLast  ? 0   : 0.3,
        },
      ],
    };

    const caption = textOverlays[i];
    if (caption) {
      scene.elements.push({
        type:               'text',
        text:               caption,
        'font-size':        38,
        'font-color':       '#FFFFFF',
        'background-color': 'rgba(0,0,0,0.55)',
        'font-family':      'Lato',
        'font-weight':      'bold',
        'text-align':       'center',
        position:           'custom',
        x:                  90,
        y:                  1720,
        width:              900,
        height:             120,
      });
    }

    return scene;
  });

  return {
    resolution: 'instagram-story',   // 1080 × 1920
    quality:    'high',
    cache:      false,
    scenes,
  };
}

/**
 * Generate a slideshow video from public image URLs.
 *
 * @param {string[]} imageUrls    — public HTTPS URLs
 * @param {string[]} textOverlays — optional captions per image
 * @returns {Promise<string>}     — public video URL
 */
export async function generateSlideshow(imageUrls, textOverlays = []) {
  if (!imageUrls?.length) throw new Error('At least one image URL required');

  const body = buildMovie(imageUrls.slice(0, 20), textOverlays);

  // 1. Submit render job
  const submitRes = await fetch(BASE_URL, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text().catch(() => '');
    throw new Error(`JSON2Video submit ${submitRes.status}: ${err.slice(0, 400)}`);
  }

  const { project } = await submitRes.json();
  if (!project) throw new Error('JSON2Video: no project ID returned');
  console.log(`[json2video] job submitted: ${project}`);

  // 2. Poll until done / error / timeout
  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(`${BASE_URL}?project=${project}`, {
      headers: { 'x-api-key': apiKey() },
    });

    if (!pollRes.ok) {
      console.warn(`[json2video] poll ${poll + 1} → ${pollRes.status}, retrying…`);
      continue;
    }

    const data  = await pollRes.json();
    const movie = data?.movie;
    console.log(`[json2video] poll ${poll + 1}: status=${movie?.status}`);

    if (movie?.status === 'done') {
      if (!movie.url) throw new Error('JSON2Video done but returned no URL');
      console.log('[json2video] video ready:', movie.url);
      return movie.url;
    }

    if (movie?.status === 'error') {
      throw new Error(`JSON2Video render error: ${JSON.stringify(movie)}`);
    }
    // pending / running → keep polling
  }

  throw new Error(`JSON2Video timed out after ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
