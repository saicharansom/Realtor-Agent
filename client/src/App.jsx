import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import VideoStudio from './components/VideoStudio.jsx';
import LeadPipeline from './components/LeadPipeline.jsx';
import LeadDrawer from './components/LeadDrawer.jsx';

export default function App() {
  const [leads, setLeads] = useState([]);
  const [activeLead, setActiveLead] = useState(null);
  const [toast, setToast] = useState(null);

  async function refresh() {
    try {
      const l = await api.leads();
      setLeads(l);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, []);

  // Offer-stage notification
  const offerLead = leads.find(l => l.status === 'offer_stage');

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-black/10 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-accent text-white grid place-items-center font-bold">R</div>
          <div>
            <div className="font-semibold leading-tight">RealtorAI</div>
            <div className="text-xs text-ink/60">Zillow → video, iMessage → deals</div>
          </div>
        </div>
        {offerLead && (
          <button
            onClick={() => setActiveLead(offerLead)}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow animate-pulse"
          >
            🔔 {offerLead.name || offerLead.phone} is ready for you
          </button>
        )}
      </header>

      <main className="grid grid-cols-12 gap-6 p-6 flex-1 overflow-hidden">
        <section className="col-span-7 overflow-y-auto">
          <LeadPipeline leads={leads} onOpen={setActiveLead} onRefresh={refresh} />
        </section>
        <section className="col-span-5 overflow-y-auto">
          <VideoStudio notify={setToast} />
        </section>
      </main>

      {activeLead && (
        <LeadDrawer
          lead={activeLead}
          onClose={() => setActiveLead(null)}
          onRefresh={refresh}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-ink text-white px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
