import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUSES = [
  'new', 'qualifying', 'interested', 'showing_scheduled',
  'offer_stage', 'closed', 'disqualified', 'cold',
];

export default function LeadDrawer({ lead, onClose, onRefresh }) {
  const [thread, setThread] = useState([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadThread() {
    try {
      const t = await api.thread(lead.id);
      setThread(t);
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    loadThread();
    const t = setInterval(loadThread, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.sendMessage(lead.id, reply);
      setReply('');
      await loadThread();
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status) {
    await api.setStatus(lead.id, status);
    onRefresh();
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-[520px] bg-white h-full shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-black/10 flex items-center justify-between">
          <div>
            <div className="font-semibold">{lead.name || lead.phone}</div>
            <div className="text-xs text-ink/60">{lead.phone} · {lead.contact_type || 'unknown'}</div>
          </div>
          <button onClick={onClose} className="text-ink/50 hover:text-ink">✕</button>
        </header>

        <div className="px-4 py-3 border-b border-black/10 space-y-2">
          <div className="text-xs uppercase tracking-wide text-ink/60">Stage</div>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                className={
                  'text-[11px] rounded-full px-2 py-1 border ' +
                  (lead.status === s
                    ? 'bg-ink text-white border-ink'
                    : 'border-black/10 hover:bg-black/5')
                }
              >
                {s}
              </button>
            ))}
          </div>
          {lead.qualifying_data && Object.keys(safeObj(lead.qualifying_data)).length > 0 && (
            <div className="text-xs text-ink/70 mt-2">
              <strong>Qualifying:</strong>{' '}
              {Object.entries(safeObj(lead.qualifying_data))
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-cream">
          {thread.map(m => (
            <div
              key={m.id}
              className={
                'max-w-[80%] rounded-2xl px-3 py-2 text-sm ' +
                (m.direction === 'inbound'
                  ? 'bg-white border border-black/5 self-start'
                  : 'bg-ink text-white ml-auto')
              }
            >
              {m.body}
              <div className={
                'text-[10px] mt-1 ' +
                (m.direction === 'inbound' ? 'text-ink/40' : 'text-white/60')
              }>
                {m.sender} · {new Date(m.sent_at).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {thread.length === 0 && (
            <div className="text-sm text-ink/50 italic text-center mt-10">No messages yet</div>
          )}
        </div>

        <div className="p-3 border-t border-black/10 flex gap-2">
          <input
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm"
            placeholder="Type a manual reply…"
          />
          <button
            onClick={send}
            disabled={busy || !reply.trim()}
            className="rounded-lg bg-accent text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function safeObj(x) {
  if (!x) return {};
  if (typeof x === 'object') return x;
  try { return JSON.parse(x); } catch { return {}; }
}
