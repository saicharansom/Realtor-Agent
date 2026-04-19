import React, { useState } from 'react';

const COLUMNS = [
  { key: 'new',                label: 'New',         dot: '#9CA3AF', accent: '#9CA3AF' },
  { key: 'qualifying',         label: 'Qualifying',  dot: '#F59E0B', accent: '#F59E0B' },
  { key: 'interested',         label: 'Interested',  dot: '#3B82F6', accent: '#3B82F6' },
  { key: 'showing_scheduled',  label: 'Showing',     dot: '#8B5CF6', accent: '#8B5CF6' },
  { key: 'offer_stage',        label: 'Offer Stage', dot: '#F97316', accent: '#F97316' },
  { key: 'closed',             label: 'Closed',      dot: '#22C55E', accent: '#22C55E' },
];

const EXITED = ['disqualified', 'cold'];

const CONTACT_COLORS = {
  buyer:  { bg: '#EFF6FF', text: '#1D4ED8' },
  renter: { bg: '#F5F3FF', text: '#6D28D9' },
  seller: { bg: '#FFFBEB', text: '#B45309' },
};

const AVATAR_PALETTE = [
  { bg: '#FEF0F1', text: '#C8102E' },
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#F0FDF4', text: '#15803D' },
  { bg: '#FFFBEB', text: '#B45309' },
  { bg: '#F5F3FF', text: '#6D28D9' },
  { bg: '#FFF7ED', text: '#C2410C' },
];

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name, phone) {
  if (name)  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (phone) return phone.replace('web-', '').slice(-2).toUpperCase();
  return '??';
}

