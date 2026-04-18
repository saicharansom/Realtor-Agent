// Local dev:  VITE_API_BASE unset → calls go to local Express via Vite proxy (/api/...)
// Deployed:   VITE_API_BASE = https://your-backend.onrender.com
const FBASE = import.meta.env.VITE_FUNCTIONS_BASE || null;
const API_BASE = import.meta.env.VITE_API_BASE || '';

async function req(path, opts = {}) {
  const res = await fetch(path, {
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

// Call a named Butterbase function
function fn(name, opts = {}) {
  return req(`${FBASE}/${name}`, opts);
}

// Call backend Express endpoint (prefixed with VITE_API_BASE in production)
function local(path, opts = {}) {
  return req(`${API_BASE}${path}`, opts);
}

export const api = {
  health: () =>
    FBASE ? fn('health') : local('/api/health'),

  generateFromImages: (images, prompt) =>
    FBASE
      ? fn('generate-from-images', { method: 'POST', body: { images, prompt } })
      : local('/api/listings/generate-from-images', { method: 'POST', body: { images, prompt } }),

  leads:       () => FBASE ? fn('leads') : local('/api/leads'),
  lead:        id => FBASE ? Promise.resolve({}) : local(`/api/leads/${id}`),
  thread:      id => FBASE ? Promise.resolve([]) : local(`/api/leads/${id}/thread`),
  setStatus:   (id, status) => FBASE ? Promise.resolve({}) : local(`/api/leads/${id}/status`, { method: 'PATCH', body: { status } }),
  sendMessage: (id, body)   => FBASE ? Promise.resolve({}) : local(`/api/leads/${id}/message`, { method: 'POST', body: { body } }),
  showings:    () => FBASE ? Promise.resolve([]) : local('/api/showings'),
  createShowing: body => FBASE ? Promise.resolve({}) : local('/api/showings', { method: 'POST', body }),

  chatMessage: (session_id, message, name, listing_id) =>
    local('/api/chat', { method: 'POST', body: { session_id, message, name, listing_id } }),
  chatThread: (session_id) =>
    local(`/api/chat/${session_id}/thread`),
};
