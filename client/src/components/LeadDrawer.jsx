import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUSES = [
  { key: 'new',               label: 'New',          bg: '#F3F4F6', color: '#6B7280',  border: '#E5E7EB' },
  { key: 'qualifying',        label: 'Qualifying',   bg: '#FFFBEB', color: '#B45309',  border: '#FDE68A' },
  { key: 'interested',        label: 'Interested',   bg: '#EFF6FF', color: '#1D4ED8',  border: '#BFDBFE' },
  { key: 'showing_scheduled', label: 'Showing',      bg: '#F5F3FF', color: '#6D28D9',  border: '#DDD6FE' },
  { key: 'offer_stage',       label: 'Offer Stage',  bg: '#FFF7ED', color: '#C2410C',  border: '#FED7AA' },
  { key: 'closed',            label: 'Closed',       bg: '#F0FDF4', color: '#15803D',  border: '#BBF7D0' },
  { key: 'disqualified',      label: 'Disqualified', bg: '#FEF2F2', color: '#B91C1C',  border: '#FECACA' },
  { key: 'cold',              label: 'Cold',         bg: '#F9FAFB', color: '#9CA3AF',  border: '#E5E7EB' },
];

const AVATAR_PALETTE = [
  { bg: '#FEF0F1', text: '#C8102E' },
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#F0FDF4', text: '#15803D' },
  { bg: '#FFFBEB', text: '#B45309' },
  { bg: '#F5F3FF', text: '#6D28D9' },
  { bg: '#FFF7ED', text: '#C2410C' },
];

function avatarColor(id) {
  const idx = (id?.charCodeAt?.(0) || 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

function initials(name, phone) {
  if (name)  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (phone) return phone.replace('web-', '').slice(-2).toUpperCase();
  return '??';
}

function safeObj(x) {
  if (!x) return {};
  if (typeof x === 'object') return x;
  try { return JSON.parse(x); } catch { return {}; }
}

function fmtTime(d) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(d) { return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }); }

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

const SendIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.668 5.828H12.5a.75.75 0 0 1 0 1.5H3.947l-1.668 5.828a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.222A28.897 28.897 0 0 0 3.105 2.288Z"/>
  </svg>
);

