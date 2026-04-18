import React, { useRef, useState } from 'react';
import { api } from '../api.js';

const MAX_IMAGES = 20;
const MAX_SIDE   = 1920; // px — resize before base64 to keep payload small
const JPEG_Q     = 0.82;

/** Resize + compress an image File → base64 JPEG data URL via canvas. */
function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', JPEG_Q), name: file.name });
    };
    img.src = url;
  });
}

export default function VideoStudio({ notify }) {
  const [images, setImages]   = useState([]); // [{ dataUrl, name }]
  const [prompt, setPrompt]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [phase, setPhase]     = useState('');  // upload | generating
  const [result, setResult]   = useState(null);
  const inputRef = useRef();
  const dropRef  = useRef();

  // ── file helpers ──────────────────────────────────────────────────────────

  function readFiles(files) {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    Promise.all(imgs.map(compressImage)).then(loaded =>
      setImages(prev => {
        const existing = new Set(prev.map(i => i.name));
        const fresh = loaded.filter(l => !existing.has(l.name));
        const next = [...prev, ...fresh];
        if (next.length > MAX_IMAGES) {
          notify?.(`Max ${MAX_IMAGES} images — keeping first ${MAX_IMAGES}.`);
          return next.slice(0, MAX_IMAGES);
        }
        return next;
      })
    );
  }

  function onInputChange(e) { readFiles(e.target.files); e.target.value = ''; }
  function removeImage(idx) { setImages(prev => prev.filter((_, i) => i !== idx)); }

  // ── drag & drop ──────────────────────────────────────────────────────────

  function onDragOver(e)  { e.preventDefault(); dropRef.current?.classList.add('border-accent'); }
  function onDragLeave()  { dropRef.current?.classList.remove('border-accent'); }
  function onDrop(e)      { e.preventDefault(); onDragLeave(); readFiles(e.dataTransfer.files); }

  // ── generate ─────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!images.length) return;
    setBusy(true);
    setResult(null);
    setPhase('upload');
    try {
      const dataUrls = images.map(i => i.dataUrl);
      setPhase('generating');
      const res = await api.generateFromImages(dataUrls, prompt || undefined);
      setResult(res);
      notify?.('Video generated.');
    } catch (e) {
      notify?.(`Failed: ${e.message}`);
    } finally {
      setBusy(false);
      setPhase('');
    }
  }

  const canAdd = images.length < MAX_IMAGES;
  const slots  = MAX_IMAGES - images.length;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* main card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-black/5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Video Studio</h2>
          <span className="text-xs text-ink/40">{images.length}/{MAX_IMAGES} images</span>
        </div>

        {/* drop zone */}
        <div
          ref={dropRef}
          onClick={() => canAdd && inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors
            ${canAdd ? 'border-black/15 cursor-pointer hover:border-accent' : 'border-black/5 opacity-40 cursor-not-allowed'}`}
        >
          <svg className="size-7 text-ink/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-ink/50">
            {canAdd
              ? <>Drop images or <span className="text-accent font-medium">browse</span> — up to {slots} more</>
              : `Maximum ${MAX_IMAGES} images reached`}
          </p>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onInputChange} />
        </div>

        {/* image grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {images.map((img, i) => (
              <div key={img.name} className="relative group aspect-square">
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-full w-full rounded-lg object-cover border border-black/5"
                />
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded px-1 text-[9px] bg-accent text-white font-semibold leading-tight">
                    COVER
                  </span>
                )}
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white text-xs grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
            {canAdd && (
              <button
                onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-black/10 text-ink/25 text-2xl hover:border-accent hover:text-accent transition-colors"
              >
                +
              </button>
            )}
          </div>
        )}

        {/* prompt */}
        <div>
          <label className="text-xs uppercase tracking-wide text-ink/50">
            Prompt <span className="normal-case">(optional)</span>
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            placeholder="e.g. Beachfront condo with ocean views…"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        </div>

        {/* generate button */}
        <button
          onClick={handleGenerate}
          disabled={busy || images.length === 0}
          className="w-full rounded-lg bg-accent text-white py-2.5 text-sm font-medium disabled:opacity-50 transition-opacity"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />
              {phase === 'upload' ? `Uploading ${images.length} images…` : 'Generating video with Seedance…'}
            </span>
          ) : (
            `Generate video from ${images.length || 0} image${images.length !== 1 ? 's' : ''}`
          )}
        </button>
      </div>

      {/* result */}
      {result && (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-black/5 space-y-4">
          {result.script && <ScriptPreview script={result.script} />}

          <div className="flex items-center gap-3">
            {result.video_url && (
              <a href={result.video_url} download
                className="rounded-lg bg-ink text-white px-4 py-2 text-sm font-medium">
                Download MP4
              </a>
            )}
            <button onClick={handleGenerate} disabled={busy}
              className="text-sm text-ink/50 underline disabled:opacity-40">
              Regenerate
            </button>
          </div>

          {result.video_url && (
            <video
              key={result.video_url}
              controls autoPlay
              src={result.video_url}
              className="w-full max-w-[280px] rounded-xl border border-black/10 mx-auto block"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ScriptPreview({ script }) {
  return (
    <div className="rounded-lg bg-black/5 p-3 text-sm space-y-1">
      <p><strong>Hook:</strong> {script.hook}</p>
      {script.beats?.map((b, i) => <p key={i} className="text-ink/70">• {b}</p>)}
      <p><strong>CTA:</strong> {script.cta}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin size-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