function avatarColor(id) {
  const idx = (id?.charCodeAt?.(0) || 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

// ── Mobile: filterable list ────────────────────────────────────
function MobileLeadList({ leads, onOpen }) {
  const [filter, setFilter] = useState('all');
  const sorted   = [...leads].sort((a, b) => new Date(b.last_message?.sent_at || 0) - new Date(a.last_message?.sent_at || 0));
  const filtered = filter === 'all' ? sorted : sorted.filter(l => l.status === filter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="font-display font-semibold text-ink" style={{ fontSize: 22 }}>Pipeline</h1>
        <span className="font-sans text-sm" style={{ color: '#A09688' }}>{sorted.length} leads</span>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
        {COLUMNS.map(c => (
          <FilterChip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)} dot={c.dot}>
            {c.label}
          </FilterChip>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map((lead, i) => (
          <MobileLeadRow key={lead.id} lead={lead} onClick={() => onOpen(lead)}
            style={{ animationDelay: `${i * 35}ms` }} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-14 font-sans text-sm" style={{ color: '#A09688' }}>
            No leads in this stage
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children, dot }) {
  return (
    <button onClick={onClick}
      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-all"
      style={{
        background:   active ? '#C8102E' : '#FFFFFF',
        border:      `1px solid ${active ? '#C8102E' : '#E8E4DC'}`,
        color:        active ? '#FFFFFF' : '#5C554E',
        boxShadow:   active ? '0 1px 4px rgba(200,16,46,0.3)' : '0 1px 2px rgba(26,23,20,0.04)',
      }}>
      {dot && !active && <span className="size-1.5 rounded-full shrink-0" style={{ background: dot }} />}
      {children}
    </button>
  );
}

function MobileLeadRow({ lead, onClick, style }) {
  const { bg, text } = avatarColor(lead.id);
  const ct = CONTACT_COLORS[lead.contact_type];
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all animate-fade-up"
      style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', boxShadow: '0 1px 3px rgba(26,23,20,0.05)', ...style }}
      onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,23,20,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseOut={e  => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(26,23,20,0.05)'; e.currentTarget.style.transform = 'none'; }}>
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl grid place-items-center shrink-0 font-sans font-semibold text-sm"
          style={{ background: bg, color: text }}>
          {initials(lead.name, lead.phone)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans font-semibold text-ink text-sm truncate">{lead.name || lead.phone}</span>
            {lead.last_message?.sent_at && (
              <span className="text-[11px] shrink-0 font-sans" style={{ color: '#A09688' }}>
                {timeAgo(lead.last_message.sent_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`status-${lead.status} text-[10px] font-sans font-medium px-2 py-0.5 rounded-full border`}>
              {lead.status?.replace(/_/g, ' ')}
            </span>
            {lead.contact_type && ct && (
              <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full"
                style={{ background: ct.bg, color: ct.text }}>
                {lead.contact_type}
              </span>
            )}
          </div>
        </div>
      </div>
      {lead.last_message?.body && (
        <p className="mt-2.5 text-xs font-sans truncate" style={{ color: '#A09688', paddingLeft: 52 }}>
          {lead.last_message.body}
        </p>
      )}
    </button>
  );
}

// ── Desktop: kanban ────────────────────────────────────────────
function DesktopKanban({ leads, onOpen }) {
  const byStatus = Object.fromEntries(COLUMNS.map(c => [c.key, []]));
  const exited   = [];
  for (const l of leads) {
    if (EXITED.includes(l.status))   exited.push(l);
    else if (byStatus[l.status])     byStatus[l.status].push(l);
    else                             byStatus.new.push(l);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display font-semibold text-ink" style={{ fontSize: 22 }}>Pipeline</h1>
        <span className="font-sans text-sm" style={{ color: '#A09688' }}>{leads.length} leads</span>
      </div>

      {/* Kanban — 2 rows × 3 cols */}
      <div className="grid grid-cols-3 gap-3">
        {COLUMNS.map((col, i) => (
          <div key={col.key}
            className={`col-${col.key} rounded-2xl animate-fade-up`}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8E4DC',
              borderTop: `3px solid ${col.accent}`,
              boxShadow: '0 1px 3px rgba(26,23,20,0.04)',
              padding: '14px 12px',
              animationDelay: `${i * 55}ms`,
            }}>
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full shrink-0" style={{ background: col.accent }} />
                <span className="text-[11px] uppercase tracking-widest font-sans font-semibold" style={{ color: '#5C554E' }}>
                  {col.label}
                </span>
              </div>
              <span className="text-[11px] font-sans font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#F6F5F2', color: '#A09688' }}>
                {byStatus[col.key].length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {byStatus[col.key].map(l => (
                <KanbanCard key={l.id} lead={l} onClick={() => onOpen(l)} />
              ))}
              {byStatus[col.key].length === 0 && (
                <div className="text-[11px] font-sans italic text-center py-5" style={{ color: '#C8C3BB' }}>
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Parked leads */}
      {exited.length > 0 && (
        <div className="rounded-2xl p-4 animate-fade-up delay-300"
          style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
          <div className="text-[11px] uppercase tracking-widest font-sans font-semibold mb-3" style={{ color: '#A09688' }}>
            Parked · {exited.length}
          </div>
          <div className="flex flex-wrap gap-2">
            {exited.map(l => (
              <button key={l.id} onClick={() => onOpen(l)}
                className="flex items-center gap-1.5 text-xs font-sans px-3 py-1.5 rounded-full transition-all"
                style={{ background: '#F6F5F2', border: '1px solid #E8E4DC', color: '#6B6459' }}
                onMouseOver={e => { e.currentTarget.style.background = '#EEE9E2'; }}
                onMouseOut={e  => { e.currentTarget.style.background = '#F6F5F2'; }}>
                <span className="size-1.5 rounded-full"
                  style={{ background: l.status === 'disqualified' ? '#FCA5A5' : '#D1D5DB' }} />
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
  const { bg, text } = avatarColor(lead.id);
  const ct = CONTACT_COLORS[lead.contact_type];

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl p-2.5 transition-all group"
      style={{ background: '#FAFAF8', border: '1px solid #EEE9E2' }}
      onMouseOver={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,23,20,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseOut={e  => { e.currentTarget.style.background = '#FAFAF8'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-lg grid place-items-center shrink-0 font-sans font-semibold text-[10px]"
          style={{ background: bg, color: text }}>
          {initials(lead.name, lead.phone)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-sans font-semibold text-ink truncate">
            {lead.name || lead.phone}
          </div>
          {lead.contact_type && ct && (
            <span className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded"
              style={{ background: ct.bg, color: ct.text }}>
              {lead.contact_type}
            </span>
          )}
        </div>
        {lead.last_message?.sent_at && (
          <span className="text-[9px] font-sans shrink-0" style={{ color: '#A09688' }}>
            {timeAgo(lead.last_message.sent_at)}
          </span>
        )}
      </div>
      {lead.last_message?.body && (
        <p className="mt-1.5 text-[10px] font-sans truncate leading-relaxed"
          style={{ color: '#A09688', paddingLeft: 36 }}>
          {lead.last_message.body}
        </p>
      )}
    </button>
  );
}

export default function LeadPipeline({ leads, onOpen }) {
  return (
    <>
      <div className="md:hidden">
        <MobileLeadList leads={leads} onOpen={onOpen} />
      </div>
      <div className="hidden md:block">
        <DesktopKanban leads={leads} onOpen={onOpen} />
      </div>
    </>
  );
}
