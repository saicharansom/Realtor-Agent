import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

function getOrCreateSession() {
  let id = localStorage.getItem('buyer_session');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('buyer_session', id); }
  return id;
}

const SendIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.668 5.828H12.5a.75.75 0 0 1 0 1.5H3.947l-1.668 5.828a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.222A28.897 28.897 0 0 0 3.105 2.288Z"/>
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

export default function BuyerChat() {
  const params    = new URLSearchParams(window.location.search);
  const listingId = params.get('listing') || null;
  const sessionId = getOrCreateSession();

  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [name, setName]           = useState(localStorage.getItem('buyer_name') || '');
  const [nameAsked, setNameAsked] = useState(!!localStorage.getItem('buyer_name'));
  const [loading, setLoading]     = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    api.chatThread(sessionId).then(thread => {
      if (thread.length > 0) {
        setMessages(thread.map(m => ({ role: m.direction === 'inbound' ? 'user' : 'ai', text: m.body })));
        setNameAsked(true);
      } else {
        setMessages([{ role: 'ai', text: "Hi there! I'm your personal real estate guide. What's your name?" }]);
      }
    }).catch(() => {
      setMessages([{ role: 'ai', text: "Hi there! I'm your personal real estate guide. What's your name?" }]);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    if (!nameAsked) {
      const buyerName = text;
      localStorage.setItem('buyer_name', buyerName);
      setName(buyerName);
      setNameAsked(true);
      setMessages(prev => [
        ...prev,
        { role: 'user', text },
        { role: 'ai', text: `Lovely to meet you, ${buyerName}! Are you looking to buy, rent, or perhaps sell a property?` },
      ]);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await api.chatMessage(sessionId, text, name || undefined, listingId || undefined);
      setMessages(prev => [...prev, { role: 'ai', text: res.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, something went wrong. Please try again shortly." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center pt-safe pb-safe"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,151,58,0.12) 0%, transparent 60%), #07090e',
        fontFamily: "'Outfit', ui-sans-serif, sans-serif",
      }}>

      {/* Noise overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: '128px' }} />

      <div className="relative z-10 w-full max-w-lg flex flex-col mx-auto animate-fade-up"
        style={{ height: '100svh', maxHeight: 780 }}>

        {/* ── Header ── */}
        <header className="shrink-0 flex items-center gap-3 px-5 py-4"
          style={{ background: 'rgba(13,15,22,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="size-10 rounded-2xl grid place-items-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#c9973a,#e0b96a)', boxShadow: '0 0 20px rgba(201,151,58,0.3)' }}>
            <HomeIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-ivory text-base tracking-wide">Real Estate Assistant</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="size-1.5 rounded-full bg-jade animate-pulse" />
              <span className="text-[11px] text-muted font-sans">Online · RealtorAI</span>
            </div>
          </div>
        </header>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
          style={{ background: 'rgba(8,9,14,0.6)' }}>

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 animate-fade-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animationDelay: '0ms' }}>

              {m.role === 'ai' && (
                <div className="size-7 rounded-xl grid place-items-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(201,151,58,0.15)', border: '1px solid rgba(201,151,58,0.2)' }}>
                  <HomeIcon />
                </div>
              )}

              <div className="max-w-[78%]">
                <div className="px-4 py-2.5 rounded-2xl text-sm font-sans leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'linear-gradient(135deg,rgba(201,151,58,0.25),rgba(224,185,106,0.15))', border: '1px solid rgba(201,151,58,0.2)', color: '#f0ece3', borderBottomRightRadius: 6 }
                    : { background: 'rgba(22,27,39,0.9)', border: '1px solid rgba(255,255,255,0.07)', color: '#d8d4cc', borderBottomLeftRadius: 6 }
                  }>
                  {m.text}
                </div>
              </div>

              {m.role === 'user' && (
                <div className="size-7 rounded-xl grid place-items-center shrink-0 mt-0.5 font-sans font-semibold text-[11px]"
                  style={{ background: 'rgba(201,151,58,0.2)', color: '#e0b96a' }}>
                  {name ? name[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2.5 justify-start animate-fade-up">
              <div className="size-7 rounded-xl grid place-items-center shrink-0"
                style={{ background: 'rgba(201,151,58,0.15)', border: '1px solid rgba(201,151,58,0.2)' }}>
                <HomeIcon />
              </div>
              <div className="px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(22,27,39,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderBottomLeftRadius: 6 }}>
                <div className="flex gap-1.5 items-center h-4">
                  <span className="size-2 rounded-full bg-muted animate-dot-1" />
                  <span className="size-2 rounded-full bg-muted animate-dot-2" />
                  <span className="size-2 rounded-full bg-muted animate-dot-3" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="shrink-0 px-4 py-3 flex gap-2 items-end"
          style={{ background: 'rgba(10,12,18,0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm font-sans text-ivory placeholder-muted focus:outline-none transition-all leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 120 }}
            placeholder={nameAsked ? 'Ask about properties…' : 'Enter your name…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          <button onClick={send} disabled={loading || !input.trim()}
            className="shrink-0 size-10 rounded-2xl grid place-items-center transition-all disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg,#c9973a,#e0b96a)' }}>
            <span style={{ color: '#08090e' }}><SendIcon /></span>
          </button>
        </div>
      </div>

      <p className="relative z-10 mt-3 text-[11px] font-sans text-muted text-center hidden md:block">
        Your conversation is private and secure · Powered by RealtorAI
      </p>
    </div>
  );
}
