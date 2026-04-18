import React from 'react';

const COLUMNS = [
  { key: 'new',                label: 'New' },
  { key: 'qualifying',         label: 'Qualifying' },
  { key: 'interested',         label: 'Interested' },
  { key: 'showing_scheduled',  label: 'Showing scheduled' },
  { key: 'offer_stage',        label: 'Offer stage' },
  { key: 'closed',             label: 'Closed' },
];

const EXITED = ['disqualified', 'cold'];

export default function LeadPipeline({ leads, onOpen }) {
  const byStatus = Object.fromEntries(COLUMNS.map(c => [c.key, []]));
  const exited = [];
  for (const l of leads) {
    if (EXITED.includes(l.status)) exited.push(l);
    else if (byStatus[l.status]) byStatus[l.status].push(l);
    else byStatus.new.push(l);
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Pipeline</h2>
      <div className="grid grid-cols-3 gap-3">
        {COLUMNS.map(col => (
          <div key={col.key} className="rounded-2xl bg-white p-3 shadow-sm border border-black/5 min-h-[120px]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wide text-ink/60">{col.label}</div>
              <div className="text-xs text-ink/40">{byStatus[col.key].length}</div>
            </div>
            <div className="space-y-2">
              {byStatus[col.key].map(l => (
                <LeadCard key={l.id} lead={l} onClick={() => onOpen(l)} />
              ))}
              {byStatus[col.key].length === 0 && (
                <div className="text-xs text-ink/40 italic">Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {exited.length > 0 && (
        <div className="rounded-2xl bg-white p-3 shadow-sm border border-black/5">
          <div className="text-xs uppercase tracking-wide text-ink/60 mb-2">Parked ({exited.length})</div>
          <div className="flex flex-wrap gap-2">
            {exited.map(l => (
              <button
                key={l.id}
                onClick={() => onOpen(l)}
                className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black/5"
              >
                {l.name || l.phone} · {l.status}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, onClick }) {
  const last = lead.last_message?.body || 'No messages yet';
  const contact = lead.contact_type ? lead.contact_type.toUpperCase() : '—';
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-black/5 p-2 hover:bg-black/5"
    >
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm truncate">
          {lead.name || lead.phone}
        </div>
        <span className="text-[10px] rounded-full bg-ink/5 px-2 py-0.5">{contact}</span>
      </div>
      <div className="text-xs text-ink/60 truncate mt-1">{last}</div>
      {lead.listing?.address && (
        <div className="text-[11px] text-ink/50 mt-1 truncate">📍 {lead.listing.address}</div>
      )}
    </button>
  );
}
