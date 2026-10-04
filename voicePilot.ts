/**
 * Voice Pilot for HACSM NSPIRE Practice.
 *
 * Bluetooth headset + voice control for the inspection screen, with no AI service:
 * a small local classifier matches what the inspector says against the 63 standards
 * and the deficiency buttons already on screen, then presses the same buttons a
 * finger would. Works offline except for the browser's own speech recognition.
 *
 *   Headset: 1 press = talk, 2 presses = next standard, 3 presses = where am I
 *   Say:     "smoke alarm missing", "unit", "next", "go to water heater",
 *            "comment battery removed by tenant", "undo", "options", "number 2"
 *
 * It only reads labels and presses buttons, so if the app's wording changes the
 * matching adapts. For long-term stability, add data-voice attributes (see README).
 */

import { HQS_ITEMS, HQS_PHRASES, translateHqs } from './hqsCrosswalk';

export type Say = (text: string) => void;

// ------------------------------------------------------------------ learning loop
/** One moment worth learning from. Phrases only: no names, addresses or photos. */
export interface LearnEvent {
  at: string; said: string; room: string; standard: string;
  outcome: 'unmatched' | 'ambiguous' | 'corrected' | 'jev';
  chosen?: string; area?: string;
}
/** A phrase a reviewer approved, mapped to a HUD deficiency (see tools/build_learned.py). */
export interface LearnedPhrase { phrase: string; standard: string; deficiency: string; n?: number }

const LEARN_KEY = 'voicepilot:learn';
const LEARN_SENT_KEY = 'voicepilot:learn-sent';
const LEARN_MAX = 500;
const redactPhrase = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\d{3,}/g, '#');

// ------------------------------------------------------------------ Jev (optional)
/** One Choice answer from Jev, TypeSafe's decision model, via your own server route. */
export interface JevChoice { choice: string; confidence: number; probabilities: Record<string, number> }
export interface JevAskRequest { said: string; room: string; standard?: string; question: string; options: Record<string, string> }
export type JevAsk = (req: JevAskRequest) => Promise<JevChoice | null>;

/**
 * Calls the app's /api/jev route, which holds the API key on the server.
 * Never put the Jev key in browser code: anyone who opens the app could copy it.
 * Returns null when offline or slow, and the pilot falls back to local matching.
 */
export function jevViaProxy(url = '/api/jev', timeoutMs = 2500): JevAsk {
  return async req => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) return null;
      const data = await r.json() as JevChoice;
      return typeof data?.choice === 'string' ? data : null;
    } catch {
      return null;
    }
  };
}

/** How sure Jev must be before the pilot presses a button on its say-so. */
const JEV_ACT = 0.55;
const JEV_MARGIN = 0.15;
const JEV_STANDARD_ACT = 0.5;

// ------------------------------------------------------------------ vocabulary
const STANDARD_ALIASES: Record<string, string[]> = {
  'smoke alarm': ['smoke detector', 'smoke detectors', 'smoke alarms', 'smoke'],
  'carbon monoxide': ['co alarm', 'co detector', 'carbon monoxide alarm', 'carbon monoxide detector'],
  'electrical - conductor, outlet, and switch': ['outlet', 'outlets', 'receptacle', 'light switch', 'switch', 'exposed wire', 'exposed wires', 'exposed wiring', 'cover plate'],
  'electrical - gfci/afci': ['gfci', 'gfi', 'afci', 'ground fault'],
  'electrical - service panel': ['breaker panel', 'electrical panel', 'breaker box', 'service panel', 'panel'],
  'cooking appliance': ['stove', 'range', 'oven', 'burner', 'burners', 'cooktop'],
  'refrigerator': ['fridge'],
  'bathtub and shower': ['bathtub', 'tub', 'shower'],
  'heating, ventilation, and air conditioning (hvac)': ['wall heater', 'heater', 'heating', 'furnace', 'hvac', 'air conditioner', 'no heat'],
  'water heater': ['water heater', 'hot water', 'tpr valve', 'relief valve'],
  'leak - gas/oil': ['gas leak', 'gas smell', 'smell gas', 'oil leak'],
  'leak - water': ['water leak', 'leak', 'leaking', 'drip', 'dripping'],
  'leak - sewage system': ['sewage', 'sewer'],
  'mold-like substance': ['mold', 'mildew'],
  'infestation': ['roaches', 'roach', 'cockroaches', 'mice', 'mouse', 'rats', 'rodents', 'bed bugs', 'pests', 'droppings'],
  'door - entry': ['front door', 'entry door', 'deadbolt'],
  'door - fire': ['fire door'],
  'steps and stairs': ['stairs', 'steps', 'stair'],
  'potential lead-based paint hazards - visual assessment': ['lead paint', 'peeling paint', 'chipping paint', 'deteriorated paint'],
  'trip hazard': ['trip hazard', 'tripping'],
  'egress': ['blocked exit', 'exit blocked', 'egress'],
  'fire extinguisher': ['extinguisher'],
  'wall - interior': ['interior wall', 'wall', 'walls'],
  'wall - exterior': ['exterior wall', 'siding'],
  'floor': ['floor', 'flooring', 'carpet'],
  'sink': ['sink', 'faucet'],
  'ventilation': ['exhaust fan', 'bathroom fan', 'vent fan'],
  'lighting - interior': ['light fixture', 'interior light'],
  'lighting - exterior': ['exterior light', 'porch light'],
  'flammable and combustible item': ['flammable', 'gas can'],
  'guardrail': ['guardrail', 'railing'],
  'clothes dryer exhaust ventilation': ['dryer vent', 'dryer exhaust'],
  'address and signage': ['address', 'address numbers', 'signage'],
  'cabinet and storage': ['cabinet', 'cabinets', 'cabinet door', 'drawer', 'drawers', 'countertop', 'shelf', 'shelves'],
  'toilet': ['toilet', 'commode'],
};

