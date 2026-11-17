import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Wallet, Users, ShoppingBasket, Volume2, MessageCircle, Plus, Trash2, RotateCcw, Coffee, Sparkles, Download, Search, TrendingUp, AlertTriangle } from 'lucide-react';
import { parseAll, type Pending } from './parse';

type Language = 'en-IN' | 'hi-IN' | 'te-IN';
type Entry = { id: string; customer: string; amount: number; type: 'credit' | 'payment'; note: string; createdAt: string; batch?: string };
type Purchase = { id: string; item: string; done: boolean; batch?: string };
const KEY = 'chaisaathi-local-v2';
const UI: Record<Language, { mic: string; listen: string; ph: string; ex: string[]; save: string; no: string; undo: string; sum: string; tabs: string[] }> = {
  'te-IN': { mic: 'మాట్లాడండి', listen: 'వింటున్నా…', ph: 'ఉదా: రమేష్ కి 50 రూపాయలు బాకీ', ex: ['రమేష్ కి 50 రూపాయలు బాకీ', 'రమేష్ 20 రూపాయలు ఇచ్చాడు', 'రేపు 20 పాల ప్యాకెట్లు తెప్పించు'], save: 'సేవ్', no: 'కాదు', undo: 'తప్పు', sum: 'ఈ రోజు లెక్క', tabs: ['లెక్క', 'కస్టమర్లు', 'సామాను'] },
  'hi-IN': { mic: 'बोलिए', listen: 'सुन रहा हूँ…', ph: 'जैसे: रमेश को 50 रुपये उधार', ex: ['रमेश को 50 रुपये उधार', 'रमेश ने 20 रुपये दिए', 'कल 20 पैकेट दूध मंगवाओ'], save: 'सेव', no: 'नहीं', undo: 'गलती', sum: 'आज का हिसाब', tabs: ['हिसाब', 'ग्राहक', 'सामान'] },
  'en-IN': { mic: 'Tap to speak', listen: 'Listening…', ph: 'e.g. Add 50 rupees credit for Ramesh', ex: ['Add 50 rupees credit for Ramesh', 'Ramesh paid 20 rupees', 'Order 20 packets of milk'], save: 'Save', no: 'No', undo: 'Undo', sum: 'Today’s summary', tabs: ['Overview', 'Customers', 'Purchases'] },
};
const money = (n: number) => '₹' + n.toLocaleString('en-IN');
const uid = () => Math.random().toString(36).slice(2, 10);
const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
const affirmative = /(?<![\p{L}\p{M}])(yes|yeah|yep|confirm|correct|ok|okay|haan|han|ha|हाँ|हां|जी|ठीक है|ठीक|सही|avunu|avunandi|అవును|ఔను|అవునండి|సరే|సరేనండి|ఓకే|అలాగే|సేవ్|చేయి|చెయ్యి)(?![\p{L}\p{M}])/iu;
const negative = /(?<![\p{L}\p{M}])(no|nope|cancel|stop|nahi|nahin|नहीं|नही|मत|kaadu|vaddu|కాదు|వద్దు|వద్దండి|లేదు|రద్దు)(?![\p{L}\p{M}])/iu;

