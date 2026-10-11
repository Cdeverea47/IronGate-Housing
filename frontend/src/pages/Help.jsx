import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Button, Input } from '../components/UI.jsx';
import { FAQ } from '../data/faq.js';

const STOPWORDS = new Set([
  'how', 'do', 'i', 'a', 'an', 'the', 'to', 'my', 'is', 'it', 'for', 'of', 'on', 'in', 'and', 'or', 'can', 'what',
  'are', 'with', 'you', 'your', 'me', 'does', 'did', 'am', 'be', 'this', 'that', 'about',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

function scoreItem(queryTokens, item) {
  const itemTokens = new Set([
    ...tokenize(item.question),
    ...tokenize(item.answer),
    ...item.keywords.flatMap((k) => tokenize(k)),
  ]);
  let score = 0;
  for (const t of queryTokens) {
    if (itemTokens.has(t)) score++;
  }
  return score;
}

function findBestMatch(query, audience) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const item of FAQ) {
    if (item.audience !== 'both' && item.audience !== audience) continue;
    const s = scoreItem(queryTokens, item);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

function AccordionItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-white/90 hover:bg-white/5 transition-colors"
      >
        {item.question}
        <span className={`text-white/50 transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open ? <div className="px-4 pb-3.5 text-sm text-white/70">{item.answer}</div> : null}
    </div>
  );
}

export default function Help() {
  const { user } = useAuth();
  const audience = user?.role === 'tenant' ? 'tenant' : 'landlord';

  const items = useMemo(() => FAQ.filter((f) => f.audience === 'both' || f.audience === audience), [audience]);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text:
        "Hi! I'm the IronGate Housing help assistant — I search the FAQ below to answer your question. Try asking something like \"how do I pay rent\" or \"how do I enable two-factor authentication\".",
    },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  function handleSend(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    const match = findBestMatch(question, audience);
    const reply = match
      ? match.answer
      : "I couldn't find a good match for that in the FAQ. Try rephrasing, browse the full list below, or reach out to your landlord/tenant directly for anything account-specific.";
    setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: reply }]);
    setInput('');
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Help</h1>
        <p className="text-white/60 text-sm mt-1">Ask the help assistant or browse the FAQ</p>
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-medium text-white/80">Help assistant</h2>
        <p className="text-xs text-white/50">
          This searches the FAQ for the closest match to your question — it's not a general-purpose AI, so it works
          best with questions about using IronGate Housing.
        </p>
        <div ref={scrollRef} className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm ${
                  m.role === 'user' ? 'bg-white text-brand-700' : 'bg-white/10 text-white/90'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-white/10">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim()}>
            Send
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="text-lg font-medium text-white mb-3">Frequently asked questions</h2>
        <Card className="divide-y divide-white/10">
          {items.map((item) => (
            <AccordionItem key={item.id} item={item} />
          ))}
        </Card>
      </div>
    </div>
  );
}
