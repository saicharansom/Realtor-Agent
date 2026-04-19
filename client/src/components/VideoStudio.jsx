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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-7">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
    <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/>
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
  const [images, setImages]   = useState([]);
  const [prompt, setPrompt]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [phase, setPhase]     = useState('');
  const [result, setResult]   = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

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
    setPhase('generating');
    try {
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
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h2 className="font-display font-semibold text-ink" style={{ fontSize: 20 }}>Video Studio</h2>
          <p className="text-xs font-sans mt-0.5" style={{ color: '#A09688' }}>AI property reels from photos</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-sans font-semibold px-2.5 py-1.5 rounded-full"
          style={{ background: '#FEF0F1', color: '#C8102E', border: '1px solid #FECDD3' }}>
          <SparkIcon />
          AI Powered
        </div>
      </div>

      {/* ── Drop zone ── */}
      <div
        onClick={() => canAdd && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="rounded-2xl transition-all animate-fade-up delay-100"
        style={{
          border: `2px dashed ${dragOver ? '#C8102E' : '#D0CBC0'}`,
          background: dragOver ? '#FEF0F1' : '#FAFAF8',
          cursor: canAdd ? 'pointer' : 'not-allowed',
          padding: images.length ? '16px' : '40px 20px',
        }}>

        {images.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-14 rounded-2xl grid place-items-center"
              style={{ background: '#F0EDEA', border: '1px solid #E8E4DC', color: '#A09688' }}>
              <UploadIcon />
            </div>
            <div>
              <p className="font-sans font-medium text-ink text-sm">
                Drop photos or <span style={{ color: '#C8102E' }}>browse files</span>
              </p>
              <p className="text-xs font-sans mt-1" style={{ color: '#A09688' }}>
                Up to {MAX_IMAGES} images · JPG, PNG, WEBP
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans" style={{ color: '#A09688' }}>{images.length}/{MAX_IMAGES} images</span>
              {canAdd && (
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="text-xs font-sans font-semibold transition-colors"
                  style={{ color: '#C8102E' }}>
                  + Add more
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <div key={img.name} className="relative group aspect-square">
                  <img src={img.dataUrl} alt={img.name}
                    className="h-full w-full rounded-xl object-cover"
                    style={{ border: '2px solid #FFFFFF', boxShadow: '0 1px 4px rgba(26,23,20,0.1)' }} />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded"
                      style={{ background: '#C8102E', color: '#FFFFFF' }}>
                      COVER
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); removeImage(i); }}
                    className="absolute top-1 right-1 size-5 rounded-full grid place-items-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(26,23,20,0.75)' }}>×</button>
                </div>
              ))}
              {canAdd && (
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="aspect-square rounded-xl grid place-items-center text-xl transition-all"
                  style={{ border: '2px dashed #D0CBC0', color: '#C8C3BB' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = '#C8102E'; e.currentTarget.style.color = '#C8102E'; }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor = '#D0CBC0'; e.currentTarget.style.color = '#C8C3BB'; }}>
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
        <label className="block text-[10px] uppercase tracking-widest font-sans font-semibold mb-1.5"
          style={{ color: '#A09688' }}>
          Prompt <span className="normal-case font-normal" style={{ color: '#C8C3BB' }}>(optional)</span>
        </label>
        <input
          className="w-full rounded-xl px-4 py-2.5 text-sm font-sans text-ink placeholder-muted focus:outline-none transition-all"
          style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', boxShadow: '0 1px 2px rgba(26,23,20,0.04)' }}
          placeholder="e.g. Luxury beachfront villa with ocean views…"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onFocus={e  => e.target.style.borderColor = '#C8102E'}
          onBlur={e   => e.target.style.borderColor = '#E8E4DC'}
        />
      </div>

      {/* ── Generate button ── */}
      <button
        onClick={handleGenerate}
        disabled={busy || images.length === 0}
        className="w-full rounded-xl py-3 text-sm font-sans font-semibold transition-all disabled:opacity-40 animate-fade-up delay-200"
        style={!busy && images.length > 0
          ? { background: '#C8102E', color: '#FFFFFF', boxShadow: '0 2px 12px rgba(200,16,46,0.3)' }
          : { background: '#F0EDEA', color: '#A09688' }
        }
        onMouseOver={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#A50D25'; }}
        onMouseOut={e  => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#C8102E'; }}>
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
          style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', boxShadow: '0 1px 3px rgba(26,23,20,0.05)' }}>

          {result.script && <ScriptPreview script={result.script} />}

          {result.video_url && (
            <video key={result.video_url} controls autoPlay playsInline
              src={result.video_url}
              className="w-full max-w-[240px] rounded-xl mx-auto block"
              style={{ border: '1px solid #E8E4DC' }} />
          )}

          <div className="flex items-center gap-3">
            {result.video_url && (
              <a href={result.video_url} download
                className="flex-1 text-center rounded-xl py-2 text-sm font-sans font-semibold transition-all"
                style={{ background: '#F6F5F2', border: '1px solid #E8E4DC', color: '#1A1714' }}
                onMouseOver={e => e.currentTarget.style.background = '#EEE9E2'}
                onMouseOut={e  => e.currentTarget.style.background = '#F6F5F2'}>
                Download MP4
              </a>
            )}
            <button onClick={handleGenerate} disabled={busy}
              className="flex-1 rounded-xl py-2 text-sm font-sans font-semibold transition-all disabled:opacity-40"
              style={{ background: '#FEF0F1', border: '1px solid #FECDD3', color: '#C8102E' }}
              onMouseOver={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#FEE2E2'; }}
              onMouseOut={e  => { e.currentTarget.style.background = '#FEF0F1'; }}>
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
    <div className="rounded-xl p-3.5 space-y-2.5"
      style={{ background: '#F6F5F2', border: '1px solid #E8E4DC' }}>
      <div className="text-[10px] uppercase tracking-widest font-sans font-semibold" style={{ color: '#A09688' }}>
        Script
      </div>
      {script.hook && (
        <p className="text-sm font-display font-medium text-ink leading-relaxed">
          "{script.hook}"
        </p>
      )}
      {script.beats?.map((b, i) => (
        <p key={i} className="text-xs font-sans leading-relaxed" style={{ color: '#6B6459' }}>
          · {b}
        </p>
      ))}
      {script.cta && (
        <p className="text-xs font-sans font-semibold" style={{ color: '#C8102E' }}>{script.cta}</p>
      )}
    </div>
  );
}
