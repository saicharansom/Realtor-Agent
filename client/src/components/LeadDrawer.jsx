import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUSES = [
  { key: 'new',               label: 'New',         dot: '#4e5568' },
  { key: 'qualifying',        label: 'Qualifying',  dot: '#f5a524' },
  { key: 'interested',        label: 'Interested',  dot: '#4f8ef7' },
  { key: 'showing_scheduled', label: 'Showing',     dot: '#a050f0' },
  { key: 'offer_stage',       label: 'Offer',       dot: '#f07040' },
  { key: 'closed',            label: 'Closed',      dot: '#22c87a' },
  { key: 'disqualified',      label: 'Disqualified',dot: '#e84545' },
  { key: 'cold',              label: 'Cold',        dot: '#3a3f50' },
];

function safeObj(x) {
  if (!x) return {};
  if (typeof x === 'object') return x;
  try { return JSON.parse(x); } catch { return {}; }
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function groupByDay(thread) {
  const groups = [];
  let lastDate = null;
  for (const m of thread) {
    const date = fmtDate(m.sent_at);
    if (date !== lastDate) { groups.push({ type: 'date', label: date }); lastDate = date; }
    groups.push({ type: 'msg', ...m });
  }
  return groups;
}

export default function LeadDrawer({ lead, onClose, onRefresh }) {
  const [thread, setThread] = useState([]);
  const [reply, setReply]   = useState('');
  const [busy, setBusy]     = useState(false);

  async function loadThread() {
    try { setThread(await api.thread(lead.id)); } catch {}
  }

  useEffect(() => {
    loadThread();
    const t = setInterval(loadThread, 5000);
    return () => clearInterval(t);
  }, [lead.id]);

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.sendMessage(lead.id, reply);
      setReply('');
      await loadThread();
      onRefresh();
    } finally { setBusy(false); }
  }

  async function changeStatus(status) {
    await api.setStatus(lead.id, status);
    onRefresh();
  }

  const qdata = safeObj(lead.qualifying_data);
  const qdataEntries = Object.entries(qdata).filter(([, v]) => v);
  const grouped = groupByDay(thread);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>

      {/* Drawer panel */}
      <div
        className="ml-auto w-full h-full flex flex-col animate-slide-in md:max-w-[520px]"
        style={{ background: '#0f1117', boxShadow: '-8px 0 48px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <header className="shrink-0 px-5 py-4 flex items-center gap-3 pt-safe"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1 min-w-0">
            <div className="font-sans font-semibold text-ivory text-base truncate">
              {lead.name || lead.phone}
            </div>
            <div className="text-xs text-muted font-sans mt-0.5 flex items-center gap-2">
              <span>{lead.phone}</span>
              {lead.contact_type && (
                <>
                  <span className="size-1 rounded-full bg-muted/40" />
                  <span className="capitalize">{lead.contact_type}</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="size-8 rounded-xl grid place-items-center text-muted hover:text-ivory transition-colors shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </header>

        {/* ── Status pills ── */}
        <div className="shrink-0 px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] uppercase tracking-widest font-sans text-muted mb-2">Stage</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button key={s.key} onClick={() => changeStatus(s.key)}
                className="flex items-center gap-1.5 text-[11px] font-sans font-medium px-2.5 py-1 rounded-full transition-all"
                style={lead.status === s.key
                  ? { background: `${s.dot}22`, border: `1px solid ${s.dot}55`, color: s.dot }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#4e5568' }
                }>
                <span className="size-1.5 rounded-full" style={{ background: lead.status === s.key ? s.dot : '#3a3f50' }} />
                {s.label}
              </button>
            ))}
          </div>

          {/* Qualifying data */}
          {qdataEntries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {qdataEntries.map(([k, v]) => (
                <div key={k} className="text-[11px] font-sans">
                  <span className="text-muted capitalize">{k.replace(/_/g, ' ')}: </span>
                  <span className="text-ivory/80">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Thread ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
          style={{ background: 'rgba(8,9,14,0.5)' }}>
          {grouped.map((item, i) => {
            if (item.type === 'date') return (
              <div key={`d-${i}`} className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-[10px] font-sans text-muted shrink-0">{item.label}</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            );
            const isIn = item.direction === 'inbound';
            return (
              <div key={item.id || i} className={`flex ${isIn ? 'justify-start' : 'justify-end'}`}>
                <div className="max-w-[80%] group">
                  <div className="px-3.5 py-2.5 rounded-2xl text-sm font-sans leading-relaxed"
                    style={isIn
                      ? { background: 'rgba(24,29,42,0.9)', border: '1px solid rgba(255,255,255,0.07)', color: '#d8d4cc', borderBottomLeftRadius: 6 }
                      : { background: 'linear-gradient(135deg,rgba(201,151,58,0.25),rgba(224,185,106,0.15))', border: '1px solid rgba(201,151,58,0.2)', color: '#f0ece3', borderBottomRightRadius: 6 }
                    }>
                    {item.body}
                  </div>
                  <div className={`text-[10px] font-sans text-muted mt-1 ${isIn ? 'text-left' : 'text-right'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {item.sender} · {fmtTime(item.sent_at)}
                  </div>
                </div>
              </div>
            );
          })}
          {thread.length === 0 && (
            <div className="text-center py-16 text-muted font-sans text-sm">No messages yet</div>
          )}
        </div>

        {/* ── Reply input ── */}
        <div className="shrink-0 px-4 py-3 pb-safe flex gap-2 items-end"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,15,23,0.9)' }}>
          <input
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Manual reply…"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-sans text-ivory placeholder-muted focus:outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              focusBorderColor: 'rgba(201,151,58,0.4)' }}
          />
          <button onClick={send} disabled={busy || !reply.trim()}
            className="shrink-0 size-10 rounded-xl grid place-items-center transition-all disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg,#c9973a,#e0b96a)' }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-bg">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.668 5.828H12.5a.75.75 0 0 1 0 1.5H3.947l-1.668 5.828a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.222A28.897 28.897 0 0 0 3.105 2.288Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
