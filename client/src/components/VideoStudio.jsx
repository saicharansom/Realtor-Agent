import React, { useState } from 'react';
import { api } from '../api.js';

export default function VideoStudio({ listings, onRefresh, notify }) {
  const [url, setUrl] = useState('');
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleParse() {
    if (!url) return;
    setBusy(true);
    try {
      const listing = await api.parseListing(url);
      setActive(listing);
      onRefresh();
      notify?.('Listing parsed.');
    } catch (e) {
      notify?.(`Parse failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (!active) return;
    setBusy(true);
    try {
      const updated = await api.generateVideo(active.id);
      setActive(updated);
      onRefresh();
      notify?.('Video generated.');
    } catch (e) {
      notify?.(`Video gen failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-black/5">
        <h2 className="font-semibold mb-3">Video Studio</h2>
        <label className="text-xs uppercase tracking-wide text-ink/60">Zillow URL</label>
        <div className="flex gap-2 mt-1">
          <input
            className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm"
            placeholder="https://www.zillow.com/homedetails/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <button
            onClick={handleParse}
            disabled={busy || !url}
            className="rounded-lg bg-ink text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Parse'}
          </button>
        </div>
      </div>

      {active && (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-black/5 space-y-4">
          <div>
            <div className="text-sm text-ink/60">{active.address || active.zillow_url}</div>
            <div className="flex gap-4 text-sm mt-1">
              {active.price ? <span>💲{Number(active.price).toLocaleString()}</span> : null}
              {active.beds ? <span>{active.beds} bd</span> : null}
              {active.baths ? <span>{active.baths} ba</span> : null}
              {active.sqft ? <span>{Number(active.sqft).toLocaleString()} sqft</span> : null}
            </div>
          </div>

          <PhotoStrip photos={active.photos} />

          {active.script && <ScriptPreview script={active.script} />}

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Generating…' : active.video_url ? 'Regenerate video' : 'Generate video'}
            </button>
            {active.video_url && (
              <a
                href={active.video_url}
                download
                className="text-sm underline"
              >
                Download MP4
              </a>
            )}
          </div>

          {active.video_url && (
            <video
              controls
              src={active.video_url}
              className="w-full max-w-[300px] rounded-lg border border-black/10 mx-auto"
            />
          )}
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-sm border border-black/5">
        <h3 className="font-semibold mb-3 text-sm">Recent listings</h3>
        <div className="space-y-2">
          {listings.length === 0 && (
            <div className="text-sm text-ink/50">Parse a Zillow URL to get started.</div>
          )}
          {listings.map(l => (
            <button
              key={l.id}
              onClick={() => setActive(l)}
              className="flex w-full items-center gap-3 rounded-lg border border-black/5 p-2 text-left hover:bg-black/5"
            >
              <img
                src={firstPhoto(l.photos)}
                alt=""
                className="size-12 rounded object-cover bg-black/5"
              />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm">{l.address || 'Unparsed listing'}</div>
                <div className="text-xs text-ink/50">
                  {l.price ? `$${Number(l.price).toLocaleString()}` : '—'}
                  {l.video_url ? ' · 🎬' : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhotoStrip({ photos }) {
  const list = parseMaybeJson(photos);
  if (!list.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {list.slice(0, 10).map((p, i) => (
        <img key={i} src={p} alt="" className="h-20 w-20 rounded object-cover" />
      ))}
    </div>
  );
}

function ScriptPreview({ script }) {
  const s = parseMaybeJson(script);
  if (!s || typeof s === 'string') {
    return (
      <div className="rounded-lg bg-black/5 p-3 text-sm whitespace-pre-wrap">
        {typeof script === 'string' ? script : ''}
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-black/5 p-3 text-sm space-y-2">
      <div><strong>Hook:</strong> {s.hook}</div>
      {s.beats?.length > 0 && (
        <ul className="list-disc pl-4">
          {s.beats.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      <div><strong>CTA:</strong> {s.cta}</div>
    </div>
  );
}

function firstPhoto(p) {
  const list = parseMaybeJson(p);
  return list?.[0] || '';
}
function parseMaybeJson(x) {
  if (!x) return [];
  if (Array.isArray(x) || typeof x === 'object') return x;
  try { return JSON.parse(x); } catch { return []; }
}
