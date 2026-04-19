import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import VideoStudio from './components/VideoStudio.jsx';
import LeadPipeline from './components/LeadPipeline.jsx';
import LeadDrawer from './components/LeadDrawer.jsx';

const IconPipeline = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);

const IconStudio = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);

const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

export default function App() {
  const [leads, setLeads]           = useState([]);
  const [activeLead, setActiveLead] = useState(null);
  const [toast, setToast]           = useState(null);
  const [tab, setTab]               = useState('pipeline');
  const [toastTimer, setToastTimer] = useState(null);

  async function refresh() {
    try { setLeads(await api.leads()); } catch {}
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, []);

  function notify(msg) {
    setToast(msg);
    if (toastTimer) clearTimeout(toastTimer);
    setToastTimer(setTimeout(() => setToast(null), 3500));
  }

  const offerLead = leads.find(l => l.status === 'offer_stage');

  return (
    <div className="mesh-bg noise flex flex-col h-full overflow-hidden">

      {/* ── Header ───────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-5 pt-safe"
        style={{ height: 64, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl grid place-items-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#c9973a,#e0b96a)', boxShadow: '0 0 20px rgba(201,151,58,0.35)' }}>
            <span className="font-display font-semibold text-bg text-base leading-none">R</span>
          </div>
          <div>
            <div className="font-display font-semibold text-ivory leading-tight tracking-wide" style={{ fontSize: 17 }}>
              RealtorAI
            </div>
            <div className="text-[11px] text-muted font-sans font-light tracking-wider uppercase">
              Intelligence Platform
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {offerLead && (
            <button
              onClick={() => setActiveLead(offerLead)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-sans font-medium text-bg animate-pulse-gold"
              style={{ background: 'linear-gradient(135deg,#c9973a,#e0b96a)', fontSize: 12 }}
            >
              <span className="size-1.5 rounded-full bg-bg/60 shrink-0" />
              {offerLead.name || offerLead.phone}
            </button>
          )}
          <button className="size-9 rounded-xl grid place-items-center text-muted hover:text-ivory transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <IconBell />
          </button>
        </div>
      </header>

      {/* ── Desktop: side-by-side | Mobile: tabbed ───────── */}
      <main className="flex-1 overflow-hidden">

        {/* Desktop layout */}
        <div className="hidden md:grid h-full" style={{ gridTemplateColumns: '1fr 400px' }}>
          <section className="overflow-y-auto p-5 pr-2.5">
            <LeadPipeline leads={leads} onOpen={setActiveLead} onRefresh={refresh} />
          </section>
          <section className="overflow-y-auto p-5 pl-2.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <VideoStudio notify={notify} />
          </section>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden h-full overflow-y-auto">
          {tab === 'pipeline'
            ? <div className="p-4 pb-24 animate-fade-up"><LeadPipeline leads={leads} onOpen={setActiveLead} onRefresh={refresh} /></div>
            : <div className="p-4 pb-24 animate-fade-up"><VideoStudio notify={notify} /></div>
          }
        </div>
      </main>

      {/* ── Mobile bottom tab bar ─────────────────────────── */}
      <nav className="md:hidden shrink-0 pb-safe"
        style={{ background: 'rgba(13,15,23,0.96)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex">
          {[
            { key: 'pipeline', label: 'Pipeline', Icon: IconPipeline },
            { key: 'studio',   label: 'Studio',   Icon: IconStudio   },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
              style={{ color: tab === key ? '#c9973a' : '#4e5568' }}
            >
              <Icon />
              <span className="text-[11px] font-sans font-medium tracking-wide">{label}</span>
              {tab === key && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full"
                  style={{ background: '#c9973a', marginBottom: 'env(safe-area-inset-bottom,0px)' }} />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Lead drawer ───────────────────────────────────── */}
      {activeLead && (
        <LeadDrawer lead={activeLead} onClose={() => setActiveLead(null)} onRefresh={refresh} />
      )}

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up"
          style={{ background: 'rgba(24,29,42,0.95)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px',
            borderRadius: 12, fontSize: 13, color: '#f0ece3', whiteSpace: 'nowrap',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