// HQS form items and HQS-era fail wording count as ways of naming NSPIRE standards.
for (const m of [...HQS_ITEMS, ...HQS_PHRASES]) {
  const key = m.standard.toLowerCase();
  STANDARD_ALIASES[key] = [...(STANDARD_ALIASES[key] ?? []), ...m.say];
}

// Spoken words -> extra words to look for in HUD deficiency wording.
const WORD_SYNONYMS: Record<string, string[]> = {
  missing: ['not', 'installed', 'missing', 'absent'],
  none: ['not', 'installed'],
  dead: ['not', 'produce', 'inoperable', 'function', 'functioning', 'energized'],
  inoperable: ['inoperable', 'not', 'function', 'produce', 'functioning'],
  working: ['function', 'functioning', 'operate', 'produce'],
  work: ['function', 'functioning', 'operate', 'produce'],
  broken: ['broken', 'damaged', 'inoperable'],
  damaged: ['damaged', 'broken'],
  blocked: ['obstructed', 'blocked'],
  covered: ['obstructed'],
  cracked: ['cracked', 'damaged', 'broken'],
  hole: ['hole', 'holes', 'damaged'],
  holes: ['hole', 'holes', 'damaged'],
  loose: ['loose', 'insecure', 'damaged'],
  leaking: ['leak', 'leaking'],
  peeling: ['peeling', 'deteriorated'],
  exposed: ['exposed'],
  stuck: ['open', 'close', 'inoperable'],
  no: ['missing', 'not'],
  "doesn't": ['not', 'does', 'inoperable'],
  "won't": ['not', 'will', 'inoperable'],
  "can't": ['cannot', 'not'],
  "isn't": ['not'],
  trip: ['test', 'reset', 'button', 'inoperable'],
  reset: ['test', 'reset', 'button', 'inoperable'],
  power: ['energized'],
  energized: ['energized'],
  ungrounded: ['properly', 'wired', 'grounded'],
  grounded: ['properly', 'grounded'],
  ground: ['grounded', 'properly'],
  polarity: ['properly', 'wired'],
  miswired: ['properly', 'wired'],
  unprotected: ['unprotected', 'water', 'source'],
  lock: ['secured', 'secure'],
  locks: ['secured', 'secure'],
  secure: ['secured', 'secure'],
  roach: ['cockroach', 'cockroaches'],
  roaches: ['cockroach', 'cockroaches'],
  cockroaches: ['cockroach', 'cockroaches'],
  mice: ['mice', 'mouse'],
  mouse: ['mice', 'mouse'],
  rats: ['rat', 'rats'],
  rat: ['rat', 'rats'],
  bedbugs: ['bedbugs'],
  bugs: ['bedbugs'],
  lots: ['extensive'],
  many: ['extensive'],
  heavy: ['extensive'],
  severe: ['extensive'],
  clogged: ['inoperable', 'draining', 'drain', 'not'],
  backed: ['draining', 'drain', 'inoperable'],
  wobbly: ['secured', 'loose'],
  wobbles: ['secured', 'loose'],
};

// Words that appear in many HUD descriptions and only weakly signal a match.
const WEAK = new Set(['not', 'will', 'does', 'cannot', 'no', 'is', 'or']);

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'in', 'on', 'of', 'and', 'or', 'to', 'it', 'its', 'this', 'that', 'there', 'at', 'for', 'with', 'by', 'be', 'has', 'have', 'was', 'when']);
const AREAS = ['unit', 'inside', 'outside'] as const;
type Area = typeof AREAS[number];

const SEVERITY_SHORT: Record<string, string> = { LT: 'life-threatening', S: 'severe', M: 'moderate', L: 'low' };

// Words that separate findings in one breath ("outlet dead and gfci doesn't trip").
const SEPARATORS = /\s*(?:,|;|\band also\b|\balso\b|\bplus\b|\band then\b|\bthen\b|\bnext one\b|\band\b)\s*/;

/**
 * Which HUD area a room most likely means. Private rooms of the assisted unit are Unit,
 * clearly exterior spaces are Outside. Shared or common rooms return null on purpose:
 * HUD's Inside area depends on the property, so the pilot asks instead of guessing.
 */
export function areaForRoomName(name: string): Area | null {
  const n = norm(name.replace(/\s*·.*$/, ''));
  if (!n || n.startsWith('unit building')) return null;
  if (/\b(shared|common|lobby|corridor|stairwell|mail|community|building)\b/.test(n)) return null;
  if (/\b(exterior|outside|yard|porch|patio|parking|roof|site|grounds|driveway|sidewalk)\b/.test(n)) return 'outside';
  return 'unit';
}

const SEVERITY: Record<string, string> = {
  LT: 'Life-threatening, 24 hours', S: 'Severe, 30 days', M: 'Moderate, 30 days', L: 'Low, recorded only',
};

const shorten = (s: string, n = 8) => s.split(' ').slice(0, n).join(' ');
const trimDot = (s: string) => s.replace(/[.\s]+$/, '');
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter(t => t && !STOP.has(t));
const hasPhrase = (text: string, phrase: string) => (' ' + norm(text) + ' ').includes(' ' + norm(phrase) + ' ');

// ------------------------------------------------------------------ screen access
interface Finding { button: HTMLButtonElement; area: Area; text: string; severity: string; recorded: boolean }

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function labeledControl<T extends HTMLElement>(pattern: RegExp): T | null {
  const label = [...document.querySelectorAll('label')].find(l => pattern.test(l.textContent ?? ''));
  return ((label as HTMLLabelElement | undefined)?.control ?? label?.querySelector('select,textarea,input') ?? null) as T | null;
}

