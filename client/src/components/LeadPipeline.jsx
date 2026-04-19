import React, { useState } from 'react';

const COLUMNS = [
  { key: 'new',                label: 'New',              dot: '#4e5568' },
  { key: 'qualifying',         label: 'Qualifying',       dot: '#f5a524' },
  { key: 'interested',         label: 'Interested',       dot: '#4f8ef7' },
  { key: 'showing_scheduled',  label: 'Showing',          dot: '#a050f0' },
  { key: 'offer_stage',        label: 'Offer Stage',      dot: '#f07040' },
  { key: 'closed',             label: 'Closed',           dot: '#22c87a' },
];

const EXITED = ['disqualified', 'cold'];

const CONTACT_COLORS = {
  buyer:  { bg: 'rgba(79,142,247,0.15)',  text: '#7aabf9' },
  renter: { bg: 'rgba(160,80,240,0.15)',  text: '#c07af8' },
  seller: { bg: 'rgba(201,151,58,0.15)',  text: '#e0b96a' },
};

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name, phone) {
  if (name) return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (phone) return phone.replace('web-','').slice(-2).toUpperCase();
  return '??';
}

const AVATAR_COLORS = [
  ['#c9973a','#3d2e10'], ['#4f8ef7','#0e1e3d'], ['#a050f0','#28103d'],
  ['#22c87a','#0a2d1c'], ['#f07040','#3d1810'], ['#f5a524','#3d2a08'],
];

