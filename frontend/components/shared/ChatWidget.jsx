/**
 * components/shared/ChatWidget.jsx
 * AI chat support widget — shown as floating button on subscriber pages.
 */

import { useState, useEffect, useRef } from 'react';
import { getToken } from '../../lib/auth';

const CHAT_API = (process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in') + '/api/chat';
const SESSION_KEY = 'hr_chat_session';
const HISTORY_KEY = 'hr_chat_history';
const SUGGESTED = [
  { en: 'How do I create an album?',        hi: 'एल्बम कैसे बनाएं?',             mz: 'Album engtin nge siam?' },
  { en: 'What are the pricing plans?',      hi: 'कीमत क्या है?',                  mz: 'Price engzat nge?' },
  { en: 'How does the QR code work?',       hi: 'QR कोड कैसे काम करता है?',       mz: 'QR Code engtin nge?' },
  { en: 'How do guest wishes work?',        hi: 'Guest wishes कैसे काम करती है?', mz: 'Guest wishes engtin?' },
  { en: 'How do I change my album theme?',  hi: 'थीम कैसे बदलें?',               mz: 'Theme lo siam?' },
];

function ChatWidget({ user }) {
  const [open,       setOpen]       = useState(false);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [sessionId,  setSessionId]  = useState('');
  const [lang,       setLang]       = useState('en'); // 'en' | 'hi' | 'mz'
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateName,  setEscalateName]  = useState(user?.name || '');
  const [escalateEmail, setEscalateEmail] = useState(user?.email || '');
  const [escalateMsg,   setEscalateMsg]   = useState('');
  const [escalateSent,  setEscalateSent]  = useState(false);
  const [escalating,    setEscalating]    = useState(false);
  const [mounted,    setMounted]    = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const [token, setToken_] = useState(null);

  useEffect(() => {
    setMounted(true);
    // Restore session
    const sid = localStorage.getItem(SESSION_KEY) || `hr_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    localStorage.setItem(SESSION_KEY, sid);
    setSessionId(sid);
    // Read token safely after mount (never during SSR)
    setToken_(localStorage.getItem('mqr_token'));
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (Array.isArray(h) && h.length) setMessages(h);
    } catch {}
  }, []);

  useEffect(() => {
    if (messages.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-30)));
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: msg, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await fetch(`${CHAT_API}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: msg,
          sessionId,
          history: messages.slice(-10),
          saveConversation: !!token,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Server error ${res.status}`);
      if (d.language) setLang(d.language === 'mizo' ? 'mz' : d.language === 'hindi' ? 'hi' : 'en');
      setMessages(prev => [...prev, { role: 'assistant', content: d.reply, ts: new Date().toISOString() }]);
    } catch (err) {
      const errMsg = err.message || 'Unknown error';
      // Show the actual server error message so user knows what's happening
      const display = errMsg.includes('busy') || errMsg.includes('429')
        ? '⏳ Chat is busy right now. Please wait a moment and try again.'
        : errMsg.includes('unavailable') || errMsg.includes('503')
        ? '⚠️ Chat is temporarily unavailable. Please try again shortly.'
        : errMsg.includes('configured')
        ? '⚠️ Chat is not set up yet. Please email support@hriatrengna.in for help.'
        : `⚠️ ${errMsg}`;
      setMessages(prev => [...prev, { role: 'assistant', content: display, ts: new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  const doEscalate = async () => {
    if (!escalateMsg.trim()) return;
    setEscalating(true);
    try {
      const res = await fetch(`${CHAT_API}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: escalateName, email: escalateEmail, message: escalateMsg, sessionId, history: messages.slice(-6) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send support request.');
      setEscalateSent(true);
    } catch (err) { alert(err.message || 'Failed to send. Please email support@hriatrengna.in directly.'); }
    finally { setEscalating(false); }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
    const sid = `hr_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    localStorage.setItem(SESSION_KEY, sid);
    setSessionId(sid);
    setShowEscalate(false);
    setEscalateSent(false);
  };

  const LABELS = {
    title:     { en: 'Hriatrengna Support', hi: 'Hriatrengna सहायता', mz: 'Hriatrengna Thawk Dan' },
    subtitle:  { en: 'Ask anything about the app', hi: 'ऐप के बारे में कुछ भी पूछें', mz: 'App chanchin zawt rawh' },
    placeholder: { en: 'Type a message…', hi: 'संदेश लिखें…', mz: 'Ziak rawh…' },
    contact:   { en: '✉ Talk to a human', hi: '✉ मानव से बात करें', mz: '✉ Mipuite nen sawi' },
    clear:     { en: 'Clear chat', hi: 'चैट साफ करें', mz: 'Chat lo chhut' },
    thinking:  { en: 'Thinking…', hi: 'सोच रहा हूं…', mz: 'A ngaihtuah mek…' },
    suggest:   { en: 'Suggested questions:', hi: 'सुझाए गए प्रश्न:', mz: 'Zawt theih te:' },
  };
  const L = (key) => LABELS[key]?.[lang] || LABELS[key]?.en || '';

  const CSS_WIDGET = `
    .chat-fab { position:fixed; bottom:2rem; right:2rem; z-index:9000;
      width:56px; height:56px; border-radius:50%; background:#C9A84C; color:#111;
      border:none; cursor:pointer; font-size:1.5rem; display:flex; align-items:center;
      justify-content:center; box-shadow:0 4px 20px rgba(201,168,76,0.45);
      transition:transform 0.2s; }
    .chat-fab:hover { transform:scale(1.08); }
    .chat-fab-badge { position:absolute; top:-4px; right:-4px; background:#ef4444; color:white;
      border-radius:50%; width:18px; height:18px; font-size:0.65rem; font-weight:700;
      display:flex; align-items:center; justify-content:center; border:2px solid white; }
    .chat-window { position:fixed; bottom:5.5rem; right:2rem; z-index:9000;
      width:360px; max-width:calc(100vw - 2rem); height:520px; max-height:calc(100vh - 8rem);
      background:#fff; border-radius:20px; box-shadow:0 8px 40px rgba(0,0,0,0.18);
      display:flex; flex-direction:column; overflow:hidden;
      animation:chatSlideIn 0.2s ease; }
    @keyframes chatSlideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
    .chat-header { background:#1a1a1a; color:white; padding:1rem 1.1rem 0.85rem;
      display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
    .chat-header-info { display:flex; align-items:center; gap:0.6rem; }
    .chat-avatar { width:36px; height:36px; border-radius:50%; background:#C9A84C;
      display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0; }
    .chat-title { font-size:0.88rem; font-weight:600; }
    .chat-sub { font-size:0.72rem; color:rgba(255,255,255,0.5); margin-top:0.1rem; }
    .chat-header-btns { display:flex; align-items:center; gap:0.4rem; }
    .chat-hbtn { background:rgba(255,255,255,0.08); border:none; color:rgba(255,255,255,0.6);
      border-radius:6px; padding:0.3rem 0.5rem; font-size:0.7rem; cursor:pointer; }
    .chat-hbtn:hover { background:rgba(255,255,255,0.15); color:white; }
    .chat-close { background:none; border:none; color:rgba(255,255,255,0.5); font-size:1.1rem; cursor:pointer; padding:0.1rem; }
    .chat-close:hover { color:white; }
    .chat-lang { display:flex; gap:0.3rem; padding:0.5rem 1rem; background:#f8f7f5; border-bottom:1px solid #eee; flex-shrink:0; }
    .chat-lang button { border:1.5px solid #ddd; border-radius:100px; padding:0.2rem 0.7rem;
      font-size:0.72rem; font-weight:600; cursor:pointer; background:white; color:#666; }
    .chat-lang button.active { background:#1a1a1a; color:white; border-color:#1a1a1a; }
    .chat-messages { flex:1; overflow-y:auto; padding:1rem; display:flex; flex-direction:column; gap:0.6rem; }
    .chat-bubble { max-width:82%; padding:0.65rem 0.9rem; border-radius:14px; font-size:0.86rem; line-height:1.55; }
    .chat-bubble.user { background:#1a1a1a; color:white; border-radius:14px 14px 4px 14px; align-self:flex-end; }
    .chat-bubble.bot  { background:#f1f0ee; color:#1a1a1a; border-radius:14px 14px 14px 4px; align-self:flex-start; }
    .chat-bubble.bot pre, .chat-bubble.bot code { white-space:pre-wrap; font-size:0.82rem; }
    .chat-thinking { display:flex; gap:4px; align-items:center; align-self:flex-start; padding:0.65rem 1rem; background:#f1f0ee; border-radius:14px 14px 14px 4px; }
    .chat-thinking span { width:7px; height:7px; background:#aaa; border-radius:50%; animation:chatDot 1.2s infinite; }
    .chat-thinking span:nth-child(2) { animation-delay:0.2s; }
    .chat-thinking span:nth-child(3) { animation-delay:0.4s; }
    @keyframes chatDot { 0%,80%,100%{transform:scale(0.7);opacity:0.5} 40%{transform:scale(1);opacity:1} }
    .chat-suggestions { padding:0.5rem 1rem; border-top:1px solid #eee; flex-shrink:0; }
    .chat-suggestions p { font-size:0.7rem; color:#999; margin-bottom:0.4rem; }
    .chat-suggestions button { display:block; width:100%; text-align:left; background:#f8f7f5; border:1px solid #e5e5e5;
      border-radius:8px; padding:0.4rem 0.7rem; font-size:0.78rem; cursor:pointer; margin-bottom:0.3rem; color:#444; }
    .chat-suggestions button:hover { background:#f0ede8; border-color:#C9A84C; color:#1a1a1a; }
    .chat-input-row { display:flex; gap:0.5rem; padding:0.7rem 0.8rem; border-top:1px solid #eee; flex-shrink:0; }
    .chat-input { flex:1; border:1.5px solid #e5e5e5; border-radius:10px; padding:0.55rem 0.8rem;
      font-size:0.88rem; outline:none; resize:none; font-family:inherit; background:#fafafa; }
    .chat-input:focus { border-color:#C9A84C; background:white; }
    .chat-send { background:#C9A84C; color:#111; border:none; border-radius:10px; padding:0.55rem 0.9rem;
      font-weight:700; font-size:0.9rem; cursor:pointer; flex-shrink:0; }
    .chat-send:disabled { opacity:0.4; cursor:not-allowed; }
    .chat-escalate-form { padding:1rem; border-top:1px solid #eee; flex-shrink:0; background:#fafafa; }
    .chat-escalate-form h4 { font-size:0.85rem; font-weight:600; margin-bottom:0.75rem; color:#1a1a1a; }
    .chat-escalate-form input, .chat-escalate-form textarea { width:100%; border:1.5px solid #e5e5e5;
      border-radius:8px; padding:0.5rem 0.75rem; font-size:0.82rem; font-family:inherit; outline:none;
      margin-bottom:0.5rem; background:white; }
    .chat-escalate-form input:focus, .chat-escalate-form textarea:focus { border-color:#C9A84C; }
    .chat-escalate-form button { background:#1a1a1a; color:white; border:none; border-radius:8px;
      padding:0.55rem 1rem; font-size:0.82rem; font-weight:600; cursor:pointer; width:100%; }
    @media (max-width:420px) {
      .chat-window { right:0.75rem; bottom:4.5rem; width:calc(100vw - 1.5rem); }
      .chat-fab { bottom:1.2rem; right:1.2rem; }
    }
  `;

  if (!mounted) return null;

  return (
    <>
      <style>{CSS_WIDGET}</style>

      {/* Floating button */}
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Open chat support">
          💬
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="chat-window" role="dialog" aria-label="Chat support">

          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">✦</div>
              <div>
                <div className="chat-title">{L('title')}</div>
                <div className="chat-sub">● Online</div>
              </div>
            </div>
            <div className="chat-header-btns">
              <button className="chat-hbtn" onClick={clearChat} title={L('clear')}>{L('clear')}</button>
              <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
            </div>
          </div>

          {/* Language selector */}
          <div className="chat-lang">
            {[{id:'en',label:'English'},{id:'hi',label:'हिंदी'},{id:'mz',label:'Mizo'}].map(l => (
              <button key={l.id} className={lang===l.id?'active':''} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div style={{textAlign:'center',color:'#999',fontSize:'0.82rem',padding:'1rem 0'}}>
                <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>✦</div>
                <div style={{fontWeight:600,color:'#1a1a1a',marginBottom:'0.3rem'}}>{L('title')}</div>
                <div style={{fontSize:'0.78rem'}}>{L('subtitle')}</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role === 'user' ? 'user' : 'bot'}`}
                style={{whiteSpace:'pre-wrap'}}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="chat-thinking">
                <span/><span/><span/>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when no messages) */}
          {messages.length === 0 && !showEscalate && (
            <div className="chat-suggestions">
              <p>{L('suggest')}</p>
              {SUGGESTED.slice(0,3).map((s,i) => (
                <button key={i} onClick={() => send(s[lang] || s.en)}>{s[lang] || s.en}</button>
              ))}
            </div>
          )}

          {/* Escalate form */}
          {showEscalate && (
            <div className="chat-escalate-form">
              {escalateSent ? (
                <div style={{textAlign:'center',color:'#16a34a',fontSize:'0.84rem',padding:'0.5rem 0'}}>
                  ✓ {lang==='hi' ? 'संदेश भेज दिया गया!' : lang==='mz' ? 'A thawn tawh!' : 'Message sent! We\'ll reply soon.'}
                </div>
              ) : (
                <>
                  <h4>
                    {lang==='hi' ? '✉ मानव सहायता से संपर्क करें' : lang==='mz' ? '✉ Mipui nen contact' : '✉ Contact human support'}
                  </h4>
                  <input placeholder={lang==='hi'?'आपका नाम':lang==='mz'?'I hming':'Your name'} value={escalateName} onChange={e=>setEscalateName(e.target.value)} />
                  <input placeholder={lang==='hi'?'ईमेल':lang==='mz'?'Email':'Email (optional)'} value={escalateEmail} onChange={e=>setEscalateEmail(e.target.value)} type="email" />
                  <textarea rows={3} placeholder={lang==='hi'?'आपका संदेश…':lang==='mz'?'I thupui…':'Describe your issue…'} value={escalateMsg} onChange={e=>setEscalateMsg(e.target.value)} />
                  <button onClick={doEscalate} disabled={escalating||!escalateMsg.trim()}>
                    {escalating ? '…' : lang==='hi'?'भेजें':lang==='mz'?'Thawn rawh':'Send Message'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Input row */}
          {!showEscalate && (
            <div className="chat-input-row">
              <input
                ref={inputRef}
                className="chat-input"
                placeholder={L('placeholder')}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                disabled={loading}
                maxLength={2000}
              />
              <button className="chat-send" onClick={() => send()} disabled={!input.trim()||loading}>
                ↑
              </button>
            </div>
          )}

          {/* Escalate toggle */}
          <div style={{textAlign:'center',padding:'0.4rem',borderTop:'1px solid #eee',background:'#fafafa'}}>
            <button onClick={() => setShowEscalate(v=>!v)}
              style={{background:'none',border:'none',fontSize:'0.75rem',color:'#999',cursor:'pointer'}}>
              {showEscalate
                ? (lang==='hi'?'← वापस जाएं':lang==='mz'?'← Lo kal':'← Back to chat')
                : L('contact')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;
