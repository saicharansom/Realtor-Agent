import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

function getOrCreateSession() {
  let id = localStorage.getItem('buyer_session');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('buyer_session', id);
  }
  return id;
}

export default function BuyerChat() {
  const params = new URLSearchParams(window.location.search);
  const listingId = params.get('listing') || null;
  const sessionId = getOrCreateSession();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState(localStorage.getItem('buyer_name') || '');
  const [nameAsked, setNameAsked] = useState(!!localStorage.getItem('buyer_name'));
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Load existing thread on mount
  useEffect(() => {
    api.chatThread(sessionId).then(thread => {
      if (thread.length > 0) {
        setMessages(thread.map(m => ({ role: m.direction === 'inbound' ? 'user' : 'ai', text: m.body })));
        setNameAsked(true);
      } else {
        // Greeting
        setMessages([{
          role: 'ai',
          text: "Hi! I'm your real estate assistant. What's your name?",
        }]);
      }
    }).catch(() => {
      setMessages([{
        role: 'ai',
        text: "Hi! I'm your real estate assistant. What's your name?",
      }]);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    // First message = name capture
    if (!nameAsked) {
      const buyerName = text;
      localStorage.setItem('buyer_name', buyerName);
      setName(buyerName);
      setNameAsked(true);
      setMessages(prev => [
        ...prev,
        { role: 'user', text },
        { role: 'ai', text: `Nice to meet you, ${buyerName}! How can I help you today? Are you looking to buy, rent, or sell?` },
      ]);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await api.chatMessage(sessionId, text, name || undefined, listingId || undefined);
      setMessages(prev => [...prev, { role: 'ai', text: res.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden" style={{ height: '80vh' }}>

        {/* Header */}
        <div className="bg-accent px-5 py-4 flex items-center gap-3">
          <div className="size-10 rounded-full bg-white/20 grid place-items-center text-white font-bold text-lg">R</div>
          <div>
            <div className="text-white font-semibold">Real Estate Assistant</div>
            <div className="text-white/70 text-xs">Powered by RealtorAI</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-green-400"></div>
            <span className="text-white/80 text-xs">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'ai' && (
                <div className="size-7 rounded-full bg-accent/10 grid place-items-center mr-2 mt-1 shrink-0">
                  <span className="text-accent text-xs font-bold">R</span>
                </div>
              )}
              <div
                className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="size-7 rounded-full bg-accent/10 grid place-items-center mr-2 mt-1 shrink-0">
                <span className="text-accent text-xs font-bold">R</span>
              </div>
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <div className="size-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="size-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="size-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3 flex gap-2 items-end">
          <textarea
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            rows={1}
            placeholder={nameAsked ? "Type a message…" : "Enter your name…"}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="shrink-0 size-9 rounded-xl bg-accent text-white grid place-items-center disabled:opacity-40 hover:bg-accent/90 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.668 5.828H12.5a.75.75 0 0 1 0 1.5H3.947l-1.668 5.828a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.222A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">Your conversation is private and secure.</p>
    </div>
  );
}
