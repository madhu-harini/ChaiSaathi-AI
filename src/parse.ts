// One parser config per language, so fixing Hindi can never break Telugu or English.
export type Pending = { customer: string; amount: number; type: 'credit' | 'payment' | 'order'; item?: string; note: string };
export type Lang = 'te-IN' | 'hi-IN' | 'en-IN';

const norm = (s: string) => s
  .replace(/[\u200b-\u200d\ufeff]/g, '')
  .replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x966))
  .replace(/[౦-౯]/g, d => String(d.charCodeAt(0) - 0xc66));
const mk = (w: string) => Object.fromEntries(w.split(' ').map(p => { const [k, v] = p.split(':'); return [k, Number(v)]; }));
const TITLES = 'bhai|bhaiya|bhaiyya|ji|sahab|garu|anna|भाई|जी|గారు|అన్న';
const NAME = `([^\\s,]+(?:\\s+(?:${TITLES}))?)`;
const HON = new RegExp(`\\s+(${TITLES})$`, 'i');
const re = (s: string, f = 'i') => new RegExp(s, f);

type Cfg = { split: RegExp; order: RegExp; pay: RegExp; cur: RegExp; names: RegExp[]; filler: RegExp; words: Record<string, number>; hund: string[]; stripDo: RegExp };

const CFG: Record<Lang, Cfg> = {
  'hi-IN': {
    split: /\s*(?:,|\baur\b|\band\b|और)\s*/i,
    order: /mangwa|mangao|order|kharid|मंगवा|मंगा|खरीद/i,
    pay: /(\bne\b|ने).*(diya|diye|jama|wapas|chukaya|दिए|दिया|जमा|वापस|चुकाए)|paid|payment|received|jama|जमा/i,
    cur: /rupa|rupe|rupees|\brs\b|₹|रुपय|रुपए/i,
    names: [re(`^\\s*(?:add\\s+|note\\s+)?${NAME}\\s+(?:ko|ne|ka|ki|ke|को|ने|का|की|के)(?=\\s|$)`), re(`\\bfor\\s+${NAME}`)],
    filler: /\b(kal|tomorrow|mangwao|mangao|mangwana|order|karo|kar|do|de|likho|add|please)\b|कल|मंगवाओ|मंगाओ|करो|कर दो|खरीदो/gi,
    words: mk('ek:1 do:2 teen:3 char:4 chaar:4 paanch:5 panch:5 chhe:6 che:6 saat:7 aath:8 nau:9 das:10 gyarah:11 barah:12 pandrah:15 bees:20 pachees:25 tees:30 chalis:40 pachaas:50 pachas:50 sath:60 saath:60 sattar:70 assi:80 nabbe:90 sau:100 dedh:1.5 dhai:2.5 एक:1 दो:2 तीन:3 चार:4 पांच:5 पाँच:5 छह:6 सात:7 आठ:8 नौ:9 दस:10 ग्यारह:11 बारह:12 पंद्रह:15 बीस:20 पच्चीस:25 तीस:30 चालीस:40 पचास:50 साठ:60 सत्तर:70 अस्सी:80 नब्बे:90 सौ:100 डेढ़:1.5 ढाई:2.5'),
    hund: ['sau', 'सौ'],
    stripDo: /\b(likh|kar|de|dena)\s+do\b|(लिख|कर|दे|देना)\s+दो/g,
  },
  'en-IN': {
    split: /\s*(?:,|\band\b|\bthen\b|\balso\b)\s*/i,
    order: /\border\b|\bbuy\b|\bpurchase\b|\bneed\b/i,
    pay: /paid|payment|received|returned|repaid/i,
    cur: /rupee|rupees|\brs\b|₹|inr/i,
    names: [re(`\\bfor\\s+${NAME}`), re(`\\bfrom\\s+${NAME}`), re(`^\\s*${NAME}\\s+(?:paid|owes|gave|returned|took)\\b`)],
    filler: /\b(tomorrow|order|buy|purchase|please|add|need|for|to)\b/gi,
    words: mk('one:1 two:2 three:3 four:4 five:5 six:6 seven:7 eight:8 nine:9 ten:10 twenty:20 thirty:30 forty:40 fifty:50 sixty:60 seventy:70 eighty:80 ninety:90 hundred:100'),
    hund: ['hundred'],
    stripDo: /(?!)/g,
  },
  'te-IN': {
    split: /\s*(?:,|మరియు|ఇంకా)\s*/,
    order: /తెప్పి|కొను|ఆర్డర్|కావాలి|తీసుకురా/,
    pay: /చెల్లించ|ఇచ్చ|కట్ట|వచ్చ|జమ|వసూల|తిరిగి/,
    cur: /రూపా|₹|rs/i,
    names: [re(`^\\s*${NAME}\\s*(?:కి|కు|కీ|నుంచి|నుండి|దగ్గర|గారికి)(?=\\s|$)`, ''), re(`(?:^|\\s)([^\\s,]+)\\s*(?:కి|కు)(?=\\s|$)`, ''), re(`^\\s*${NAME}\\s+(?=\\d)`, ''), re(`^\\s*${NAME}(?=\\s)`, '')],
    filler: /రేపు|తెప్పించు|తెప్పించండి|కొనండి|కొను|ఆర్డర్|చేయి|చేయండి|కావాలి|తీసుకురా/g,
    words: mk('ఒకటి:1 రెండు:2 మూడు:3 నాలుగు:4 ఐదు:5 ఆరు:6 ఏడు:7 ఎనిమిది:8 తొమ్మిది:9 పది:10 ఇరవై:20 ముప్పై:30 నలభై:40 యాభై:50 అరవై:60 డెబ్బై:70 ఎనభై:80 తొంభై:90 వంద:100 వందలు:100 నూరు:100 నూట:100 అయిదు:5 పదిహేను:15 పాతిక:25 వెయ్యి:1000'),
    hund: ['వంద', 'వందలు', 'నూరు', 'నూట'],
    stripDo: /(?!)/g,
  },
};

