/**
 * HQS -> NSPIRE crosswalk for what inspectors SAY.
 *
 * Inspectors trained on HQS (form HUD-52580) will keep using HQS item numbers and
 * HQS-era fail wording for years. This maps that language to NSPIRE standards and
 * adds hint words for the deficiency matcher. A few HQS conditions are not NSPIRE
 * deficiencies at all; for those the pilot explains instead of recording.
 *
 * Sources: HUD-52580 (4/2023) item list; PHA "most common HQS fail items" lists
 * (Tarrant County, RIHousing, SC Housing, Inlivian); HQS vs NSPIRE-V comparison
 * (Padmission, Aug 2026, against NSPIRE standards v3.0). Verify retired items with
 * your trainer before relying on them.
 */

export interface HqsMapping {
  /** Phrases as spoken (normalized: lowercase, no punctuation). */
  say: string[];
  /** NSPIRE standard name exactly as the app lists it. */
  standard: string;
  /** Extra words that steer the deficiency matcher toward HUD's wording. */
  hint?: string[];
  /** HQS item number, for reference. */
  hqs?: string;
  /** Severity depends on something the phrase doesn't say: read the options instead of recording. */
  askFirst?: string;
}

/** HQS form items (by number and name) -> the NSPIRE standard that now covers them. */
export const HQS_ITEMS: HqsMapping[] = [
  { hqs: '1.2', say: ['electricity', 'electricity illumination', 'illumination'], standard: 'Minimum Electrical and Lighting' },
  { hqs: '1.3', say: ['electrical hazards', 'electrical hazard'], standard: 'Electrical - Conductor, Outlet, and Switch' },
  { hqs: '1.4', say: ['unit security'], standard: 'Door - Entry', hint: ['secured', 'lock'] },
  { hqs: '1.5', say: ['window condition'], standard: 'Window' },
  { hqs: '1.6', say: ['ceiling condition'], standard: 'Ceiling' },
  { hqs: '1.7', say: ['wall condition'], standard: 'Wall - Interior' },
  { hqs: '1.8', say: ['floor condition'], standard: 'Floor' },
  { hqs: '1.9', say: ['lead based paint', 'lead paint', 'deteriorated paint'], standard: 'Potential Lead-Based Paint Hazards - Visual Assessment' },
  { hqs: '2.10', say: ['stove or range with oven', 'range with oven', 'stove or range'], standard: 'Cooking Appliance' },
  { hqs: '2.11', say: ['refrigerator'], standard: 'Refrigerator' },
  { hqs: '2.12', say: ['kitchen sink'], standard: 'Sink' },
  { hqs: '2.13', say: ['space for storage preparation and serving of food', 'space for storage', 'food preparation', 'counter space', 'prep area'], standard: 'Food Preparation Area' },
  { hqs: '3.10', say: ['flush toilet in enclosed room', 'flush toilet', 'commode'], standard: 'Toilet' },
  { hqs: '3.11', say: ['fixed wash basin', 'wash basin', 'lavatory', 'bathroom sink', 'vanity'], standard: 'Sink' },
  { hqs: '3.12', say: ['tub or shower'], standard: 'Bathtub and Shower' },
  { hqs: '3.13', say: ['bathroom ventilation', 'no ventilation'], standard: 'Ventilation' },
  { hqs: '4.10', say: ['smoke detectors'], standard: 'Smoke Alarm' },
  { hqs: '6.1', say: ['condition of foundation', 'foundation'], standard: 'Foundation' },
  { hqs: '6.2', say: ['condition of stairs rails and porches', 'stairs rails and porches', 'porch'], standard: 'Steps and Stairs' },
  { hqs: '6.3', say: ['condition of roof gutters', 'roof gutters', 'gutters', 'gutter', 'roof'], standard: 'Roof Assembly' },
  { hqs: '6.4', say: ['condition of exterior surfaces', 'exterior surfaces', 'exterior surface'], standard: 'Wall - Exterior' },
  { hqs: '6.5', say: ['condition of chimney'], standard: 'Chimney' },
  { hqs: '6.6', say: ['exterior lead paint', 'lead paint exterior'], standard: 'Potential Lead-Based Paint Hazards - Visual Assessment' },
  { hqs: '7.1', say: ['adequacy of heating equipment', 'heating equipment'], standard: 'Heating, Ventilation, and Air Conditioning (HVAC)' },
  { hqs: '7.2', say: ['safety of heating equipment'], standard: 'Heating, Ventilation, and Air Conditioning (HVAC)' },
  { hqs: '7.3', say: ['ventilation cooling', 'cooling'], standard: 'Heating, Ventilation, and Air Conditioning (HVAC)' },
  { hqs: '7.4', say: ['water heater'], standard: 'Water Heater' },
  { hqs: '7.6', say: ['plumbing'], standard: 'Leak - Water' },
  { hqs: '7.7', say: ['sewer connection', 'sewer backup', 'sewage backup'], standard: 'Leak - Sewage System' },
  { hqs: '8.1', say: ['access to unit'], standard: 'Door - Entry' },
  { hqs: '8.2', say: ['fire exits', 'fire exit', 'second means of egress', 'alternate exit'], standard: 'Egress' },
  { hqs: '8.3', say: ['evidence of infestation', 'vermin'], standard: 'Infestation' },
  { hqs: '8.4', say: ['garbage and debris', 'garbage', 'debris', 'junk in the yard', 'trash in the yard', 'inoperable vehicle', 'abandoned car'], standard: 'Litter' },
  { hqs: '8.5', say: ['refuse disposal', 'trash cans', 'dumpster'], standard: 'Litter' },
  { hqs: '8.6', say: ['interior stairs and common halls', 'common halls', 'interior stairs'], standard: 'Steps and Stairs' },
  { hqs: '8.8', say: ['elevators'], standard: 'Elevator' },
];