function setNativeValue(el: HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

function buttonByText(text: string): HTMLButtonElement | null {
  return [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text) ?? null;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** False when a HUD option is tied to an inspection-date window that today is outside of. */
export function inSeason(text: string, today: Date): boolean {
  const m = /inspection date is on or between (\w+) (\d+) and (\w+) (\d+)/i.exec(text);
  if (!m) return true;
  const a = MONTHS.indexOf(m[1].toLowerCase()), b = MONTHS.indexOf(m[3].toLowerCase());
  if (a < 0 || b < 0) return true;
  const d = today.getMonth() * 100 + today.getDate();
  const start = a * 100 + Number(m[2]), end = b * 100 + Number(m[4]);
  return start <= end ? d >= start && d <= end : d >= start || d <= end;
}

function findings(): Finding[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')]
    .map(b => {
      const m = /^(Record|Remove) (Unit|Inside|Outside) finding: (.*)$/i.exec(b.getAttribute('aria-label') ?? '');
      if (!m) return null;
      const sev = /(LT|S|M|L)/.exec((b.textContent ?? '').replace(/^\s*(Unit|Inside|Outside)/i, ''))?.[1] ?? '';
      return { button: b, area: m[2].toLowerCase() as Area, text: m[3].trim(), severity: sev, recorded: m[1].toLowerCase() === 'remove' };
    })
    .filter((f): f is Finding => f !== null);
}

// ------------------------------------------------------------------ the pilot
export class VoicePilot {
  private pendingArea: Finding[] | null = null;
  private lastOptions: string[] = [];
  /** The standard the last options list belongs to. */
  private optionsStandard = '';
  private marked: { standard: string; room: string; area: Area; text: string }[] = [];
  /** Phrases still waiting in a multi-finding sentence, and what's been said back so far. */
  private queue: string[] = [];
  private batch: string[] = [];
  private batchSpoken = 0;
  /** Guess Unit / Outside from the selected room instead of asking. */
  autoArea = true;
  /** Optional Jev helper for phrases the local matcher can't settle. */
  jev: JevAsk | null = null;
  /** Where the last decision came from, for the log and tests. */
  lastSource: 'local' | 'jev' | 'learned' | 'hqs' = 'local';
  /** Reviewed phrases loaded from learned.json; checked before anything else. */
  learned: LearnedPhrase[] = [];
  /** Called for every learning event, e.g. to sync. Events are also kept in localStorage. */
  onLearn: ((e: LearnEvent) => void) | null = null;
  private said = '';
  /** Today's date, replaceable in tests. Used to drop heating options for the wrong season. */
  today: () => Date = () => new Date();
  private unsure: { said: string; room: string; standard: string; at: number } | null = null;

  constructor(private say: Say, private log: (m: string) => void = () => {}) {}

  standardSelect() { return labeledControl<HTMLSelectElement>(/jump to standard/i); }
  roomSelect() { return labeledControl<HTMLSelectElement>(/current room/i); }
  comments() { return labeledControl<HTMLTextAreaElement>(/inspector comments/i); }

  currentStandard(): string {
    const s = this.standardSelect();
    return s?.selectedOptions[0]?.text.replace(/^\d+\.\s*/, '') ?? '';
  }

  describe(): string {
    const s = this.standardSelect();
    const room = this.roomSelect()?.selectedOptions[0]?.text ?? '';
    const kinds = new Set(findings().map(f => f.text)).size;
    const num = s ? s.selectedIndex + 1 : 0;
    return `${room ? room + '. ' : ''}${num}. ${this.currentStandard()}. ${kinds} possible finding${kinds === 1 ? '' : 's'}.`;
  }

  async handle(heard: string): Promise<string> {
    const t = norm(heard);
    this.log(`heard: ${t}`);
    const reply = await this.route(t, heard);
    this.log(`reply: ${reply}`);
    this.say(reply);
    return reply;
  }

  private async route(t: string, raw: string): Promise<string> {
    if (!t) return "Didn't catch that.";

    // Answer to "unit or inside?"
    if (this.pendingArea && (AREAS as readonly string[]).includes(t)) {
      const choice = this.pendingArea.find(f => f.area === t);
      this.pendingArea = null;
      const r = choice ? this.mark(choice, this.inBatch()) : `No ${t} option for that finding.`;
      return this.inBatch() ? this.runQueue(r) : r;
    }
    this.pendingArea = null;
    if ((AREAS as readonly string[]).includes(t)) return `No question is waiting for an area. Say the finding first.`;
    this.queue = [];
    this.batch = [];
    this.batchSpoken = 0;

    if (['next', 'next standard', 'next item', 'skip'].includes(t)) return this.step('Next');
    if (['previous', 'prev', 'back', 'go back', 'previous standard'].includes(t)) return this.step('Prev');
    if (['where am i', 'repeat', 'say again', 'what standard'].includes(t)) return this.describe();
    if (['undo', 'scratch that', 'remove that', 'undo that'].includes(t)) return this.undo();
    if (['options', 'read options', 'what can i mark', 'list'].includes(t)) return this.readOptions();
    if (['photo', 'take photo', 'take a photo', 'picture'].includes(t)) return 'Tap Photo on the screen. Browsers only open the camera from a tap.';

    const num = /^(?:number|option) (\d+|one|two|three|four|five|six|seven|eight)$/.exec(t);
    if (num) return this.pickOption(num[1]);

    const go = /^(?:go to|jump to|open|standard) (.+)$/.exec(t);
    if (go) return (await this.jumpTo(go[1])) ?? `I couldn't find a standard called ${go[1]}.`;

    const room = /^(?:room|in room|switch to) (.+)$/.exec(t);
    if (room) return this.chooseRoom(room[1]);

    const note = /^(?:comment|note|add comment|add note)\s+(.+)$/i.exec(raw.trim());
    if (note) return this.addComment(note[1]);

    return this.processFindings(t);
  }

  private inBatch() { return this.queue.length > 0 || this.batch.length > 0; }

  /** Room prefix, then one or several findings. */
  private async processFindings(t: string): Promise<string> {
    let rest = t;
    let roomSaid = '';
    const room = this.roomPrefix(t);
    if (room) {
      roomSaid = this.chooseRoomOption(room.option) + ' ';
      rest = t.slice(room.length).trim();
      if (!rest) return roomSaid.trim();
    }
    const parts = this.splitFindings(rest);
    if (parts.length <= 1) return roomSaid + await this.markFromSpeech(rest);
    this.queue = parts;
    this.batch = roomSaid ? [roomSaid.trim()] : [];
    this.batchSpoken = 0;
    return this.runQueue();
  }

  /** Works through queued phrases; pauses if one needs an area answer. Never repeats what was already said. */
  private async runQueue(lastReply?: string): Promise<string> {
    if (lastReply) this.batch.push(lastReply);
    while (this.queue.length) {
      const part = this.queue.shift()!;
      const r = await this.markFromSpeech(part, true);
      if (this.pendingArea) {
        const fresh = this.batch.slice(this.batchSpoken);
        this.batchSpoken = this.batch.length;
        return [...fresh, r].join(' ');
      }
      this.batch.push(r);
    }
    const isFinding = (x: string) => !/^(Room:|Couldn't|Already|No |That )/.test(x);
    const count = this.batch.filter(isFinding).length;
    const fresh = this.batch.slice(this.batchSpoken);
    const room = fresh.filter(x => x.startsWith('Room:'));
    const rest = fresh.filter(x => !x.startsWith('Room:'));
    this.batch = [];
    this.batchSpoken = 0;
    return [...room, count > 1 ? `Recorded ${count}.` : '', ...rest].filter(Boolean).join(' ');
  }

  /** Splits a sentence into findings, but only where each piece names something to inspect. */
  splitFindings(t: string): string[] {
    const pieces = t.split(SEPARATORS).map(x => x.trim()).filter(Boolean);
    const merged: string[] = [];
    for (const piece of pieces) {
      if (merged.length && !this.matchStandard(piece)) merged[merged.length - 1] += ' and ' + piece;
      else merged.push(piece);
    }
    if (merged.length > 1) return merged;
    // No separators: split where a second standard is named ("outlet dead gfci won't trip").
    const hits = this.standardMentions(t);
    if (hits.length < 2) return [t];
    const words = t.split(' ');
    const out: string[] = [];
    hits.forEach((h, i) => {
      const start = i === 0 ? 0 : h.word;
      const end = i + 1 < hits.length ? hits[i + 1].word : words.length;
      out.push(words.slice(start, end).join(' '));
    });
    return out.filter(Boolean);
  }

  /** Where standards are named in the sentence, longest phrases first, no overlaps. */
  private standardMentions(t: string): { word: number; name: string }[] {
    const sel = this.standardSelect();
    if (!sel) return [];
    const words = t.split(' ');
    const found: { word: number; len: number; name: string }[] = [];
    for (const o of [...sel.options]) {
      const name = o.text.replace(/^\d+\.\s*/, '');
      const phrases = [name.toLowerCase().replace(/\s*-\s*/g, ' '), ...(STANDARD_ALIASES[name.toLowerCase()] ?? [])];
      for (const p of phrases.map(norm)) {
        const pw = p.split(' ');
        for (let i = 0; i + pw.length <= words.length; i++) {
          if (pw.every((w, k) => words[i + k] === w)) found.push({ word: i, len: pw.length, name });
        }
      }
    }
    found.sort((a, b) => b.len - a.len);
    const taken = new Set<number>();
    const keep: { word: number; name: string }[] = [];
    for (const f of found) {
      const span = Array.from({ length: f.len }, (_, k) => f.word + k);
      if (span.some(w => taken.has(w))) continue;
      span.forEach(w => taken.add(w));
      // Two mentions of the same standard back to back are one finding ("smoke alarm, smoke detector").
      keep.push({ word: f.word, name: f.name });
    }
    keep.sort((a, b) => a.word - b.word);
    return keep.filter((k, i) => i === 0 || k.name !== keep[i - 1].name || k.word - keep[i - 1].word > 3);
  }

  /** "kitchen outlet dead" -> the Kitchen room, if that room exists. */
  private roomPrefix(t: string): { option: HTMLOptionElement; length: number } | null {
    const sel = this.roomSelect();
    if (!sel) return null;
    let best: { option: HTMLOptionElement; length: number } | null = null;
    for (const o of [...sel.options]) {
      if (!o.value) continue;
      const full = norm(o.text.replace(/\s*·.*$/, ''));
      const base = full.replace(/\s+\d+$/, '');
      for (const cand of [full, base]) {
        if ((t === cand || t.startsWith(cand + ' ')) && (!best || cand.length > best.length)) {
          // A bare type ("kitchen") only counts when there's one room of that type.
          if (cand === base && cand !== full && [...sel.options].filter(x => norm(x.text).startsWith(base)).length > 1) continue;
          best = { option: o, length: cand.length };
        }
      }
    }
    return best;
  }

  private chooseRoomOption(o: HTMLOptionElement): string {
    const sel = this.roomSelect();
    if (sel && sel.value !== o.value) setNativeValue(sel, o.value);
    return `Room: ${o.text.replace(/\s*·.*$/, '')}.`;
  }

  private async jevPickStandard(t: string): Promise<string | null> {
    const sel = this.standardSelect();
    if (!this.jev || !sel) return null;
    const names = [...sel.options].map(o => o.text.replace(/^\d+\.\s*/, ''));
    const options: Record<string, string> = {};
    names.forEach((n, i) => { options[`s${i}`] = n; });
    const res = await this.jev({
      said: t, room: this.roomLabel(), question: 'Which HUD NSPIRE inspection standard is the inspector describing a problem with?', options,
    });
    this.log(`jev standard: ${JSON.stringify(res)}`);
    if (!res || res.choice === 'none') return null;
    return (res.probabilities[res.choice] ?? 0) >= JEV_STANDARD_ACT ? options[res.choice] ?? null : null;
  }

  private async jevPickFinding(t: string, texts: string[]): Promise<{ sure?: string; maybe?: string[] } | null> {
    if (!this.jev || !texts.length) return null;
    const options: Record<string, string> = {};
    const byKey: Record<string, string> = {};
    texts.forEach((x, i) => {
      byKey[`d${i + 1}`] = x;
      // Reviewed phrases ride along as examples, so Jev learns how inspectors talk.
      const ex = this.learned.filter(l => l.deficiency === x).slice(0, 5).map(l => `"${l.phrase}"`);
      options[`d${i + 1}`] = ex.length ? `${x} Inspectors also say: ${ex.join(', ')}.` : x;
    });
    const res = await this.jev({
      said: t, room: this.roomLabel(), standard: this.currentStandard(),
      question: 'Which HUD NSPIRE deficiency best matches what the inspector said about this standard?', options,
    });
    this.log(`jev finding: ${JSON.stringify(res)}`);
    if (!res) return null;
    const ranked = Object.entries(res.probabilities).filter(([k]) => k !== 'none').sort((a, b) => b[1] - a[1]);
    const [first, second] = ranked;
    if (!first || res.choice === 'none') return null;
    if (first[1] >= JEV_ACT && first[1] - (second?.[1] ?? 0) >= JEV_MARGIN) return { sure: byKey[first[0]] };
    const maybe = ranked.filter(([, p]) => p >= 0.2).slice(0, 2).map(([k]) => byKey[k]).filter(Boolean);
    return maybe.length ? { maybe } : null;
  }

  // ---------- learning loop ----------
  private learnedFor(t: string): LearnedPhrase | null {
    let best: LearnedPhrase | null = null;
    for (const l of this.learned) if (hasPhrase(t, l.phrase) && (!best || l.phrase.length > best.phrase.length)) best = l;
    return best;
  }

  async loadLearned(url = '/learned.json'): Promise<number> {
    try {
      const r = await fetch(url);
      if (!r.ok) return 0;
      const data = await r.json() as { aliases?: LearnedPhrase[] };
      this.learned = (data.aliases ?? []).filter(a => a.phrase && a.standard && a.deficiency).map(a => ({ ...a, phrase: norm(a.phrase) }));
      return this.learned.length;
    } catch { return 0; }
  }

  private noteUnsure(outcome: 'unmatched' | 'ambiguous') {
    if (!this.said) return;
    this.unsure = { said: this.said, room: this.roomLabel(), standard: this.currentStandard(), at: Date.now() };
    this.learn({ at: '', said: this.said, room: this.unsure.room, standard: this.unsure.standard, outcome });
  }

  private learn(e: LearnEvent) {
    const ev: LearnEvent = { ...e, at: new Date().toISOString(), said: redactPhrase(e.said).slice(0, 200), room: e.room.slice(0, 60) };
    try {
      const all = JSON.parse(localStorage.getItem(LEARN_KEY) ?? '[]') as LearnEvent[];
      all.push(ev);
      const trimmed = all.slice(-LEARN_MAX);
      localStorage.setItem(LEARN_KEY, JSON.stringify(trimmed));
      if (all.length > LEARN_MAX) {
        const sent = Number(localStorage.getItem(LEARN_SENT_KEY) ?? '0');
        localStorage.setItem(LEARN_SENT_KEY, String(Math.max(0, sent - (all.length - LEARN_MAX))));
      }
    } catch { /* storage full or blocked: learning is best-effort */ }
    this.onLearn?.(ev);
  }

  /** Everything logged on this device, for export or review. */
  learningLog(): LearnEvent[] {
    try { return JSON.parse(localStorage.getItem(LEARN_KEY) ?? '[]') as LearnEvent[]; } catch { return []; }
  }

  /** Sends events not yet sent to the app's /api/learn route. Safe to call often. */
  async syncLearning(url = '/api/learn'): Promise<number> {
    const all = this.learningLog();
    const sent = Number(localStorage.getItem(LEARN_SENT_KEY) ?? '0');
    const fresh = all.slice(sent);
    if (!fresh.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: fresh }) });
      if (!r.ok) return 0;
      localStorage.setItem(LEARN_SENT_KEY, String(all.length));
      return fresh.length;
    } catch { return 0; }
  }

  private roomLabel(): string {
    return this.roomSelect()?.selectedOptions[0]?.text.replace(/\s*·.*$/, '') ?? '';
  }

  roomNames(): string[] {
    const sel = this.roomSelect();
    return sel ? [...sel.options].filter(o => o.value).map(o => norm(o.text.replace(/\s*·.*$/, ''))) : [];
  }

  currentRoomArea(): Area | null {
    const o = this.roomSelect()?.selectedOptions[0];
    return o && o.value ? areaForRoomName(o.text) : null;
  }

  private async step(which: 'Next' | 'Prev'): Promise<string> {
    const b = buttonByText(which);
    if (!b) return `I can't find the ${which === 'Next' ? 'next' : 'previous'} button here.`;
    b.click();
    await wait(150);
    return this.describe();
  }

  private matchStandard(t: string): { value: string; name: string; score: number; phrase: string } | null {
    const sel = this.standardSelect();
    if (!sel) return null;
    let best: { value: string; name: string; score: number; phrase: string } | null = null;
    for (const o of [...sel.options]) {
      const name = o.text.replace(/^\d+\.\s*/, '');
      const phrases = [name.toLowerCase().replace(/\s*-\s*/g, ' '), ...(STANDARD_ALIASES[name.toLowerCase()] ?? [])];
      for (const p of phrases) {
        if (hasPhrase(t, p)) {
          const score = norm(p).length;
          if (!best || score > best.score) best = { value: o.value, name, score, phrase: norm(p) };
        }
      }
    }
    return best;
  }

  private async jumpTo(spoken: string): Promise<string | null> {
    const m = this.matchStandard(spoken);
    const sel = this.standardSelect();
    if (!m || !sel) return null;
    if (sel.value !== m.value) { setNativeValue(sel, m.value); await wait(150); }
    return this.describe();
  }

  private chooseRoom(spoken: string): string {
    const sel = this.roomSelect();
    if (!sel) return "I can't find the room list.";
    const want = tokens(spoken);
    let best: HTMLOptionElement | null = null; let bestScore = 0;
    for (const o of [...sel.options]) {
      const have = tokens(o.text);
      const score = want.filter(w => have.includes(w)).length;
      if (score > bestScore) { best = o; bestScore = score; }
    }
    if (!best) return `No room called ${spoken}. Add it on screen first.`;
    return this.chooseRoomOption(best);
  }

  private addComment(text: string): string {
    const el = this.comments();
    if (!el) return "I can't find the comments box.";
    const clean = text.trim().replace(/^\w/, c => c.toUpperCase());
    setNativeValue(el, el.value ? `${el.value.trimEnd()} ${clean}${/[.!?]$/.test(clean) ? '' : '.'}` : `${clean}${/[.!?]$/.test(clean) ? '' : '.'}`);
    return 'Comment added.';
  }

  private readOptions(): string {
    const kinds = [...new Set(findings().filter(f => inSeason(f.text, this.today())).map(f => f.text))];
    this.optionsStandard = this.currentStandard(); this.lastOptions = kinds;
    if (!kinds.length) return 'No findings listed for this standard.';
    return kinds.slice(0, 8).map((k, i) => `${i + 1}: ${trimDot(k.split(' ').slice(0, 9).join(' '))}`).join('. ') + '. Say number and the option.';
  }

  private async pickOption(n: string): Promise<string> {
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
    const i = (words[n] ?? parseInt(n, 10)) - 1;
    const text = this.lastOptions[i];
    if (!text) return 'Say options first, then pick a number.';
    if (this.optionsStandard && this.optionsStandard !== this.currentStandard()) await this.jumpTo(this.optionsStandard);
    const group = findings().filter(f => f.text === text);
    if (!group.length) return 'That option is gone. Say options again.';
    if (this.unsure && Date.now() - this.unsure.at < 120_000) {
      const { said, room } = this.unsure;
      this.learn({ at: '', said, room, outcome: 'corrected', chosen: text, standard: this.currentStandard() });
      this.unsure = null;
    }
    return this.chooseArea(group, null, this.autoArea ? this.currentRoomArea() : null);
  }

  private async markFromSpeech(t: string, inBatch = false): Promise<string> {
    this.said = t;
    const hqs = translateHqs(t);
    if (hqs.retired) return hqs.retired;

    // Reviewed phrases from the learning loop win: instant and offline.
    const known = this.learnedFor(t);
    if (known) {
      if (known.standard !== this.currentStandard()) await this.jumpTo(known.standard);
      const group = findings().filter(f => f.text === known.deficiency);
      if (group.length) {
        this.lastSource = 'learned';
        const spokenAreaL = (AREAS as readonly string[]).find(a => t.split(' ').includes(a)) as Area | undefined;
        return this.chooseArea(group, spokenAreaL ?? null, this.autoArea ? this.currentRoomArea() : null, inBatch);
      }
    }

    // If the inspector named a different standard (or an HQS item), go there first.
    let named = this.matchStandard(t);
    if (!named && hqs.standard) named = this.matchStandard(hqs.standard);
    if (named && named.name !== this.currentStandard()) {
      await this.jumpTo(named.name);
    }
    const spokenArea = (AREAS as readonly string[]).find(a => t.split(' ').includes(a)) as Area | undefined;
    const roomArea = this.autoArea ? this.currentRoomArea() : null;
    if (hqs.askFirst && !inBatch) {
      this.noteUnsure('ambiguous');
      return `${hqs.askFirst} ${this.readOptions()}`;
    }

    const all = findings().filter(f => inSeason(f.text, this.today()));
    if (!all.length) return inBatch ? `Couldn't place "${t}".` : `No findings to mark on ${this.currentStandard() || 'this screen'}.`;

    const spoken = tokens(t).filter(w => !(AREAS as readonly string[]).includes(w));
    const expanded = new Set(spoken.flatMap(w => [w, ...(WORD_SYNONYMS[w] ?? [])]));
    hqs.hint.forEach(w => expanded.add(w));
    // Words that only named the standard ("heater", "smoke detector") say little about which finding.
    const naming = new Set((named?.phrase ?? '').split(' ').filter(Boolean).flatMap(w => [w, ...(WORD_SYNONYMS[w] ?? [])]));
    const said = new Set(spoken.filter(w => !naming.has(w)).flatMap(w => [w, ...(WORD_SYNONYMS[w] ?? [])]));
    if (t.includes('not working') || t.includes("doesn't work") || t.includes('does not work')) {
      ['inoperable', 'function', 'produce', 'operate'].forEach(w => expanded.add(w));
    }

    const byText = new Map<string, Finding[]>();
    all.forEach(f => byText.set(f.text, [...(byText.get(f.text) ?? []), f]));
    // Words every option shares (like "smoke alarm") can't tell options apart.
    const optionWords = [...byText.keys()].map(text => new Set(tokens(text)));
    const common = optionWords.length > 1
      ? new Set([...optionWords[0]].filter(w => optionWords.every(o => o.has(w))))
      : new Set<string>();
    const scored = [...byText.entries()].map(([text, group]) => {
      const words = [...new Set(tokens(text))].filter(w => !common.has(w));
      const hits = words.filter(w => expanded.has(w))
        .reduce((sum, w) => sum + (WEAK.has(w) || (naming.has(w) && !said.has(w)) ? 0.3 : 1), 0);
      return { text, group, score: words.length ? hits / Math.sqrt(words.length) : 0 };
    }).sort((a, b) => b.score - a.score);

    // "Only 1 toilet" vs "at least 1 elsewhere": decide from the rooms on file.
    if (scored[1] && scored[0].score > 0 && scored[1].score >= scored[0].score * 0.75) {
      const pair = [scored[0], scored[1]];
      const only = pair.find(x => /\bonly 1\b/i.test(x.text));
      const elsewhere = pair.find(x => /\belsewhere\b/i.test(x.text));
      const baths = this.roomNames().filter(n => /\bbath/.test(n)).length;
      if (only && elsewhere && baths > 0) {
        const pick = baths === 1 ? only : elsewhere;
        scored.splice(scored.indexOf(pick), 1);
        scored.unshift({ ...pick, score: pick.score + 1 });
      }
    }

    let top = scored[0];
    const close = !!(scored[1] && top && scored[1].score >= top.score * 0.75);
    this.lastSource = 'local';

    // Local matcher unsure: ask Jev, if connected. Offline or slow -> carry on locally.
    if (this.jev && !(top && top.score > 0 && !close)) {
      if ((!top || top.score === 0) && !named) {
        const std = await this.jevPickStandard(t);
        if (std && std !== this.currentStandard()) await this.jumpTo(std);
      }
      const groups = new Map<string, Finding[]>();
      findings().filter(f => inSeason(f.text, this.today())).forEach(f => groups.set(f.text, [...(groups.get(f.text) ?? []), f]));
      let pick = await this.jevPickFinding(t, [...groups.keys()]);
      if (!pick && named) {
        // The word that named a standard may be the location, not the problem ("black stuff on the ceiling").
        const std = await this.jevPickStandard(t);
        if (std && std !== this.currentStandard()) {
          await this.jumpTo(std);
          groups.clear();
          findings().filter(f => inSeason(f.text, this.today())).forEach(f => groups.set(f.text, [...(groups.get(f.text) ?? []), f]));
          pick = await this.jevPickFinding(t, [...groups.keys()]);
        }
      }
      if (pick?.sure) {
        this.lastSource = 'jev';
        return this.chooseArea(groups.get(pick.sure) ?? [], spokenArea ?? null, roomArea, inBatch);
      }
      if (pick?.maybe && !inBatch) {
        this.lastSource = 'jev';
        this.optionsStandard = this.currentStandard(); this.lastOptions = pick.maybe;
        this.noteUnsure('ambiguous');
        const short = pick.maybe.map(k => trimDot(shorten(k, 9)));
        const said = new Set(short).size === short.length ? short : pick.maybe.map(trimDot);
        return `Did you mean ${said.map((k, i) => `${i + 1}: ${k}`).join(', or ')}? Say number and the option.`;
      }
      if (groups.size && !scored.some(x => groups.has(x.text))) {
        // Jev moved us to another standard but couldn't pick: start the local fallback from there.
        scored.length = 0;
        groups.forEach((group, text) => scored.push({ text, group, score: 0 }));
        top = scored[0];
      }
    }

    if (!top || top.score === 0) {
      // A single possible finding and the inspector only named the standard: take it.
      if (scored.length === 1 && named) return this.chooseArea(scored[0].group, spokenArea ?? null, roomArea, inBatch);
      this.noteUnsure('unmatched');
      if (inBatch) return `Couldn't place "${t}".`;
      this.optionsStandard = this.currentStandard(); this.lastOptions = scored.map(s => s.text);
      if (scored.length > 4) return `I'm on ${this.currentStandard()}, but couldn't match that. Say options to hear the list.`;
      return `I'm on ${this.currentStandard()}, but couldn't match that. ${this.readOptions()}`;
    }
    if (scored[1] && scored[1].score === top.score) {
      this.noteUnsure('ambiguous');
      if (inBatch) return `Couldn't place "${t}". Say it again on its own.`;
      this.optionsStandard = this.currentStandard(); this.lastOptions = scored.filter(s => s.score === top.score).map(s => s.text);
      return `That could be more than one. ${this.lastOptions.slice(0, 4).map((k, i) => `${i + 1}: ${trimDot(k.split(' ').slice(0, 9).join(' '))}`).join('. ')}. Say number and the option.`;
    }
    return this.chooseArea(top.group, spokenArea ?? null, roomArea, inBatch);
  }

  /**
   * Area order of preference: what the inspector said, then the room's likely area,
   * then the only option. Otherwise ask. A spoken area that doesn't apply is an error;
   * a room guess that doesn't apply just falls back to asking.
   */
  private chooseArea(group: Finding[], spoken: Area | null, fromRoom: Area | null = null, short = false): string {
    if (!group.length) return 'That option is gone. Say options again.';
    if (spoken) {
      const pick = group.find(f => f.area === spoken);
      return pick ? this.mark(pick, short)
        : `That finding isn't recorded under ${spoken} here. It applies to ${group.map(g => g.area).join(' or ')}.`;
    }
    const pick = (fromRoom && group.find(f => f.area === fromRoom)) || (group.length === 1 ? group[0] : null);
    if (pick) return this.mark(pick, short);
    this.pendingArea = group;
    return `${trimDot(group[0].text)}. Which area: ${group.map(g => g.area).join(' or ')}?`;
  }

  private mark(f: Finding, short = false): string {
    const area = f.area[0].toUpperCase() + f.area.slice(1);
    if (f.recorded) return `Already recorded: ${f.area}, ${trimDot(shorten(f.text))}.`;
    f.button.click();
    this.unsure = null;
    if (this.lastSource === 'jev' && this.said) {
      this.learn({ at: '', said: this.said, room: this.roomLabel(), standard: this.currentStandard(), outcome: 'jev', chosen: f.text, area: f.area });
    }
    this.marked.push({ standard: this.currentStandard(), room: this.roomSelect()?.value ?? '', area: f.area, text: f.text });
    if (short) return `${area}, ${trimDot(shorten(f.text))}, ${SEVERITY_SHORT[f.severity] ?? 'recorded'}.`;
    const sev = SEVERITY[f.severity];
    return `${area}: ${trimDot(f.text)}.${sev ? ' ' + sev + '.' : ''}`;
  }

  private async undo(): Promise<string> {
    const last = this.marked.pop();
    if (!last) return 'Nothing to undo.';
    // Findings belong to a room, so go back to the room it was recorded in.
    const roomSel = this.roomSelect();
    if (roomSel && roomSel.value !== last.room) { setNativeValue(roomSel, last.room); await wait(150); }
    if (this.currentStandard() !== last.standard) await this.jumpTo(last.standard);
    const f = findings().find(x => x.area === last.area && x.text === last.text && x.recorded);
    if (!f) return 'That finding is already removed.';
    f.button.click();
    return `Removed: ${last.area}, ${trimDot(shorten(last.text))}.`;
  }
}

