/**
 * Video assembler — slideshow + captions + voiceover → vertical MP4 (1080x1920).
 *
 * Uses ffmpeg CLI. Nothing fancy: fade between photos, burn in caption beats,
 * mix in voiceover. Output is written to server/out/<listing-id>.mp4.
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const OUT_DIR = path.resolve('out');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => (err += d.toString()));
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(err.slice(-1000)))));
  });
}

async function download(url, dest) {
  // accept local file paths (absolute or file://) without HTTP round-trip
  if (url.startsWith('/') || url.startsWith('file://')) {
    const src = url.startsWith('file://') ? url.slice(7) : url;
    await fs.copyFile(src, dest);
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

/**
 * @param {object} opts
 * @param {string[]} opts.photoUrls  selected photos, best first
 * @param {Buffer}  opts.voiceover   mp3 buffer
 * @param {string[]} opts.captions   overlay lines per photo (same length as photoUrls)
 * @param {string}  opts.listingId   used in output filename
 */
export async function assembleVideo({ photoUrls, voiceover, captions, listingId }) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rv-'));

  // 1. Download photos
  const photoPaths = [];
  for (let i = 0; i < photoUrls.length; i++) {
    const p = path.join(tmp, `p${i}.jpg`);
    await download(photoUrls[i], p);
    photoPaths.push(p);
  }

  // 2. Write voiceover (if we have one)
  let voicePath = null;
  let durSec = 3 * photoPaths.length; // default 3s per photo if silent
  if (voiceover) {
    voicePath = path.join(tmp, 'vo.mp3');
    await fs.writeFile(voicePath, voiceover);
    durSec = await probeDuration(voicePath);
  }
  const perPhoto = Math.max(2, durSec / photoPaths.length);

  // 4. Build input list for concat demuxer
  const listFile = path.join(tmp, 'list.txt');
  const listBody = photoPaths
    .map(p => `file '${p}'\nduration ${perPhoto.toFixed(2)}`)
    .join('\n') + `\nfile '${photoPaths[photoPaths.length - 1]}'\n`;
  await fs.writeFile(listFile, listBody);

  // 5. Build video filter — scale + zoom/pan (no drawtext: requires libfreetype)
  const videoFilter =
    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,` +
    `zoompan=z='min(zoom+0.0015,1.1)':d=${Math.round(perPhoto * 30)}:s=1080x1920`;

  const outPath = path.join(OUT_DIR, `${listingId}.mp4`);

  const ffargs = [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', listFile,
  ];
  if (voicePath) ffargs.push('-i', voicePath);
  ffargs.push(
    '-vf', videoFilter,
    '-r', '30',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  );
  if (voicePath) ffargs.push('-c:a', 'aac', '-shortest');
  ffargs.push('-movflags', '+faststart', outPath);

  await run('ffmpeg', ffargs);

  // cleanup tmp
  await fs.rm(tmp, { recursive: true, force: true });
  return outPath;
}

/**
 * Download a Seedance video URL and burn in script text overlays using ffmpeg drawtext.
 * Falls back to the raw URL if drawtext is unavailable (no libfreetype).
 *
 * @param {string} videoUrl   — public HTTPS URL from Seedance
 * @param {object} script     — {hook, beats[], cta}
 * @param {string} listingId  — used for output filename
 * @returns {Promise<string>} — local /media/<id>.mp4 URL or original videoUrl on failure
 */
export async function addTextOverlay(videoUrl, script, listingId, voiceover = null) {
  if (!videoUrl) return videoUrl;

  await fs.mkdir(OUT_DIR, { recursive: true });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rv-overlay-'));

  try {
    // Download the Seedance video
    const srcPath = path.join(tmp, 'seedance.mp4');
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`download ${videoUrl} -> ${res.status}`);
    await fs.writeFile(srcPath, Buffer.from(await res.arrayBuffer()));

    // Write voiceover if provided
    let voPath = null;
    if (voiceover) {
      voPath = path.join(tmp, 'vo.mp3');
      await fs.writeFile(voPath, voiceover);
      console.log('[video] voiceover added to video');
    }

    const outPath = path.join(OUT_DIR, `${listingId}.mp4`);

    // Build timed drawtext segments for hook, beats, cta
    const hook  = (script.hook || '').replace(/[\\':]/g, ' ').slice(0, 80);
    const beat0 = (script.beats?.[0] || '').replace(/[\\':]/g, ' ').slice(0, 80);
    const beat1 = (script.beats?.[1] || '').replace(/[\\':]/g, ' ').slice(0, 80);
    const beat2 = (script.beats?.[2] || '').replace(/[\\':]/g, ' ').slice(0, 80);
    const cta   = (script.cta || '').replace(/[\\':]/g, ' ').slice(0, 80);

    const base = `fontsize=52:fontcolor=white:shadowcolor=black@0.8:shadowx=2:shadowy=2:x=(w-tw)/2:line_spacing=8`;
    const filters = [
      hook  ? `drawtext=${base}:text='${hook}':y=100:enable='between(t,0,3)'` : null,
      beat0 ? `drawtext=${base}:text='${beat0}':y=h-200:enable='between(t,3,7)'` : null,
      beat1 ? `drawtext=${base}:text='${beat1}':y=h-200:enable='between(t,7,10)'` : null,
      beat2 ? `drawtext=${base}:text='${beat2}':y=h-200:enable='between(t,10,13)'` : null,
      cta   ? `drawtext=${base}:fontsize=44:text='${cta}':y=h-140:enable='between(t,13,15)'` : null,
    ].filter(Boolean).join(',');

    const ffargs = ['-y', '-i', srcPath];
    if (voPath) ffargs.push('-i', voPath);
    ffargs.push('-vf', filters, '-c:v', 'libx264', '-pix_fmt', 'yuv420p');
    if (voPath) {
      ffargs.push('-c:a', 'aac', '-shortest');
    } else {
      ffargs.push('-an');
    }
    ffargs.push('-movflags', '+faststart', outPath);

    await run('ffmpeg', ffargs);

    console.log('[video] text overlay + audio applied:', outPath);
    return `/media/${listingId}.mp4`;
  } catch (e) {
    console.warn('[video] overlay failed, using raw Seedance URL:', e.message);
    return videoUrl;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

async function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1', file,
    ]);
    let out = '';
    p.stdout.on('data', d => (out += d));
    p.on('close', c => (c === 0 ? resolve(parseFloat(out) || 20) : reject(new Error('ffprobe'))));
  });
}
