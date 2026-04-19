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

const AgentAvatar = () => (
  <div className="size-8 rounded-xl grid place-items-center shrink-0"
    style={{ background: '#C8102E' }}>
    <svg viewBox="0 0 20 20" fill="white" width="14" height="14">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
    </svg>
  </div>
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
  const bottomRef    = useRef(null);
  const textareaRef  = useRef(null);

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
      style={{ background: '#F6F5F2', fontFamily: "'Figtree', ui-sans-serif, sans-serif" }}>

      <div className="w-full max-w-lg flex flex-col mx-auto" style={{ height: '100svh', maxHeight: 800 }}>

        {/* ── Header ── */}
        <header className="shrink-0 flex items-center gap-3 px-5 py-4 bg-surface"
          style={{ borderBottom: '1px solid #E8E4DC', boxShadow: '0 1px 3px rgba(26,23,20,0.05)' }}>
          <AgentAvatar />
          <div className="flex-1 min-w-0">
            <div className="font-sans font-semibold text-ink text-[15px]">Real Estate Assistant</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="size-1.5 rounded-full bg-jade animate-pulse" style={{ background: '#22C55E' }} />
              <span className="text-[11px] font-sans" style={{ color: '#A09688' }}>Online · RealtorAI</span>
            </div>
          </div>
          <div className="text-[11px] font-sans font-medium px-2.5 py-1 rounded-full"
            style={{ background: '#F6F5F2', border: '1px solid #E8E4DC', color: '#A09688' }}>
            AI Guide
          </div>
        </header>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ background: '#F6F5F2' }}>

          {messages.map((m, i) => (
            <div key={i}
              className={`flex gap-2.5 animate-fade-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animationDelay: '0ms' }}>

              {m.role === 'ai' && <AgentAvatar />}

              <div className="max-w-[78%]">
                <div className="px-4 py-2.5 rounded-2xl text-sm font-sans leading-relaxed"
                  style={m.role === 'user'
                    ? { background: '#C8102E', color: '#FFFFFF', borderBottomRightRadius: 6, boxShadow: '0 1px 4px rgba(200,16,46,0.25)' }
                    : { background: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1714', borderBottomLeftRadius: 6, boxShadow: '0 1px 3px rgba(26,23,20,0.05)' }
                  }>
                  {m.text}
                </div>
              </div>

              {m.role === 'user' && (
                <div className="size-8 rounded-xl grid place-items-center shrink-0 font-sans font-bold text-xs"
                  style={{ background: '#FEF0F1', color: '#C8102E', border: '1px solid #FECDD3' }}>
                  {name ? name[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2.5 justify-start animate-fade-up">
              <AgentAvatar />
              <div className="px-4 py-3 rounded-2xl"
                style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', borderBottomLeftRadius: 6, boxShadow: '0 1px 3px rgba(26,23,20,0.05)' }}>
                <div className="flex gap-1.5 items-center" style={{ height: 16 }}>
                  <span className="size-2 rounded-full animate-dot-1" style={{ background: '#D0CBC0' }} />
                  <span className="size-2 rounded-full animate-dot-2" style={{ background: '#D0CBC0' }} />
                  <span className="size-2 rounded-full animate-dot-3" style={{ background: '#D0CBC0' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="shrink-0 px-4 py-3 flex gap-2 items-end bg-surface"
          style={{ borderTop: '1px solid #E8E4DC' }}>
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm font-sans text-ink placeholder-muted focus:outline-none transition-all leading-relaxed"
            style={{ background: '#F6F5F2', border: '1px solid #E8E4DC', maxHeight: 120 }}
            placeholder={nameAsked ? 'Ask about properties…' : 'Enter your name…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            onFocus={e  => e.target.style.borderColor = '#C8102E'}
            onBlur={e   => e.target.style.borderColor = '#E8E4DC'}
            disabled={loading}
          />
          <button onClick={send} disabled={loading || !input.trim()}
            className="shrink-0 size-10 rounded-2xl grid place-items-center transition-all disabled:opacity-30"
            style={{ background: '#C8102E', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(200,16,46,0.3)' }}
            onMouseOver={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#A50D25'; }}
            onMouseOut={e  => { e.currentTarget.style.background = '#C8102E'; }}>
            <SendIcon />
          </button>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-sans text-center hidden md:block" style={{ color: '#C8C3BB' }}>
        Your conversation is private and secure · Powered by RealtorAI
      </p>
    </div>
  );
}
