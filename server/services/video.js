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

  // 5. Build drawtext filter for captions
  const ftFilter = captions
    .map((line, i) => {
      const start = (perPhoto * i).toFixed(2);
      const end = (perPhoto * (i + 1)).toFixed(2);
      const safe = (line || '').replace(/:/g, '\\:').replace(/'/g, "\\'");
      return (
        `drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:` +
        `text='${safe}':fontcolor=white:fontsize=56:box=1:boxcolor=black@0.55:` +
        `boxborderw=20:x=(w-text_w)/2:y=h-220:` +
        `enable='between(t,${start},${end})'`
      );
    })
    .join(',');

  const videoFilter =
    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,` +
    `zoompan=z='min(zoom+0.0015,1.1)':d=${Math.round(perPhoto * 30)}:s=1080x1920` +
    (ftFilter ? `,${ftFilter}` : '');

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