// ------------------------------------------------------------------ headset + speech
interface Recognition {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}

/** Something that can say a reply in a better voice (see clipSpeaker.ts). Returns false to fall back. */
export interface Speaker { say(text: string): Promise<boolean>; stop(): void; unlock(preloadAll?: boolean): void }

export class HeadsetSession {
  readonly pilot: VoicePilot;
  /** Optional Kokoro clip voice; the browser voice is used when it can't say something. */
  speaker: Speaker | null = null;
  enabled = false;
  listening = false;
  private audio: HTMLAudioElement | null = null;
  private presses = 0;
  private timer: number | undefined;
  private rec: Recognition | null = null;
  onChange: () => void = () => {};
  /** Runs when headset mode turns off, e.g. to sync learning events. */
  onDisable: () => void = () => {};
  /** While set (during setup), headset presses are reported here instead of acting. */
  buttonTest: ((presses: number) => void) | null = null;
  /** Skip the spoken "Headset on" (setup speaks its own lines). */
  quietEnable = false;

  constructor(log: (m: string) => void = () => {}) {
    this.pilot = new VoicePilot(t => this.speak(t), log);
  }

  speak(text: string) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const sp = this.speaker;
    if (sp) {
      sp.stop();
      void sp.say(text).then(ok => { if (!ok) this.browserSpeak(text); });
      return;
    }
    this.browserSpeak(text);
  }

  private browserSpeak(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }

  /** Must be called from a tap. */
  async enable() {
    if (!this.audio) {
      this.audio = new Audio(silentWav());
      this.audio.loop = true;
    }
    await this.audio.play();
    this.speaker?.unlock(true);
    const ms = navigator.mediaSession;
    if (ms) {
      ms.metadata = new MediaMetadata({ title: 'NSPIRE headset mode', artist: 'HACSM practice' });
      const onPress = () => { this.press(); this.keepPlaying(); };
      ms.setActionHandler('play', onPress);
      ms.setActionHandler('pause', onPress);
      ms.setActionHandler('nexttrack', () => { void this.pilot.handle('next'); });
      ms.setActionHandler('previoustrack', () => { void this.pilot.handle('previous'); });
      ms.playbackState = 'playing';
    }
    this.enabled = true;
    this.onChange();
    if (!this.quietEnable) this.speak('Headset on. ' + this.pilot.describe());
  }

  disable() {
    this.audio?.pause();
    const ms = navigator.mediaSession;
    if (ms) {
      (['play', 'pause', 'nexttrack', 'previoustrack'] as MediaSessionAction[]).forEach(a => ms.setActionHandler(a, null));
      ms.playbackState = 'none';
    }
    this.rec?.stop();
    this.enabled = false;
    this.onChange();
    this.onDisable();
  }

  private keepPlaying() {
    this.audio?.play().catch(() => undefined);
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
  }

  /** Same as a headset button press; also used by tests. */
  simulatePress() { this.press(); }

  private press() {
    this.presses += 1;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      const n = this.presses; this.presses = 0;
      if (this.buttonTest) { this.buttonTest(n); return; }
      if (n === 1) this.listen();
      else if (n === 2) void this.pilot.handle('next');
      else void this.pilot.handle('where am i');
    }, 450);
  }

  listen() {
    if (this.listening) { this.rec?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { this.speak("This browser can't do speech recognition."); return; }
    window.speechSynthesis?.cancel();
    this.speaker?.stop();
    // iPads can lock the microphone while page audio plays; pause the silent loop while listening.
    this.audio?.pause();
    const rec = new Ctor();
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = e => { void this.pilot.handle(e.results[0][0].transcript); };
    rec.onerror = e => { if (e.error === 'no-speech') this.speak("Didn't catch that."); else if (e.error === 'network') this.speak('Speech needs a connection.'); };
    rec.onend = () => { this.listening = false; this.keepPlaying(); this.onChange(); };
    this.rec = rec;
    this.listening = true;
    this.onChange();
    rec.start();
  }
}

function silentWav(seconds = 1, rate = 8000): string {
  const n = seconds * rate;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const s = (o: number, x: string) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  s(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
