import React, { useRef, useState } from 'react';
import { api } from '../api.js';

const MAX_IMAGES = 20;
const MAX_SIDE   = 1920;
const JPEG_Q     = 0.82;

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

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
    <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/>
    <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" opacity=".6"/>
    <path d="M5 18l.5 1.5L7 20l-1.5.5L5 22l-.5-1.5L3 20l1.5-.5L5 18z" opacity=".4"/>
  </svg>
);

function Spinner() {
  return (
    <svg className="animate-spin size-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}

export default function VideoStudio({ notify }) {
  const [images, setImages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy]     = useState(false);
  const [phase, setPhase]   = useState('');
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();
  const dropRef  = useRef();

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

  function onDragOver(e)  { e.preventDefault(); setDragOver(true); }
  function onDragLeave()  { setDragOver(false); }
  function onDrop(e)      { e.preventDefault(); setDragOver(false); readFiles(e.dataTransfer.files); }

  async function handleGenerate() {
    if (!images.length) return;
    setBusy(true);
    setResult(null);
    setPhase('upload');
    try {
      setPhase('generating');
      const res = await api.generateFromImages(images.map(i => i.dataUrl), prompt || undefined);
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

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="font-display font-semibold text-xl text-ivory tracking-wide">Video Studio</h2>
          <p className="text-xs text-muted font-sans mt-0.5">AI-powered property reels</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-sans font-medium px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(201,151,58,0.12)', border: '1px solid rgba(201,151,58,0.2)', color: '#e0b96a' }}>
          <SparkleIcon />
          Seedance AI
        </div>
      </div>

      {/* ── Drop zone ── */}
      <div
        ref={dropRef}
        onClick={() => canAdd && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="relative rounded-2xl transition-all animate-fade-up delay-75"
        style={{
          border: `2px dashed ${dragOver ? 'rgba(201,151,58,0.6)' : 'rgba(255,255,255,0.08)'}`,
          background: dragOver ? 'rgba(201,151,58,0.06)' : 'rgba(19,22,31,0.6)',
          cursor: canAdd ? 'pointer' : 'not-allowed',
          padding: images.length ? '16px' : '40px 24px',
          opacity: canAdd ? 1 : 0.5,
        }}>

        {images.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-14 rounded-2xl grid place-items-center"
              style={{ background: 'rgba(201,151,58,0.1)', border: '1px solid rgba(201,151,58,0.15)', color: '#c9973a' }}>
              <UploadIcon />
            </div>
            <div>
              <p className="font-sans font-medium text-ivory/80 text-sm">
                Drop photos here or <span style={{ color: '#c9973a' }}>browse</span>
              </p>
              <p className="text-xs text-muted font-sans mt-1">Up to {MAX_IMAGES} images · JPG, PNG, WEBP</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans text-muted">{images.length}/{MAX_IMAGES} images</span>
              {canAdd && (
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="text-xs font-sans font-medium transition-colors"
                  style={{ color: '#c9973a' }}>+ Add more</button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <div key={img.name} className="relative group aspect-square">
                  <img src={img.dataUrl} alt={img.name}
                    className="h-full w-full rounded-xl object-cover"
                    style={{ border: '1px solid rgba(255,255,255,0.07)' }} />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(201,151,58,0.9)', color: '#08090e' }}>COVER</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); removeImage(i); }}
                    className="absolute top-1 right-1 size-5 rounded-full grid place-items-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.7)' }}>×</button>
                </div>
              ))}
              {canAdd && (
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="aspect-square rounded-xl grid place-items-center text-xl transition-all"
                  style={{ border: '2px dashed rgba(255,255,255,0.08)', color: '#2a3045', background: 'transparent' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(201,151,58,0.4)'; e.currentTarget.style.color = '#c9973a'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#2a3045'; }}>
                  +
                </button>
              )}
            </div>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onInputChange} />
      </div>

      {/* ── Prompt ── */}
      <div className="animate-fade-up delay-150">
        <label className="text-[10px] uppercase tracking-widest font-sans text-muted block mb-1.5">
          Prompt <span className="normal-case opacity-60">(optional)</span>
        </label>
        <input
          className="w-full rounded-xl px-4 py-2.5 text-sm font-sans text-ivory placeholder-muted focus:outline-none transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          placeholder="e.g. Luxury beachfront villa with ocean views…"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
      </div>

      {/* ── Generate button ── */}
      <button
        onClick={handleGenerate}
        disabled={busy || images.length === 0}
        className="w-full rounded-xl py-3 text-sm font-sans font-semibold transition-all disabled:opacity-40 animate-fade-up delay-225"
        style={!busy && images.length > 0
          ? { background: 'linear-gradient(135deg,#c9973a,#e0b96a)', color: '#08090e', boxShadow: '0 4px 20px rgba(201,151,58,0.3)' }
          : { background: 'rgba(255,255,255,0.06)', color: '#4e5568' }
        }>
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            {phase === 'upload' ? `Uploading ${images.length} images…` : 'Generating with AI…'}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <VideoIcon />
            Generate reel from {images.length || 0} image{images.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {/* ── Result ── */}
      {result && (
        <div className="rounded-2xl p-4 space-y-4 animate-fade-up"
          style={{ background: 'rgba(19,22,31,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>

          {result.script && <ScriptPreview script={result.script} />}

          {result.video_url && (
            <video key={result.video_url} controls autoPlay playsInline
              src={result.video_url}
              className="w-full max-w-[240px] rounded-xl mx-auto block"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
          )}

          <div className="flex items-center gap-3">
            {result.video_url && (
              <a href={result.video_url} download
                className="flex-1 text-center rounded-xl py-2 text-sm font-sans font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: '#f0ece3' }}>
                Download MP4
              </a>
            )}
            <button onClick={handleGenerate} disabled={busy}
              className="flex-1 rounded-xl py-2 text-sm font-sans font-medium transition-all disabled:opacity-40"
              style={{ background: 'rgba(201,151,58,0.12)', border: '1px solid rgba(201,151,58,0.2)', color: '#e0b96a' }}>
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScriptPreview({ script }) {
  return (
    <div className="space-y-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] uppercase tracking-widest font-sans text-muted">Script</div>
      {script.hook && (
        <p className="text-sm font-sans font-medium text-ivory leading-relaxed">"{script.hook}"</p>
      )}
      {script.beats?.map((b, i) => (
        <p key={i} className="text-xs font-sans text-muted leading-relaxed">• {b}</p>
      ))}
      {script.cta && (
        <p className="text-xs font-sans text-gold font-medium">{script.cta}</p>
      )}
    </div>
  );
}
