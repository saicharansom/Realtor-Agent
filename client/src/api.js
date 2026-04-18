const BASE = import.meta.env.VITE_API_BASE || '';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt}`);
  }
  return res.json();
}

export const api = {
  health:            () => req('/api/health'),
  listings:          () => req('/api/listings'),
  parseListing:      zillow_url => req('/api/listings/parse', { method: 'POST', body: { zillow_url } }),
  generateVideo:     id => req(`/api/listings/${id}/generate-video`, { method: 'POST' }),
  leads:             () => req('/api/leads'),
  lead:              id => req(`/api/leads/${id}`),
  thread:            id => req(`/api/leads/${id}/thread`),
  setStatus:         (id, status) => req(`/api/leads/${id}/status`, { method: 'PATCH', body: { status } }),
  sendMessage:       (id, body) => req(`/api/leads/${id}/message`, { method: 'POST', body: { body } }),
  showings:          () => req('/api/showings'),
  createShowing:     body => req('/api/showings', { method: 'POST', body }),
};