/** HQS-era fail wording (from PHA "most common fail items" lists) -> NSPIRE standard + hint words. */
export const HQS_PHRASES: HqsMapping[] = [
  { say: ['outlet cover', 'outlet covers', 'cover plate', 'cover plates', 'switch plate', 'switch cover'], standard: 'Electrical - Conductor, Outlet, and Switch', hint: ['damaged'],
    askFirst: 'Cover plates depend on whether wires are exposed or the outlet is damaged.' },
  { say: ['knockout', 'knockouts', 'missing blanks', 'open slot', 'open slots', 'breaker slot', 'panel blank', 'dead front'], standard: 'Electrical - Service Panel',
    askFirst: 'Missing knockouts or blanks: if live wiring is exposed, say exposed conductor, which is life-threatening. Otherwise pick from the panel options.' },
  { say: ['double tapped', 'double tap', 'double lugged'], standard: 'Electrical - Service Panel',
    askFirst: 'Double-tapped breakers aren\'t named in NSPIRE. If the breaker is damaged or contaminated, pick that option.' },
  { say: ['reverse polarity', 'open ground', 'not grounded', 'ungrounded', 'three prong', 'hot neutral reversed'], standard: 'Electrical - Conductor, Outlet, and Switch', hint: ['properly', 'wired', 'grounded'] },
  { say: ['burner knob', 'burner knobs', 'control knob', 'control knobs', 'stove knob'], standard: 'Cooking Appliance', hint: ['component', 'damaged', 'missing'] },
  { say: ['burner', 'burners', "burner won't light", 'oven inoperable'], standard: 'Cooking Appliance' },
  { say: ['range hood', 'stove hood', 'hood fan'], standard: 'Ventilation' },
  { say: ['bathroom fan', 'exhaust fan', 'vent fan'], standard: 'Ventilation', hint: ['inoperable'] },
  { say: ['tpr', 't p r', 'temperature pressure relief', 'pressure relief valve', 'relief valve', 'discharge line', 'discharge tube', 'discharge pipe', 'drain line'], standard: 'Water Heater', hint: ['relief', 'valve', 'discharge', 'piping'] },
  { say: ['gasket', 'door seal', 'crisper', 'vegetable bin', 'freezer door'], standard: 'Refrigerator', hint: ['component', 'damaged'] },
  { say: ['loose at the base', 'toilet loose', 'commode loose', 'wobbly toilet', 'rocking toilet'], standard: 'Toilet', hint: ['secured', 'base'] },
  { say: ['running toilet', 'toilet keeps running', 'toilet runs'], standard: 'Toilet', hint: ['component', 'inoperable'] },
  { say: ['window lock', 'window locks', 'sash lock'], standard: 'Window', hint: ['secured'] },
  { say: ["won't stay up", "won't stay open", 'window balance', 'sash balance'], standard: 'Window', hint: ['open', 'stay'] },
  { say: ['peeling paint', 'chipping paint', 'flaking paint', 'paint chips'], standard: 'Potential Lead-Based Paint Hazards - Visual Assessment' },
  { say: ['strike plate', 'door knob', 'doorknob', 'door hinge', 'hinges'], standard: 'Door - General', hint: ['component', 'damaged'] },
  { say: ['space heater', 'portable heater', 'oven for heat', 'no permanent heat'], standard: 'Heating, Ventilation, and Air Conditioning (HVAC)',
    hint: ['permanently', 'installed', 'heating', 'source'],
    askFirst: 'Portable heat doesn\'t count under NSPIRE. An unvented gas, oil or kerosene heater is its own finding; no permanent heat is another.' },
  { say: ['battery smoke detector', '9 volt', 'nine volt'], standard: 'Smoke Alarm' },
  { say: ['light globe', 'globe missing', 'light fixture', 'fixture inoperable'], standard: 'Lighting - Interior' },
  { say: ['two outlets', 'not enough outlets', 'no outlet', 'only one outlet'], standard: 'Minimum Electrical and Lighting' },
  { say: ['gas cap', 'uncapped gas line', 'gas line capped'], standard: 'Leak - Gas/Oil' },
];

