import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import VideoStudio from './components/VideoStudio.jsx';
import LeadPipeline from './components/LeadPipeline.jsx';
import LeadDrawer from './components/LeadDrawer.jsx';

const IconPipeline = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
  </svg>
);

const IconStudio = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);

const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const IconFire = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-3">
    <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
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

  const offerLead   = leads.find(l => l.status === 'offer_stage');
  const totalLeads  = leads.length;
  const activeCount = leads.filter(l => !['disqualified','cold'].includes(l.status)).length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F6F5F2' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <header className="shrink-0 bg-surface pt-safe"
        style={{ borderBottom: '1px solid #E8E4DC', zIndex: 40 }}>
        <div className="flex items-center justify-between px-5" style={{ height: 60 }}>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 34, height: 34, background: '#C8102E' }}>
              <svg viewBox="0 0 20 20" fill="white" width="16" height="16">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
            </div>
            <div>
              <div className="font-display font-semibold leading-tight" style={{ fontSize: 17, color: '#1A1714' }}>
                RealtorAI
              </div>
              <div className="font-sans text-[10px] tracking-widest uppercase" style={{ color: '#A09688', letterSpacing: '0.08em' }}>
                Intelligence
              </div>
            </div>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F0EDEA' }}>
            {[
              { key: 'pipeline', label: 'Pipeline', Icon: IconPipeline },
              { key: 'studio',   label: 'Studio',   Icon: IconStudio   },
            ].map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-sans font-medium transition-all"
                style={tab === key
                  ? { background: '#FFFFFF', color: '#1A1714', boxShadow: '0 1px 3px rgba(26,23,20,0.08)' }
                  : { color: '#A09688' }
                }>
                <Icon />{label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Stats pill — desktop only */}
            <div className="hidden md:flex items-center gap-3 px-3.5 py-2 rounded-xl font-sans text-xs"
              style={{ background: '#F0EDEA', color: '#6B6459' }}>
              <span><strong style={{ color: '#1A1714' }}>{activeCount}</strong> active</span>
              <span style={{ width: 1, height: 12, background: '#D0CBC0' }} />
              <span><strong style={{ color: '#1A1714' }}>{totalLeads}</strong> total</span>
            </div>

            {/* Hot lead badge */}
            {offerLead && (
              <button onClick={() => setActiveLead(offerLead)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-sans font-semibold animate-pulse-red"
                style={{ background: '#C8102E', color: '#FFFFFF' }}>
                <IconFire />
                {offerLead.name || offerLead.phone}
              </button>
            )}

            {/* Bell */}
            <button className="flex items-center justify-center rounded-xl transition-colors"
              style={{ width: 36, height: 36, background: '#F0EDEA', color: '#5C554E' }}
              onMouseOver={e => e.currentTarget.style.background = '#E8E4DC'}
              onMouseOut={e  => e.currentTarget.style.background = '#F0EDEA'}>
              <IconBell />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">

        {/* Desktop: side-by-side */}
        <div className="hidden md:flex h-full">
          <section className="flex-1 overflow-y-auto p-6">
            <LeadPipeline leads={leads} onOpen={setActiveLead} onRefresh={refresh} />
          </section>
          <aside className="overflow-y-auto p-6 shrink-0" style={{ width: 380, borderLeft: '1px solid #E8E4DC' }}>
            <VideoStudio notify={notify} />
          </aside>
        </div>

        {/* Mobile: full-page tabs */}
        <div className="md:hidden h-full overflow-y-auto">
          {tab === 'pipeline'
            ? <div className="p-4 pb-24 animate-fade-in"><LeadPipeline leads={leads} onOpen={setActiveLead} onRefresh={refresh} /></div>
            : <div className="p-4 pb-24 animate-fade-in"><VideoStudio notify={notify} /></div>
          }
        </div>
      </main>

      {/* ── Mobile bottom tab bar ──────────────────────────── */}
      <nav className="md:hidden shrink-0 bg-surface pb-safe"
        style={{ borderTop: '1px solid #E8E4DC', zIndex: 40 }}>
        <div className="flex">
          {[
            { key: 'pipeline', label: 'Pipeline', Icon: IconPipeline },
            { key: 'studio',   label: 'Studio',   Icon: IconStudio   },
          ].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 flex flex-col items-center gap-1 py-3 font-sans transition-colors"
              style={{ color: tab === key ? '#C8102E' : '#A09688' }}>
              <Icon />
              <span className="text-[11px] font-medium tracking-wide">{label}</span>
              {tab === key && (
                <span className="h-0.5 rounded-full" style={{ width: 24, background: '#C8102E', marginTop: 1 }} />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Lead drawer ────────────────────────────────────── */}
      {activeLead && (
        <LeadDrawer lead={activeLead} onClose={() => setActiveLead(null)} onRefresh={refresh} />
      )}

      {/* ── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up font-sans text-sm"
          style={{ background: '#1A1714', color: '#F6F5F2', padding: '10px 20px',
            borderRadius: 10, whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(26,23,20,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