function avatarColor(id) {
  const idx = (id?.charCodeAt?.(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ── Mobile: status filter list view ─────────────────────────────────────────
function MobileLeadList({ leads, onOpen }) {
  const [filter, setFilter] = useState('all');
  const allLeads = [...leads].sort((a, b) =>
    new Date(b.last_message?.sent_at || 0) - new Date(a.last_message?.sent_at || 0)
  );
  const filtered = filter === 'all' ? allLeads : allLeads.filter(l => l.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ivory tracking-wide">Pipeline</h2>
        <span className="text-sm text-muted font-sans">{allLeads.length} leads</span>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
        {COLUMNS.map(c => (
          <FilterChip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)} dot={c.dot}>
            {c.label}
          </FilterChip>
        ))}
      </div>

      {/* Lead list */}
      <div className="space-y-2">
        {filtered.map((lead, i) => (
          <MobileLeadRow key={lead.id} lead={lead} onClick={() => onOpen(lead)}
            style={{ animationDelay: `${i * 40}ms` }} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted font-sans text-sm">No leads in this stage</div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children, dot }) {
  return (
    <button onClick={onClick} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-all"
      style={{
        background: active ? 'rgba(201,151,58,0.2)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? 'rgba(201,151,58,0.4)' : 'rgba(255,255,255,0.07)'}`,
        color: active ? '#e0b96a' : '#4e5568',
      }}>
      {dot && <span className="size-1.5 rounded-full shrink-0" style={{ background: dot }} />}
      {children}
    </button>
  );
}

function MobileLeadRow({ lead, onClick, style }) {
  const [fg, bg] = avatarColor(lead.id);
  const ct = CONTACT_COLORS[lead.contact_type];
  return (
    <button onClick={onClick} className={`w-full text-left rounded-2xl p-3.5 transition-all animate-fade-up hover:brightness-110`}
      style={{ background: 'rgba(24,29,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', ...style }}>
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl grid place-items-center shrink-0 font-sans font-semibold text-sm"
          style={{ background: bg, color: fg }}>{initials(lead.name, lead.phone)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans font-medium text-ivory text-sm truncate">{lead.name || lead.phone}</span>
            {lead.last_message?.sent_at && (
              <span className="text-[11px] text-muted shrink-0">{timeAgo(lead.last_message.sent_at)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`status-${lead.status} text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-full border`}>
              {lead.status?.replace('_', ' ')}
            </span>
            {lead.contact_type && ct && (
              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-full"
                style={{ background: ct.bg, color: ct.text }}>{lead.contact_type}</span>
            )}
          </div>
        </div>
      </div>
      {lead.last_message?.body && (
        <p className="mt-2 text-xs text-muted font-sans truncate pl-13" style={{ paddingLeft: 52 }}>
          {lead.last_message.body}
        </p>
      )}
    </button>
  );
}

// ── Desktop: horizontal kanban ───────────────────────────────────────────────
function DesktopKanban({ leads, onOpen }) {
  const byStatus = Object.fromEntries(COLUMNS.map(c => [c.key, []]));
  const exited = [];
  for (const l of leads) {
    if (EXITED.includes(l.status)) exited.push(l);
    else if (byStatus[l.status]) byStatus[l.status].push(l);
    else byStatus.new.push(l);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ivory tracking-wide">Pipeline</h2>
        <span className="text-sm text-muted font-sans">{leads.length} leads</span>
      </div>

      {/* Kanban columns - 2 rows of 3 */}
      <div className="grid grid-cols-3 gap-3">
        {COLUMNS.map((col, i) => (
          <div key={col.key}
            className={`col-${col.key} rounded-2xl p-3 animate-fade-up`}
            style={{
              background: 'rgba(19,22,31,0.8)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderTop: `2px solid ${col.dot}`,
              animationDelay: `${i * 60}ms`,
              minHeight: 140,
            }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: col.dot }} />
                <span className="text-[11px] uppercase tracking-widest font-sans font-medium text-muted">{col.label}</span>
              </div>
              <span className="text-[11px] font-sans font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#4e5568' }}>
                {byStatus[col.key].length}
              </span>
            </div>
            <div className="space-y-2">
              {byStatus[col.key].map(l => (
                <KanbanCard key={l.id} lead={l} onClick={() => onOpen(l)} />
              ))}
              {byStatus[col.key].length === 0 && (
                <div className="text-[11px] text-muted/50 italic font-sans text-center py-4">Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {exited.length > 0 && (
        <div className="rounded-2xl p-3 animate-fade-up delay-300"
          style={{ background: 'rgba(19,22,31,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[11px] uppercase tracking-widest font-sans font-medium text-muted mb-2.5">
            Parked · {exited.length}
          </div>
          <div className="flex flex-wrap gap-2">
            {exited.map(l => (
              <button key={l.id} onClick={() => onOpen(l)}
                className="flex items-center gap-1.5 text-[11px] font-sans px-2.5 py-1 rounded-full transition-colors hover:text-ivory"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4e5568' }}>
                <span className={`size-1.5 rounded-full ${l.status === 'disqualified' ? 'bg-ruby/60' : 'bg-muted/60'}`} />
                {l.name || l.phone}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanCard({ lead, onClick }) {
  const [fg, bg] = avatarColor(lead.id);
  const ct = CONTACT_COLORS[lead.contact_type];
  const last = lead.last_message?.body;

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl p-2.5 transition-all group hover:brightness-110"
      style={{ background: 'rgba(24,29,42,0.9)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-lg grid place-items-center shrink-0 font-sans font-semibold text-[10px]"
          style={{ background: bg, color: fg }}>{initials(lead.name, lead.phone)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-sans font-medium text-ivory truncate group-hover:text-gold-lt transition-colors">
            {lead.name || lead.phone}
          </div>
          {lead.contact_type && ct && (
            <span className="text-[9px] font-sans px-1 py-0.5 rounded"
              style={{ background: ct.bg, color: ct.text }}>{lead.contact_type}</span>
          )}
        </div>
        {lead.last_message?.sent_at && (
          <span className="text-[9px] text-muted shrink-0">{timeAgo(lead.last_message.sent_at)}</span>
        )}
      </div>
      {last && (
        <p className="mt-1.5 text-[10px] text-muted font-sans truncate leading-relaxed" style={{ paddingLeft: 36 }}>
          {last}
        </p>
      )}
    </button>
  );
}

export default function LeadPipeline({ leads, onOpen, onRefresh }) {
  return (
    <>
      {/* Mobile */}
      <div className="md:hidden">
        <MobileLeadList leads={leads} onOpen={onOpen} />
      </div>
      {/* Desktop */}
      <div className="hidden md:block">
        <DesktopKanban leads={leads} onOpen={onOpen} />
      </div>
    </>
  );
}