function amount(t: string, c: Cfg): number {
  const s = t.toLowerCase().replace(c.stripDo, ' ');
  const m = s.match(/(\d+(?:\.\d+)?)\s*(\S+)?/);
  if (m) return Number(m[1]) * (c.hund.includes(m[2] || '') ? 100 : 1);
  let total = 0, part = 0;
  for (const w of s.split(/[\s,]+/)) {
    const v = c.words[w];
    if (v === undefined) continue;
    if (c.hund.includes(w)) { total += (part || 1) * 100; part = 0; } else part += v;
  }
  return total + part;
}

function nameOf(t: string, c: Cfg): string | null {
  for (const r of c.names) {
    const n = t.match(r)?.[1]?.replace(HON, '').trim();
    if (n && !/^\d/.test(n) && c.words[n.toLowerCase()] === undefined && !c.cur.test(n)) return n.replace(/^[a-z]/, ch => ch.toUpperCase());
  }
  return null;
}

export function parseAll(raw: string, lang: Lang = 'hi-IN'): Pending[] {
  const c = CFG[lang], out: Pending[] = [];
  for (const part of norm(raw).split(c.split)) {
    const t = part.trim();
    if (!t) continue;
    if (c.order.test(t)) {
      const item = t.replace(c.filler, ' ').replace(/\s+/g, ' ').trim();
      if (item) out.push({ type: 'order', customer: '', amount: 0, item, note: t });
      continue;
    }
    const amt = amount(t, c), name = nameOf(t, c);
    if (!name || !amt) continue;
    if (amt < 5 && !c.cur.test(t)) continue;
    out.push({ type: c.pay.test(t) ? 'payment' : 'credit', customer: name, amount: amt, note: t });
  }
  return out;
}