/**
 * HQS conditions that are not NSPIRE-V deficiencies. The pilot explains rather than
 * recording, so HQS habits don't produce findings NSPIRE wouldn't cite.
 */
export const HQS_RETIRED: { say: string[]; explain: string }[] = [
  { say: ['cracked pane', 'cracked window pane', 'cracked glass', 'broken pane', 'crack in the window', 'cracked window'],
    explain: "Under NSPIRE, a cracked pane isn't recorded if the window still closes, latches and works. If it won't close, lock or open, say that instead." },
  { say: ['site and neighborhood', 'neighborhood conditions', 'traffic noise', 'air pollution'],
    explain: "Site and neighborhood conditions aren't part of NSPIRE unit inspections." },
  { say: ['no window in the bedroom', 'no window in bedroom', 'bedroom has no window', 'living room has no window'],
    explain: "NSPIRE doesn't require a window in every room. Check that windows that exist open, lock, and aren't blocked as an exit." },
  { say: ['window screen', 'window screens', 'torn screen', 'missing screen'],
    explain: "Screens were a common HQS fail. If the window itself works, check the NSPIRE window and infestation standards before recording anything." },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (text: string, phrase: string) => (' ' + text + ' ').includes(' ' + norm(phrase) + ' ');

export interface HqsTranslation { standard?: string; hint: string[]; retired?: string; hqsItem?: string; askFirst?: string }

/** Turns HQS language into NSPIRE terms. Longest phrase wins. */
export function translateHqs(spoken: string): HqsTranslation {
  const t = norm(spoken);
  for (const r of HQS_RETIRED) if (r.say.some(p => has(t, p))) return { hint: [], retired: r.explain };
  // Spoken item numbers come through as "2 10", "two point ten" is handled by the recognizer as "2.10".
  const num = /\b(\d) (\d{1,2})\b/.exec(t);
  let best: { m: HqsMapping; len: number } | null = null;
  for (const m of [...HQS_PHRASES, ...HQS_ITEMS]) {
    for (const p of m.say) if (has(t, p) && (!best || norm(p).length > best.len)) best = { m, len: norm(p).length };
    if (num && m.hqs === `${num[1]}.${num[2]}` && (!best || best.len < 3)) best = { m, len: 3 };
  }
  return best ? { standard: best.m.standard, hint: best.m.hint ?? [], hqsItem: best.m.hqs, askFirst: best.m.askFirst } : { hint: [] };
}