function speak(text: string, lang: Language): Promise<void> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.92;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function confirmationText(ps: Pending[], lang: Language) {
  const part = (p: Pending) => p.type === 'order'
    ? (lang === 'hi-IN' ? `कल मंगवाना: ${p.item}` : lang === 'te-IN' ? `రేపు కొనాలి: ${p.item}` : `order tomorrow: ${p.item}`)
    : lang === 'te-IN' ? `${p.customer} కు ${p.amount} రూపాయలు ${p.type === 'credit' ? 'బాకీ' : 'చెల్లింపు'}`
    : lang === 'hi-IN' ? `${p.customer} के ${p.amount} रुपये ${p.type === 'credit' ? 'उधार' : 'जमा'}`
    : `${p.customer}, ${p.amount} rupees, ${p.type === 'credit' ? 'credit' : 'payment received'}`;
  const tail = lang === 'te-IN' ? 'సేవ్ చేయాలంటే అవును చెప్పండి.' : lang === 'hi-IN' ? 'सेव करने के लिए हाँ कहें।' : 'Say yes to save, or no to cancel.';
  return ps.map(part).join('. ') + '. ' + tail;
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}').entries || []; } catch { return []; } });
  const [purchases, setPurchases] = useState<Purchase[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}').purchases || []; } catch { return []; } });
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [listening, setListening] = useState(false);
  const [confirmListening, setConfirmListening] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready when you are');
  const [language, setLanguage] = useState<Language>('hi-IN');
  const [tab, setTab] = useState<'home'|'customers'|'purchases'>('home');
  const [newItem, setNewItem] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const recognitionRef = useRef<any>(null);
  const pendingRef = useRef<Pending[]|null>(null);
  const langRef = useRef<Language>(language);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify({ entries, purchases })); }, [entries, purchases]);
  useEffect(() => { langRef.current = language; }, [language]);
  useEffect(() => () => { recognitionRef.current?.abort?.(); window.speechSynthesis?.cancel?.(); }, []);

  const customers = useMemo(() => Array.from(new Set(entries.map(e => e.customer))), [entries]);
  const balance = (name: string) => entries.filter(e => e.customer.toLowerCase() === name.toLowerCase()).reduce((s,e) => s + (e.type === 'credit' ? e.amount : -e.amount), 0);
  const totalOwed = customers.reduce((s,n) => s + Math.max(0,balance(n)), 0);
  // Apply payments to the oldest credit first (FIFO) so overdue labels reflect unpaid dues, not already-settled entries.
  const daysOwed = (name: string) => {
    const ledger = entries.filter(e => e.customer.toLowerCase() === name.toLowerCase()).sort((a,b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    const credits = ledger.filter(e => e.type === 'credit').map(e => ({ amount: e.amount, time: +new Date(e.createdAt) }));
    let paid = ledger.filter(e => e.type === 'payment').reduce((sum,e) => sum + e.amount, 0);
    for (const credit of credits) { const used = Math.min(credit.amount, paid); credit.amount -= used; paid -= used; }
    const oldestOpen = credits.find(c => c.amount > 0);
    return oldestOpen ? Math.floor((Date.now() - oldestOpen.time) / 864e5) : 0;
  };
  const overdueCustomers = customers.filter(n => balance(n) > 0 && daysOwed(n) >= 7);
  const pendingPurchases = purchases.filter(p => !p.done).length;
  const topOwedCustomer = [...customers].filter(n => balance(n) > 0).sort((a,b) => balance(b)-balance(a))[0];
  const today = entries.filter(e => new Date(e.createdAt).toDateString() === new Date().toDateString());
  const todayCredit = today.filter(e => e.type === 'credit').reduce((s,e) => s + e.amount, 0);
  const todayPaid = today.filter(e => e.type === 'payment').reduce((s,e) => s + e.amount, 0);

  function getRecognition() {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }
  function startRecognition(mode: 'command'|'confirm') {
    const SR = getRecognition();
    if (!SR) { setError('Voice recognition is not available in this browser. Please use Chrome or type instead.'); setListening(false); setConfirmListening(false); return; }
    try {
      recognitionRef.current?.abort?.();
      const rec = new SR();
      rec.lang = langRef.current;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => { if (mode === 'command') setListening(true); else setConfirmListening(true); };
      rec.onend = () => { setListening(false); setConfirmListening(false); };
      rec.onerror = (event: any) => {
        setListening(false); setConfirmListening(false);
        if (event?.error === 'no-speech') setStatus('Could not hear you — tap the mic and try again');
        if (event?.error !== 'no-speech' && event?.error !== 'aborted') setError('Microphone issue. Check browser permission, or type your response.');
      };
      rec.onresult = (event: any) => {
        const heard = event.results?.[0]?.[0]?.transcript || '';
        if (mode === 'command') {
          setInput(heard);
          const parsed = parseAll(heard, langRef.current);
          if (!parsed.length) { setError('I could not identify both the customer and amount. Try a shorter sentence or type it below.'); setStatus('Could not understand that command'); return; }
          pendingRef.current = parsed;
          setPending(parsed);
          setError('');
          setStatus('Please confirm by speaking');
          void speak(confirmationText(parsed, langRef.current), langRef.current).then(() => {
            // Automatically listen for spoken confirmation after the prompt finishes.
            window.setTimeout(() => startRecognition('confirm'), 350);
          });
        } else {
          handleConfirmation(heard);
        }
      };
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setError('Could not start the microphone. Please allow microphone access and try again.');
      setListening(false); setConfirmListening(false);
    }
  }
  function handleConfirmation(heard: string) {
    if (affirmative.test(heard)) { commitEntry(); return; }
    if (negative.test(heard)) {
      pendingRef.current = null; setPending(null); setStatus('Entry cancelled'); setError('');
      void speak(langRef.current === 'te-IN' ? 'సరే. రద్దు చేశాను.' : langRef.current === 'hi-IN' ? 'ठीक है, रद्द कर दिया।' : 'Okay, cancelled.', langRef.current);
      return;
    }
    setStatus('Please say yes or no');
    setError(`I heard “${heard}”. Please clearly say Yes / Haan / Avunu, or No / Nahi / Kaadu.`);
    void speak(langRef.current === 'te-IN' ? 'దయచేసి అవును లేదా కాదు అని చెప్పండి.' : langRef.current === 'hi-IN' ? 'कृपया हाँ या नहीं कहें।' : 'Please say yes or no.', langRef.current).then(() => {
      window.setTimeout(() => startRecognition('confirm'), 350);
    });
  }
  function submitCommand(text = input) {
    setError('');
    const parsed = parseAll(text, language);
    if (!parsed.length) { setError('I could not identify both the customer and amount. Example: Ramesh ko 50 rupaye udhaar.'); return; }
    pendingRef.current = parsed; setPending(parsed); setStatus('Please confirm by speaking');
    void speak(confirmationText(parsed, language), language).then(() => window.setTimeout(() => startRecognition('confirm'), 350));
  }
  function startVoice() { setError(''); setStatus('Listening for your transaction'); startRecognition('command'); }
  function cancelPending() { recognitionRef.current?.abort?.(); window.speechSynthesis?.cancel?.(); pendingRef.current = null; setPending(null); setStatus('Entry cancelled'); setError(''); }
  function commitEntry() {
    const ps = pendingRef.current || pending; if (!ps) return;
    recognitionRef.current?.abort?.(); window.speechSynthesis?.cancel?.();
    const t = new Date().toISOString();
    setEntries(prev => [...prev, ...ps.filter(p => p.type !== 'order').map(p => ({ customer: p.customer, amount: p.amount, type: p.type as 'credit' | 'payment', note: p.note, id: uid(), createdAt: t, batch: t }))]);
    setPurchases(prev => [...prev, ...ps.filter(p => p.type === 'order').map(p => ({ id: uid(), item: p.item || '', done: false, batch: t }))]);
    pendingRef.current = null; setPending(null); setInput(''); setError(''); setStatus('Entry saved');
    void speak(language === 'te-IN' ? 'సేవ్ అయింది.' : language === 'hi-IN' ? 'सेव हो गया।' : 'Saved.', language);
  }
  function undo() {
    const last = [...entries.map(e => e.batch), ...purchases.map(p => p.batch)].filter(Boolean).sort().pop();
    if (!last) { setStatus('Nothing to undo'); return; }
    setEntries(v => v.filter(e => e.batch !== last)); setPurchases(v => v.filter(p => p.batch !== last)); setStatus('Last entry removed');
  }
  function seedDemo() {
    const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
    setEntries(v => [...v, ...[['Ramesh', 340, 12], ['Suresh', 120, 3], ['Geeta', 60, 1]].map(([c, a, d]) => ({ id: uid(), customer: c as string, amount: a as number, type: 'credit' as const, note: 'demo', createdAt: ago(d as number) }))]);
    setPurchases(v => [...v, { id: uid(), item: '20 packet doodh', done: false }]);
  }
  function speakSummary() {
    const top = [...customers].sort((a, b) => balance(b) - balance(a))[0];
    const late = customers.filter(n => balance(n) > 0 && daysOwed(n) >= 7);
    const pend = purchases.filter(p => !p.done).length;
    const teText = `మొత్తం బాకీ ${totalOwed} రూపాయలు.${top ? ` ఎక్కువ ${top}, ${balance(top)} రూపాయలు.` : ''}${late.length ? ` ${late.join(', ')} బాకీ వారం కంటే పాతది.` : ''} ${pend} వస్తువులు కొనాలి.`;
    const t = language === 'hi-IN'
      ? `कुल बाकी ${totalOwed} रुपये।${top ? ` सबसे ज़्यादा ${top}, ${balance(top)} रुपये।` : ''}${late.length ? ` ${late.join(', ')} का उधार एक हफ्ते से पुराना है।` : ''} ${pend} चीज़ें मंगवानी हैं।`
      : `Total outstanding ${totalOwed} rupees.${top ? ` Highest: ${top}, ${balance(top)} rupees.` : ''}${late.length ? ` Overdue over a week: ${late.join(', ')}.` : ''} ${pend} items to buy.`;
    void speak(language === 'te-IN' ? teText : t, language);
  }
  function addPurchase() { if (!newItem.trim()) return; setPurchases(p => [...p,{id:uid(),item:clean(newItem),done:false}]); setNewItem(''); }
  function exportLedger() {
    const rows = [['Date','Customer','Type','Amount (INR)','Note'], ...entries.map(e => [new Date(e.createdAt).toLocaleString('en-IN'), e.customer, e.type, e.amount, e.note])];
    const csv = rows.map(row => row.map(value => `\"${String(value ?? '').replace(/\"/g,'\"\"')}\"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `chaisaathi-khata-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function reminder(name: string) {
    const due = Math.max(0, balance(name));
    const msg = language === 'hi-IN'
      ? `Namaste ${name} ji, aapka ${money(due)} baaki hai. Jab ho sake, kripya chuka dijiye. Dhanyavaad!`
      : language === 'te-IN'
        ? `నమస్కారం ${name} గారు, మీ ఖాతాలో ${money(due)} బాకీ ఉంది. వీలైనప్పుడు చెల్లించండి. ధన్యవాదాలు!`
        : `Hello ${name}, your khata balance is ${money(due)}. Please pay when convenient. Thank you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  }

  const languageLabel = language === 'te-IN' ? 'Telugu' : language === 'hi-IN' ? 'Hindi / Hinglish' : 'English';

  return <div className="app">
    <header><div className="brand"><div className="logo"><Coffee size={23}/></div><div><div className="brandname">ChaiSaathi <span>AI</span></div><div className="tagline">A smarter khata for your shop</div></div></div><div className="local-pill"><span/> Saved in this browser</div></header>
    <main>
      <section className="hero"><div><div className="eyebrow"><Sparkles size={14}/> VOICE-FIRST KHATA</div><h1>Just speak.<br/><em>Khata handled.</em></h1><p>Track credit, payments and tomorrow’s supplies — hands-free.</p></div><div className="hero-cup">☕</div></section>
      <div className="langs">{(['te-IN','hi-IN','en-IN'] as Language[]).map(l=><button key={l} className={language===l?'active':''} onClick={()=>{setLanguage(l);setError('');setStatus('Ready when you are')}}>{l==='te-IN'?'తెలుగు':l==='hi-IN'?'हिन्दी':'English'}</button>)}</div>
      <section className="voice-card">
        <div className="voice-top"><div><div className="section-kicker">QUICK ENTRY</div><h2>What happened today?</h2></div>
          
        </div>
        <button className={`mic ${listening?'listening':''}`} onClick={startVoice}><span className="mic-ring"><Mic size={29}/></span><b>{listening?UI[language].listen:UI[language].mic}</b><small>{languageLabel} voice input</small></button>
        <div className="status-line">{confirmListening ? 'Listening for your yes or no…' : status}</div>
        <div className="or"><span/> OR TYPE YOUR COMMAND <span/></div>
        <div className="input-row"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitCommand()} placeholder={UI[language].ph}/><button className="send" onClick={()=>submitCommand()} aria-label="Submit command"><Plus size={20}/></button></div>
        <div className="examples"><span>Try:</span>{UI[language].ex.map(x=><button key={x} onClick={()=>{setInput(x);submitCommand(x)}}>{x}</button>)}</div>
        {error&&<div className="error">{error}</div>}
      </section>
      <section className="stats"><div className="stat"><span>Total outstanding</span><strong>{money(totalOwed)}</strong><small><Wallet size={13}/> Customer balances</small></div><div className="stat"><span>Credit today</span><strong>{money(todayCredit)}</strong><small>New credit entries</small></div><div className="stat"><span>Payments today</span><strong>{money(todayPaid)}</strong><small>Money received</small></div></section>
      <div className="actions"><button onClick={undo}>↩ {UI[language].undo}</button><button onClick={speakSummary}>🔊 {UI[language].sum}</button><button onClick={exportLedger}><Download size={15}/> Export khata</button><button onClick={seedDemo}>Demo data</button></div>
      {tab==='home'&&<section className="insights"><div className="insights-heading"><div><div className="section-kicker">YOUR SHOP AT A GLANCE</div><h2>Today’s shop pulse</h2></div><span className="insight-mark"><TrendingUp size={19}/></span></div><div className="insight-grid"><div className="insight-cell"><span>Customers with dues</span><b>{customers.filter(n=>balance(n)>0).length}</b><small>Active khata balances</small></div><div className="insight-cell"><span>Overdue 7+ days</span><b>{overdueCustomers.length}</b><small>{money(overdueCustomers.reduce((sum,n)=>sum+balance(n),0))} to follow up</small></div><div className="insight-cell"><span>To buy tomorrow</span><b>{pendingPurchases}</b><small>Items on your checklist</small></div></div>{topOwedCustomer?<div className="insight-tip"><AlertTriangle size={16}/><span><b>{topOwedCustomer}</b> has the highest outstanding balance at <b>{money(balance(topOwedCustomer))}</b>.</span></div>:<div className="insight-tip positive"><Sparkles size={16}/><span>No customer dues yet. Your khata is all clear.</span></div>}</section>}
      <nav className="tabs"><button className={tab==='home'?'active':''} onClick={()=>setTab('home')}><Wallet size={16}/> {UI[language].tabs[0]}</button><button className={tab==='customers'?'active':''} onClick={()=>setTab('customers')}><Users size={16}/> {UI[language].tabs[1]}</button><button className={tab==='purchases'?'active':''} onClick={()=>setTab('purchases')}><ShoppingBasket size={16}/> {UI[language].tabs[2]}</button></nav>
      {tab==='home'&&customers.some(n=>balance(n)>0&&daysOwed(n)>=7)&&<section className="collect"><div className="section-kicker">COLLECT TODAY · आज वसूली</div>{customers.filter(n=>balance(n)>0&&daysOwed(n)>=7).sort((a,b)=>daysOwed(b)-daysOwed(a)).map(n=><div className="collect-row" key={n}><div><b>{n}</b><small>{daysOwed(n)} days overdue</small></div><strong>{money(balance(n))}</strong><button className="wa" onClick={()=>reminder(n)} aria-label={'Remind '+n}><MessageCircle size={20}/></button></div>)}</section>}
      {tab==='home'&&<section className="panel"><div className="panel-head"><div><div className="section-kicker">RECENT ACTIVITY</div><h2>Khata entries</h2></div><span className="count">{entries.length} entries</span></div>{entries.length===0?<div className="empty"><div>📒</div><b>Your khata is ready</b><p>Speak your first transaction above.</p></div>:<div className="entry-list">{[...entries].reverse().slice(0,12).map(e=><div className="entry" key={e.id}><div className={`entry-icon ${e.type}`}>{e.type==='credit'?'↗':'↙'}</div><div className="entry-info"><b>{e.customer}</b><small>{e.type==='credit'?'Credit':'Payment'} · {new Date(e.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div><strong className={e.type==='credit'?'red':'green'}>{e.type==='credit'?'+':'−'}{money(e.amount)}</strong></div>)}</div>}</section>}
      {tab==='customers'&&<section className="panel"><div className="panel-head"><div><div className="section-kicker">CUSTOMER LEDGER</div><h2>Customer balances</h2></div><span className="count">{customers.length} customers</span></div>{customers.length===0?<div className="empty"><div>👥</div><b>No customers yet</b><p>Add your first customer with a voice transaction.</p></div>:<><div className="customer-search"><Search size={17}/><input value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Find a customer…" aria-label="Search customers"/><span>{customers.filter(n=>n.toLowerCase().includes(customerSearch.toLowerCase())).length} found</span></div>{customers.filter(n=>n.toLowerCase().includes(customerSearch.toLowerCase())).sort((a,b)=>balance(b)-balance(a)).map(n=><div className="customer" key={n}><div className="avatar">{n.slice(0,1).toUpperCase()}</div><div className="entry-info"><b>{n}</b><small className={balance(n) > 0 && daysOwed(n) >= 7 ? 'red' : ''}>{balance(n) > 0 ? `${daysOwed(n)} days${daysOwed(n) >= 7 ? ' · overdue ⚠️' : ''}` : 'Settled'}</small></div><strong>{money(balance(n))}</strong>{balance(n)>0&&<button className="wa" onClick={()=>reminder(n)} title="Open WhatsApp reminder"><MessageCircle size={17}/></button>}</div>)}</>}</section>}
      {tab==='purchases'&&<section className="panel"><div className="panel-head"><div><div className="section-kicker">TOMORROW’S PREP</div><h2>Purchase checklist</h2></div><span className="count">{purchases.filter(p=>!p.done).length} pending</span></div><div className="input-row purchase-input"><input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPurchase()} placeholder="Add milk, tea powder…"/><button className="send" onClick={addPurchase}><Plus size={20}/></button></div>{purchases.length===0?<div className="empty"><div>🛒</div><b>Nothing on the list yet</b><p>Add what you need for tomorrow.</p></div>:purchases.map(p=><div className="purchase" key={p.id}><label><input type="checkbox" checked={p.done} onChange={()=>setPurchases(v=>v.map(x=>x.id===p.id?{...x,done:!x.done}:x))}/><span className={p.done?'done':''}>{p.item}</span></label><button className="icon-btn" onClick={()=>setPurchases(v=>v.filter(x=>x.id!==p.id))}><Trash2 size={16}/></button></div>)}</section>}
      <footer><span>Made for chai shop owners, with ❤️</span><button onClick={()=>{if(window.confirm('Clear all locally stored khata and purchase data?')){setEntries([]);setPurchases([])}}}><RotateCcw size={13}/> Reset local data</button></footer>
    </main>
    {pending&&<div className="overlay"><div className="confirm-box"><div className="confirm-icon"><Volume2 size={23}/></div><div className="section-kicker">PLEASE CONFIRM</div><h2>Save this?</h2><p className="heard">“{pending.map(p=>p.note).join(' + ')}”</p><div className="confirm-list">{pending.map((p,i)=><div key={i} className="confirm-item">{p.type==='order'?<><span>🛒 Order tomorrow</span><b>{p.item}</b></>:<><span>{p.type==='credit'?'Credit':'Paid'} · {p.customer}</span><b className={p.type==='credit'?'red':'green'}>{money(p.amount)}</b></>}</div>)}</div><div className="confirm-actions"><button className="cancel" onClick={cancelPending}>✕ {UI[language].no}</button><button className="approve" onClick={commitEntry}>✓ {UI[language].save}</button></div><p className="confirm-note">{confirmListening?'Listening… say Yes / Haan / Avunu, or tap a button.':'You can also say yes or no.'}</p></div></div>}
  </div>;
}