export default function LeadDrawer({ lead, onClose, onRefresh }) {
  const [thread, setThread] = useState([]);
  const [reply, setReply]   = useState('');
  const [busy, setBusy]     = useState(false);
  const { bg: avBg, text: avText } = avatarColor(lead.id);

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

  const qdata   = safeObj(lead.qualifying_data);
  const qentries = Object.entries(qdata).filter(([, v]) => v);
  const grouped = groupByDay(thread);
  const currentStatus = STATUSES.find(s => s.key === lead.status);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}
      style={{ background: 'rgba(26,23,20,0.35)', backdropFilter: 'blur(3px)' }}>

      {/* Drawer panel */}
      <div className="ml-auto w-full h-full flex flex-col animate-slide-in md:max-w-[500px] bg-surface"
        style={{ boxShadow: '-2px 0 0 #E8E4DC, -8px 0 48px rgba(26,23,20,0.12)' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <header className="shrink-0 pt-safe bg-surface" style={{ borderBottom: '1px solid #E8E4DC' }}>
          <div className="flex items-center gap-3 px-5 py-4">
            {/* Avatar */}
            <div className="size-11 rounded-xl grid place-items-center shrink-0 font-sans font-bold text-sm"
              style={{ background: avBg, color: avText }}>
              {initials(lead.name, lead.phone)}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="font-sans font-semibold text-ink text-base truncate">
                {lead.name || lead.phone}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-sans" style={{ color: '#A09688' }}>{lead.phone}</span>
                {lead.contact_type && (
                  <>
                    <span className="size-1 rounded-full" style={{ background: '#D0CBC0' }} />
                    <span className="text-xs font-sans capitalize" style={{ color: '#A09688' }}>{lead.contact_type}</span>
                  </>
                )}
              </div>
            </div>

            {/* Close */}
            <button onClick={onClose}
              className="flex items-center justify-center rounded-xl transition-colors shrink-0"
              style={{ width: 36, height: 36, background: '#F6F5F2', color: '#6B6459' }}
              onMouseOver={e => e.currentTarget.style.background = '#EEE9E2'}
              onMouseOut={e  => e.currentTarget.style.background = '#F6F5F2'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Status pills */}
          <div className="px-5 pb-3">
            <div className="text-[10px] uppercase tracking-widest font-sans font-semibold mb-2.5" style={{ color: '#A09688' }}>
              Stage
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button key={s.key} onClick={() => changeStatus(s.key)}
                  className="flex items-center gap-1.5 text-[11px] font-sans font-semibold px-2.5 py-1 rounded-full border transition-all"
                  style={lead.status === s.key
                    ? { background: s.bg, border: `1px solid ${s.border}`, color: s.color }
                    : { background: '#F6F5F2', border: '1px solid #E8E4DC', color: '#A09688' }
                  }>
                  <span className="size-1.5 rounded-full" style={{ background: lead.status === s.key ? s.color : '#D0CBC0' }} />
                  {s.label}
                </button>
              ))}
            </div>

            {/* Qualifying data */}
            {qentries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                {qentries.map(([k, v]) => (
                  <div key={k} className="text-xs font-sans">
                    <span className="capitalize" style={{ color: '#A09688' }}>{k.replace(/_/g, ' ')}: </span>
                    <span className="font-medium" style={{ color: '#1A1714' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* ── Thread ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ background: '#F6F5F2' }}>
          {grouped.map((item, i) => {
            if (item.type === 'date') return (
              <div key={`d-${i}`} className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px" style={{ background: '#E8E4DC' }} />
                <span className="text-[10px] font-sans shrink-0" style={{ color: '#A09688' }}>{item.label}</span>
                <div className="flex-1 h-px" style={{ background: '#E8E4DC' }} />
              </div>
            );
            const isIn = item.direction === 'inbound';
            return (
              <div key={item.id || i} className={`flex ${isIn ? 'justify-start' : 'justify-end'}`}>
                <div className="max-w-[78%] group">
                  <div className="px-3.5 py-2.5 rounded-2xl text-sm font-sans leading-relaxed"
                    style={isIn
                      ? { background: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1714', borderBottomLeftRadius: 6, boxShadow: '0 1px 2px rgba(26,23,20,0.04)' }
                      : { background: '#C8102E', color: '#FFFFFF', borderBottomRightRadius: 6, boxShadow: '0 1px 4px rgba(200,16,46,0.25)' }
                    }>
                    {item.body}
                  </div>
                  <div className={`text-[10px] font-sans mt-1 ${isIn ? 'text-left' : 'text-right'} opacity-0 group-hover:opacity-100 transition-opacity`}
                    style={{ color: '#A09688' }}>
                    {item.sender} · {fmtTime(item.sent_at)}
                  </div>
                </div>
              </div>
            );
          })}
          {thread.length === 0 && (
            <div className="text-center py-16 font-sans text-sm" style={{ color: '#A09688' }}>
              No messages yet
            </div>
          )}
        </div>

        {/* ── Reply input ── */}
        <div className="shrink-0 px-4 py-3 pb-safe bg-surface flex gap-2 items-center"
          style={{ borderTop: '1px solid #E8E4DC' }}>
          <input
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Type a reply…"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-sans text-ink placeholder-muted focus:outline-none transition-all"
            style={{ background: '#F6F5F2', border: '1px solid #E8E4DC' }}
            onFocus={e  => e.target.style.borderColor = '#C8102E'}
            onBlur={e   => e.target.style.borderColor = '#E8E4DC'}
          />
          <button onClick={send} disabled={busy || !reply.trim()}
            className="flex items-center justify-center rounded-xl transition-all disabled:opacity-30 shrink-0"
            style={{ width: 40, height: 40, background: '#C8102E', color: '#FFFFFF' }}
            onMouseOver={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#A50D25'; }}
            onMouseOut={e  => { e.currentTarget.style.background = '#C8102E'; }}>
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
