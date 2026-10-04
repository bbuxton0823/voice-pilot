"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // hqsCrosswalk.ts
  var HQS_ITEMS = [
    { hqs: "1.2", say: ["electricity", "electricity illumination", "illumination"], standard: "Minimum Electrical and Lighting" },
    { hqs: "1.3", say: ["electrical hazards", "electrical hazard"], standard: "Electrical - Conductor, Outlet, and Switch" },
    { hqs: "1.4", say: ["unit security"], standard: "Door - Entry", hint: ["secured", "lock"] },
    { hqs: "1.5", say: ["window condition"], standard: "Window" },
    { hqs: "1.6", say: ["ceiling condition"], standard: "Ceiling" },
    { hqs: "1.7", say: ["wall condition"], standard: "Wall - Interior" },
    { hqs: "1.8", say: ["floor condition"], standard: "Floor" },
    { hqs: "1.9", say: ["lead based paint", "lead paint", "deteriorated paint"], standard: "Potential Lead-Based Paint Hazards - Visual Assessment" },
    { hqs: "2.10", say: ["stove or range with oven", "range with oven", "stove or range"], standard: "Cooking Appliance" },
    { hqs: "2.11", say: ["refrigerator"], standard: "Refrigerator" },
    { hqs: "2.12", say: ["kitchen sink"], standard: "Sink" },
    { hqs: "2.13", say: ["space for storage preparation and serving of food", "space for storage", "food preparation", "counter space", "prep area"], standard: "Food Preparation Area" },
    { hqs: "3.10", say: ["flush toilet in enclosed room", "flush toilet", "commode"], standard: "Toilet" },
    { hqs: "3.11", say: ["fixed wash basin", "wash basin", "lavatory", "bathroom sink", "vanity"], standard: "Sink" },
    { hqs: "3.12", say: ["tub or shower"], standard: "Bathtub and Shower" },
    { hqs: "3.13", say: ["bathroom ventilation", "no ventilation"], standard: "Ventilation" },
    { hqs: "4.10", say: ["smoke detectors"], standard: "Smoke Alarm" },
    { hqs: "6.1", say: ["condition of foundation", "foundation"], standard: "Foundation" },
    { hqs: "6.2", say: ["condition of stairs rails and porches", "stairs rails and porches", "porch"], standard: "Steps and Stairs" },
    { hqs: "6.3", say: ["condition of roof gutters", "roof gutters", "gutters", "gutter", "roof"], standard: "Roof Assembly" },
    { hqs: "6.4", say: ["condition of exterior surfaces", "exterior surfaces", "exterior surface"], standard: "Wall - Exterior" },
    { hqs: "6.5", say: ["condition of chimney"], standard: "Chimney" },
    { hqs: "6.6", say: ["exterior lead paint", "lead paint exterior"], standard: "Potential Lead-Based Paint Hazards - Visual Assessment" },
    { hqs: "7.1", say: ["adequacy of heating equipment", "heating equipment"], standard: "Heating, Ventilation, and Air Conditioning (HVAC)" },
    { hqs: "7.2", say: ["safety of heating equipment"], standard: "Heating, Ventilation, and Air Conditioning (HVAC)" },
    { hqs: "7.3", say: ["ventilation cooling", "cooling"], standard: "Heating, Ventilation, and Air Conditioning (HVAC)" },
    { hqs: "7.4", say: ["water heater"], standard: "Water Heater" },
    { hqs: "7.6", say: ["plumbing"], standard: "Leak - Water" },
    { hqs: "7.7", say: ["sewer connection", "sewer backup", "sewage backup"], standard: "Leak - Sewage System" },
    { hqs: "8.1", say: ["access to unit"], standard: "Door - Entry" },
    { hqs: "8.2", say: ["fire exits", "fire exit", "second means of egress", "alternate exit"], standard: "Egress" },
    { hqs: "8.3", say: ["evidence of infestation", "vermin"], standard: "Infestation" },
    { hqs: "8.4", say: ["garbage and debris", "garbage", "debris", "junk in the yard", "trash in the yard", "inoperable vehicle", "abandoned car"], standard: "Litter" },
    { hqs: "8.5", say: ["refuse disposal", "trash cans", "dumpster"], standard: "Litter" },
    { hqs: "8.6", say: ["interior stairs and common halls", "common halls", "interior stairs"], standard: "Steps and Stairs" },
    { hqs: "8.8", say: ["elevators"], standard: "Elevator" }
  ];
  var HQS_PHRASES = [
    {
      say: ["outlet cover", "outlet covers", "cover plate", "cover plates", "switch plate", "switch cover"],
      standard: "Electrical - Conductor, Outlet, and Switch",
      hint: ["damaged"],
      askFirst: "Cover plates depend on whether wires are exposed or the outlet is damaged."
    },
    {
      say: ["knockout", "knockouts", "missing blanks", "open slot", "open slots", "breaker slot", "panel blank", "dead front"],
      standard: "Electrical - Service Panel",
      askFirst: "Missing knockouts or blanks: if live wiring is exposed, say exposed conductor, which is life-threatening. Otherwise pick from the panel options."
    },
    {
      say: ["double tapped", "double tap", "double lugged"],
      standard: "Electrical - Service Panel",
      askFirst: "Double-tapped breakers aren't named in NSPIRE. If the breaker is damaged or contaminated, pick that option."
    },
    { say: ["reverse polarity", "open ground", "not grounded", "ungrounded", "three prong", "hot neutral reversed"], standard: "Electrical - Conductor, Outlet, and Switch", hint: ["properly", "wired", "grounded"] },
    { say: ["burner knob", "burner knobs", "control knob", "control knobs", "stove knob"], standard: "Cooking Appliance", hint: ["component", "damaged", "missing"] },
    { say: ["burner", "burners", "burner won't light", "oven inoperable"], standard: "Cooking Appliance" },
    { say: ["range hood", "stove hood", "hood fan"], standard: "Ventilation" },
    { say: ["bathroom fan", "exhaust fan", "vent fan"], standard: "Ventilation", hint: ["inoperable"] },
    { say: ["tpr", "t p r", "temperature pressure relief", "pressure relief valve", "relief valve", "discharge line", "discharge tube", "discharge pipe", "drain line"], standard: "Water Heater", hint: ["relief", "valve", "discharge", "piping"] },
    { say: ["gasket", "door seal", "crisper", "vegetable bin", "freezer door"], standard: "Refrigerator", hint: ["component", "damaged"] },
    { say: ["loose at the base", "toilet loose", "commode loose", "wobbly toilet", "rocking toilet"], standard: "Toilet", hint: ["secured", "base"] },
    { say: ["running toilet", "toilet keeps running", "toilet runs"], standard: "Toilet", hint: ["component", "inoperable"] },
    { say: ["window lock", "window locks", "sash lock"], standard: "Window", hint: ["secured"] },
    { say: ["won't stay up", "won't stay open", "window balance", "sash balance"], standard: "Window", hint: ["open", "stay"] },
    { say: ["peeling paint", "chipping paint", "flaking paint", "paint chips"], standard: "Potential Lead-Based Paint Hazards - Visual Assessment" },
    { say: ["strike plate", "door knob", "doorknob", "door hinge", "hinges"], standard: "Door - General", hint: ["component", "damaged"] },
    {
      say: ["space heater", "portable heater", "oven for heat", "no permanent heat"],
      standard: "Heating, Ventilation, and Air Conditioning (HVAC)",
      hint: ["permanently", "installed", "heating", "source"],
      askFirst: "Portable heat doesn't count under NSPIRE. An unvented gas, oil or kerosene heater is its own finding; no permanent heat is another."
    },
    { say: ["battery smoke detector", "9 volt", "nine volt"], standard: "Smoke Alarm" },
    { say: ["light globe", "globe missing", "light fixture", "fixture inoperable"], standard: "Lighting - Interior" },
    { say: ["two outlets", "not enough outlets", "no outlet", "only one outlet"], standard: "Minimum Electrical and Lighting" },
    { say: ["gas cap", "uncapped gas line", "gas line capped"], standard: "Leak - Gas/Oil" }
  ];
  var HQS_RETIRED = [
    {
      say: ["cracked pane", "cracked window pane", "cracked glass", "broken pane", "crack in the window", "cracked window"],
      explain: "Under NSPIRE, a cracked pane isn't recorded if the window still closes, latches and works. If it won't close, lock or open, say that instead."
    },
    {
      say: ["site and neighborhood", "neighborhood conditions", "traffic noise", "air pollution"],
      explain: "Site and neighborhood conditions aren't part of NSPIRE unit inspections."
    },
    {
      say: ["no window in the bedroom", "no window in bedroom", "bedroom has no window", "living room has no window"],
      explain: "NSPIRE doesn't require a window in every room. Check that windows that exist open, lock, and aren't blocked as an exit."
    },
    {
      say: ["window screen", "window screens", "torn screen", "missing screen"],
      explain: "Screens were a common HQS fail. If the window itself works, check the NSPIRE window and infestation standards before recording anything."
    }
  ];
  var norm = (s) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
  var has = (text, phrase) => (" " + text + " ").includes(" " + norm(phrase) + " ");
  function translateHqs(spoken) {
    const t = norm(spoken);
    for (const r of HQS_RETIRED) if (r.say.some((p) => has(t, p))) return { hint: [], retired: r.explain };
    const num = /\b(\d) (\d{1,2})\b/.exec(t);
    let best = null;
    for (const m of [...HQS_PHRASES, ...HQS_ITEMS]) {
      for (const p of m.say) if (has(t, p) && (!best || norm(p).length > best.len)) best = { m, len: norm(p).length };
      if (num && m.hqs === `${num[1]}.${num[2]}` && (!best || best.len < 3)) best = { m, len: 3 };
    }
    return best ? { standard: best.m.standard, hint: best.m.hint ?? [], hqsItem: best.m.hqs, askFirst: best.m.askFirst } : { hint: [] };
  }

  // voicePilot.ts
  var LEARN_KEY = "voicepilot:learn";
  var LEARN_SENT_KEY = "voicepilot:learn-sent";
  var LEARN_MAX = 500;
  var redactPhrase = (s) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\d{3,}/g, "#");
  function jevViaProxy(url = "/api/jev", timeoutMs = 2500) {
    return async (req) => {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeoutMs);
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal: ctl.signal });
        clearTimeout(timer);
        if (!r.ok) return null;
        const data = await r.json();
        return typeof data?.choice === "string" ? data : null;
      } catch {
        return null;
      }
    };
  }
  var JEV_ACT = 0.55;
  var JEV_MARGIN = 0.15;
  var JEV_STANDARD_ACT = 0.5;
  var STANDARD_ALIASES = {
    "smoke alarm": ["smoke detector", "smoke detectors", "smoke alarms", "smoke"],
    "carbon monoxide": ["co alarm", "co detector", "carbon monoxide alarm", "carbon monoxide detector"],
    "electrical - conductor, outlet, and switch": ["outlet", "outlets", "receptacle", "light switch", "switch", "exposed wire", "exposed wires", "exposed wiring", "cover plate"],
    "electrical - gfci/afci": ["gfci", "gfi", "afci", "ground fault"],
    "electrical - service panel": ["breaker panel", "electrical panel", "breaker box", "service panel", "panel"],
    "cooking appliance": ["stove", "range", "oven", "burner", "burners", "cooktop"],
    "refrigerator": ["fridge"],
    "bathtub and shower": ["bathtub", "tub", "shower"],
    "heating, ventilation, and air conditioning (hvac)": ["wall heater", "heater", "heating", "furnace", "hvac", "air conditioner", "no heat"],
    "water heater": ["water heater", "hot water", "tpr valve", "relief valve"],
    "leak - gas/oil": ["gas leak", "gas smell", "smell gas", "oil leak"],
    "leak - water": ["water leak", "leak", "leaking", "drip", "dripping"],
    "leak - sewage system": ["sewage", "sewer"],
    "mold-like substance": ["mold", "mildew"],
    "infestation": ["roaches", "roach", "cockroaches", "mice", "mouse", "rats", "rodents", "bed bugs", "pests", "droppings"],
    "door - entry": ["front door", "entry door", "deadbolt"],
    "door - fire": ["fire door"],
    "steps and stairs": ["stairs", "steps", "stair"],
    "potential lead-based paint hazards - visual assessment": ["lead paint", "peeling paint", "chipping paint", "deteriorated paint"],
    "trip hazard": ["trip hazard", "tripping"],
    "egress": ["blocked exit", "exit blocked", "egress"],
    "fire extinguisher": ["extinguisher"],
    "wall - interior": ["interior wall", "wall", "walls"],
    "wall - exterior": ["exterior wall", "siding"],
    "floor": ["floor", "flooring", "carpet"],
    "sink": ["sink", "faucet"],
    "ventilation": ["exhaust fan", "bathroom fan", "vent fan"],
    "lighting - interior": ["light fixture", "interior light"],
    "lighting - exterior": ["exterior light", "porch light"],
    "flammable and combustible item": ["flammable", "gas can"],
    "guardrail": ["guardrail", "railing"],
    "clothes dryer exhaust ventilation": ["dryer vent", "dryer exhaust"],
    "address and signage": ["address", "address numbers", "signage"],
    "cabinet and storage": ["cabinet", "cabinets", "cabinet door", "drawer", "drawers", "countertop", "shelf", "shelves"],
    "toilet": ["toilet", "commode"]
  };
  for (const m of [...HQS_ITEMS, ...HQS_PHRASES]) {
    const key = m.standard.toLowerCase();
    STANDARD_ALIASES[key] = [...STANDARD_ALIASES[key] ?? [], ...m.say];
  }
  var WORD_SYNONYMS = {
    missing: ["not", "installed", "missing", "absent"],
    none: ["not", "installed"],
    dead: ["not", "produce", "inoperable", "function", "functioning", "energized"],
    inoperable: ["inoperable", "not", "function", "produce", "functioning"],
    working: ["function", "functioning", "operate", "produce"],
    work: ["function", "functioning", "operate", "produce"],
    broken: ["broken", "damaged", "inoperable"],
    damaged: ["damaged", "broken"],
    blocked: ["obstructed", "blocked"],
    covered: ["obstructed"],
    cracked: ["cracked", "damaged", "broken"],
    hole: ["hole", "holes", "damaged"],
    holes: ["hole", "holes", "damaged"],
    loose: ["loose", "insecure", "damaged"],
    leaking: ["leak", "leaking"],
    peeling: ["peeling", "deteriorated"],
    exposed: ["exposed"],
    stuck: ["open", "close", "inoperable"],
    no: ["missing", "not"],
    "doesn't": ["not", "does", "inoperable"],
    "won't": ["not", "will", "inoperable"],
    "can't": ["cannot", "not"],
    "isn't": ["not"],
    trip: ["test", "reset", "button", "inoperable"],
    reset: ["test", "reset", "button", "inoperable"],
    power: ["energized"],
    energized: ["energized"],
    ungrounded: ["properly", "wired", "grounded"],
    grounded: ["properly", "grounded"],
    ground: ["grounded", "properly"],
    polarity: ["properly", "wired"],
    miswired: ["properly", "wired"],
    unprotected: ["unprotected", "water", "source"],
    lock: ["secured", "secure"],
    locks: ["secured", "secure"],
    secure: ["secured", "secure"],
    roach: ["cockroach", "cockroaches"],
    roaches: ["cockroach", "cockroaches"],
    cockroaches: ["cockroach", "cockroaches"],
    mice: ["mice", "mouse"],
    mouse: ["mice", "mouse"],
    rats: ["rat", "rats"],
    rat: ["rat", "rats"],
    bedbugs: ["bedbugs"],
    bugs: ["bedbugs"],
    lots: ["extensive"],
    many: ["extensive"],
    heavy: ["extensive"],
    severe: ["extensive"],
    clogged: ["inoperable", "draining", "drain", "not"],
    backed: ["draining", "drain", "inoperable"],
    wobbly: ["secured", "loose"],
    wobbles: ["secured", "loose"]
  };
  var WEAK = /* @__PURE__ */ new Set(["not", "will", "does", "cannot", "no", "is", "or"]);
  var STOP = /* @__PURE__ */ new Set(["the", "a", "an", "is", "are", "in", "on", "of", "and", "or", "to", "it", "its", "this", "that", "there", "at", "for", "with", "by", "be", "has", "have", "was", "when"]);
  var AREAS = ["unit", "inside", "outside"];
  var SEVERITY_SHORT = { LT: "life-threatening", S: "severe", M: "moderate", L: "low" };
  var SEPARATORS = /\s*(?:,|;|\band also\b|\balso\b|\bplus\b|\band then\b|\bthen\b|\bnext one\b|\band\b)\s*/;
  function areaForRoomName(name) {
    const n = norm2(name.replace(/\s*·.*$/, ""));
    if (!n || n.startsWith("unit building")) return null;
    if (/\b(shared|common|lobby|corridor|stairwell|mail|community|building)\b/.test(n)) return null;
    if (/\b(exterior|outside|yard|porch|patio|parking|roof|site|grounds|driveway|sidewalk)\b/.test(n)) return "outside";
    return "unit";
  }
  var SEVERITY = {
    LT: "Life-threatening, 24 hours",
    S: "Severe, 30 days",
    M: "Moderate, 30 days",
    L: "Low, recorded only"
  };
  var shorten = (s, n = 8) => s.split(" ").slice(0, n).join(" ");
  var trimDot = (s) => s.replace(/[.\s]+$/, "");
  var norm2 = (s) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
  var tokens = (s) => norm2(s).split(" ").filter((t) => t && !STOP.has(t));
  var hasPhrase = (text, phrase) => (" " + norm2(text) + " ").includes(" " + norm2(phrase) + " ");
  var wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function labeledControl(pattern) {
    const label = [...document.querySelectorAll("label")].find((l) => pattern.test(l.textContent ?? ""));
    return label?.control ?? label?.querySelector("select,textarea,input") ?? null;
  }
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  }
  function buttonByText(text) {
    return [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) ?? null;
  }
  var MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  function inSeason(text, today) {
    const m = /inspection date is on or between (\w+) (\d+) and (\w+) (\d+)/i.exec(text);
    if (!m) return true;
    const a = MONTHS.indexOf(m[1].toLowerCase()), b = MONTHS.indexOf(m[3].toLowerCase());
    if (a < 0 || b < 0) return true;
    const d = today.getMonth() * 100 + today.getDate();
    const start = a * 100 + Number(m[2]), end = b * 100 + Number(m[4]);
    return start <= end ? d >= start && d <= end : d >= start || d <= end;
  }
  function findings() {
    return [...document.querySelectorAll("button[aria-label]")].map((b) => {
      const m = /^(Record|Remove) (Unit|Inside|Outside) finding: (.*)$/i.exec(b.getAttribute("aria-label") ?? "");
      if (!m) return null;
      const sev = /(LT|S|M|L)/.exec((b.textContent ?? "").replace(/^\s*(Unit|Inside|Outside)/i, ""))?.[1] ?? "";
      return { button: b, area: m[2].toLowerCase(), text: m[3].trim(), severity: sev, recorded: m[1].toLowerCase() === "remove" };
    }).filter((f) => f !== null);
  }
  var VoicePilot = class {
    constructor(say, log = () => {
    }) {
      this.say = say;
      this.log = log;
      __publicField(this, "pendingArea", null);
      __publicField(this, "lastOptions", []);
      /** The standard the last options list belongs to. */
      __publicField(this, "optionsStandard", "");
      __publicField(this, "marked", []);
      /** Phrases still waiting in a multi-finding sentence, and what's been said back so far. */
      __publicField(this, "queue", []);
      __publicField(this, "batch", []);
      __publicField(this, "batchSpoken", 0);
      /** Guess Unit / Outside from the selected room instead of asking. */
      __publicField(this, "autoArea", true);
      /** Optional Jev helper for phrases the local matcher can't settle. */
      __publicField(this, "jev", null);
      /** Where the last decision came from, for the log and tests. */
      __publicField(this, "lastSource", "local");
      /** Reviewed phrases loaded from learned.json; checked before anything else. */
      __publicField(this, "learned", []);
      /** Called for every learning event, e.g. to sync. Events are also kept in localStorage. */
      __publicField(this, "onLearn", null);
      __publicField(this, "said", "");
      /** Today's date, replaceable in tests. Used to drop heating options for the wrong season. */
      __publicField(this, "today", () => /* @__PURE__ */ new Date());
      __publicField(this, "unsure", null);
    }
    standardSelect() {
      return labeledControl(/jump to standard/i);
    }
    roomSelect() {
      return labeledControl(/current room/i);
    }
    comments() {
      return labeledControl(/inspector comments/i);
    }
    currentStandard() {
      const s = this.standardSelect();
      return s?.selectedOptions[0]?.text.replace(/^\d+\.\s*/, "") ?? "";
    }
    describe() {
      const s = this.standardSelect();
      const room = this.roomSelect()?.selectedOptions[0]?.text ?? "";
      const kinds = new Set(findings().map((f) => f.text)).size;
      const num = s ? s.selectedIndex + 1 : 0;
      return `${room ? room + ". " : ""}${num}. ${this.currentStandard()}. ${kinds} possible finding${kinds === 1 ? "" : "s"}.`;
    }
    async handle(heard) {
      const t = norm2(heard);
      this.log(`heard: ${t}`);
      const reply = await this.route(t, heard);
      this.log(`reply: ${reply}`);
      this.say(reply);
      return reply;
    }
    async route(t, raw) {
      if (!t) return "Didn't catch that.";
      if (this.pendingArea && AREAS.includes(t)) {
        const choice = this.pendingArea.find((f) => f.area === t);
        this.pendingArea = null;
        const r = choice ? this.mark(choice, this.inBatch()) : `No ${t} option for that finding.`;
        return this.inBatch() ? this.runQueue(r) : r;
      }
      this.pendingArea = null;
      if (AREAS.includes(t)) return `No question is waiting for an area. Say the finding first.`;
      this.queue = [];
      this.batch = [];
      this.batchSpoken = 0;
      if (["next", "next standard", "next item", "skip"].includes(t)) return this.step("Next");
      if (["previous", "prev", "back", "go back", "previous standard"].includes(t)) return this.step("Prev");
      if (["where am i", "repeat", "say again", "what standard"].includes(t)) return this.describe();
      if (["undo", "scratch that", "remove that", "undo that"].includes(t)) return this.undo();
      if (["options", "read options", "what can i mark", "list"].includes(t)) return this.readOptions();
      if (["photo", "take photo", "take a photo", "picture"].includes(t)) return "Tap Photo on the screen. Browsers only open the camera from a tap.";
      const num = /^(?:number|option) (\d+|one|two|three|four|five|six|seven|eight)$/.exec(t);
      if (num) return this.pickOption(num[1]);
      const go = /^(?:go to|jump to|open|standard) (.+)$/.exec(t);
      if (go) return await this.jumpTo(go[1]) ?? `I couldn't find a standard called ${go[1]}.`;
      const room = /^(?:room|in room|switch to) (.+)$/.exec(t);
      if (room) return this.chooseRoom(room[1]);
      const note = /^(?:comment|note|add comment|add note)\s+(.+)$/i.exec(raw.trim());
      if (note) return this.addComment(note[1]);
      return this.processFindings(t);
    }
    inBatch() {
      return this.queue.length > 0 || this.batch.length > 0;
    }
    /** Room prefix, then one or several findings. */
    async processFindings(t) {
      let rest = t;
      let roomSaid = "";
      const room = this.roomPrefix(t);
      if (room) {
        roomSaid = this.chooseRoomOption(room.option) + " ";
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
    async runQueue(lastReply) {
      if (lastReply) this.batch.push(lastReply);
      while (this.queue.length) {
        const part = this.queue.shift();
        const r = await this.markFromSpeech(part, true);
        if (this.pendingArea) {
          const fresh2 = this.batch.slice(this.batchSpoken);
          this.batchSpoken = this.batch.length;
          return [...fresh2, r].join(" ");
        }
        this.batch.push(r);
      }
      const isFinding = (x) => !/^(Room:|Couldn't|Already|No |That )/.test(x);
      const count = this.batch.filter(isFinding).length;
      const fresh = this.batch.slice(this.batchSpoken);
      const room = fresh.filter((x) => x.startsWith("Room:"));
      const rest = fresh.filter((x) => !x.startsWith("Room:"));
      this.batch = [];
      this.batchSpoken = 0;
      return [...room, count > 1 ? `Recorded ${count}.` : "", ...rest].filter(Boolean).join(" ");
    }
    /** Splits a sentence into findings, but only where each piece names something to inspect. */
    splitFindings(t) {
      const pieces = t.split(SEPARATORS).map((x) => x.trim()).filter(Boolean);
      const merged = [];
      for (const piece of pieces) {
        if (merged.length && !this.matchStandard(piece)) merged[merged.length - 1] += " and " + piece;
        else merged.push(piece);
      }
      if (merged.length > 1) return merged;
      const hits = this.standardMentions(t);
      if (hits.length < 2) return [t];
      const words = t.split(" ");
      const out = [];
      hits.forEach((h, i) => {
        const start = i === 0 ? 0 : h.word;
        const end = i + 1 < hits.length ? hits[i + 1].word : words.length;
        out.push(words.slice(start, end).join(" "));
      });
      return out.filter(Boolean);
    }
    /** Where standards are named in the sentence, longest phrases first, no overlaps. */
    standardMentions(t) {
      const sel = this.standardSelect();
      if (!sel) return [];
      const words = t.split(" ");
      const found = [];
      for (const o of [...sel.options]) {
        const name = o.text.replace(/^\d+\.\s*/, "");
        const phrases = [name.toLowerCase().replace(/\s*-\s*/g, " "), ...STANDARD_ALIASES[name.toLowerCase()] ?? []];
        for (const p of phrases.map(norm2)) {
          const pw = p.split(" ");
          for (let i = 0; i + pw.length <= words.length; i++) {
            if (pw.every((w, k) => words[i + k] === w)) found.push({ word: i, len: pw.length, name });
          }
        }
      }
      found.sort((a, b) => b.len - a.len);
      const taken = /* @__PURE__ */ new Set();
      const keep = [];
      for (const f of found) {
        const span = Array.from({ length: f.len }, (_, k) => f.word + k);
        if (span.some((w) => taken.has(w))) continue;
        span.forEach((w) => taken.add(w));
        keep.push({ word: f.word, name: f.name });
      }
      keep.sort((a, b) => a.word - b.word);
      return keep.filter((k, i) => i === 0 || k.name !== keep[i - 1].name || k.word - keep[i - 1].word > 3);
    }
    /** "kitchen outlet dead" -> the Kitchen room, if that room exists. */
    roomPrefix(t) {
      const sel = this.roomSelect();
      if (!sel) return null;
      let best = null;
      for (const o of [...sel.options]) {
        if (!o.value) continue;
        const full = norm2(o.text.replace(/\s*·.*$/, ""));
        const base = full.replace(/\s+\d+$/, "");
        for (const cand of [full, base]) {
          if ((t === cand || t.startsWith(cand + " ")) && (!best || cand.length > best.length)) {
            if (cand === base && cand !== full && [...sel.options].filter((x) => norm2(x.text).startsWith(base)).length > 1) continue;
            best = { option: o, length: cand.length };
          }
        }
      }
      return best;
    }
    chooseRoomOption(o) {
      const sel = this.roomSelect();
      if (sel && sel.value !== o.value) setNativeValue(sel, o.value);
      return `Room: ${o.text.replace(/\s*·.*$/, "")}.`;
    }
    async jevPickStandard(t) {
      const sel = this.standardSelect();
      if (!this.jev || !sel) return null;
      const names = [...sel.options].map((o) => o.text.replace(/^\d+\.\s*/, ""));
      const options = {};
      names.forEach((n, i) => {
        options[`s${i}`] = n;
      });
      const res = await this.jev({
        said: t,
        room: this.roomLabel(),
        question: "Which HUD NSPIRE inspection standard is the inspector describing a problem with?",
        options
      });
      this.log(`jev standard: ${JSON.stringify(res)}`);
      if (!res || res.choice === "none") return null;
      return (res.probabilities[res.choice] ?? 0) >= JEV_STANDARD_ACT ? options[res.choice] ?? null : null;
    }
    async jevPickFinding(t, texts) {
      if (!this.jev || !texts.length) return null;
      const options = {};
      const byKey = {};
      texts.forEach((x, i) => {
        byKey[`d${i + 1}`] = x;
        const ex = this.learned.filter((l) => l.deficiency === x).slice(0, 5).map((l) => `"${l.phrase}"`);
        options[`d${i + 1}`] = ex.length ? `${x} Inspectors also say: ${ex.join(", ")}.` : x;
      });
      const res = await this.jev({
        said: t,
        room: this.roomLabel(),
        standard: this.currentStandard(),
        question: "Which HUD NSPIRE deficiency best matches what the inspector said about this standard?",
        options
      });
      this.log(`jev finding: ${JSON.stringify(res)}`);
      if (!res) return null;
      const ranked = Object.entries(res.probabilities).filter(([k]) => k !== "none").sort((a, b) => b[1] - a[1]);
      const [first, second] = ranked;
      if (!first || res.choice === "none") return null;
      if (first[1] >= JEV_ACT && first[1] - (second?.[1] ?? 0) >= JEV_MARGIN) return { sure: byKey[first[0]] };
      const maybe = ranked.filter(([, p]) => p >= 0.2).slice(0, 2).map(([k]) => byKey[k]).filter(Boolean);
      return maybe.length ? { maybe } : null;
    }
    // ---------- learning loop ----------
    learnedFor(t) {
      let best = null;
      for (const l of this.learned) if (hasPhrase(t, l.phrase) && (!best || l.phrase.length > best.phrase.length)) best = l;
      return best;
    }
    async loadLearned(url = "/learned.json") {
      try {
        const r = await fetch(url);
        if (!r.ok) return 0;
        const data = await r.json();
        this.learned = (data.aliases ?? []).filter((a) => a.phrase && a.standard && a.deficiency).map((a) => ({ ...a, phrase: norm2(a.phrase) }));
        return this.learned.length;
      } catch {
        return 0;
      }
    }
    noteUnsure(outcome) {
      if (!this.said) return;
      this.unsure = { said: this.said, room: this.roomLabel(), standard: this.currentStandard(), at: Date.now() };
      this.learn({ at: "", said: this.said, room: this.unsure.room, standard: this.unsure.standard, outcome });
    }
    learn(e) {
      const ev = { ...e, at: (/* @__PURE__ */ new Date()).toISOString(), said: redactPhrase(e.said).slice(0, 200), room: e.room.slice(0, 60) };
      try {
        const all = JSON.parse(localStorage.getItem(LEARN_KEY) ?? "[]");
        all.push(ev);
        const trimmed = all.slice(-LEARN_MAX);
        localStorage.setItem(LEARN_KEY, JSON.stringify(trimmed));
        if (all.length > LEARN_MAX) {
          const sent = Number(localStorage.getItem(LEARN_SENT_KEY) ?? "0");
          localStorage.setItem(LEARN_SENT_KEY, String(Math.max(0, sent - (all.length - LEARN_MAX))));
        }
      } catch {
      }
      this.onLearn?.(ev);
    }
    /** Everything logged on this device, for export or review. */
    learningLog() {
      try {
        return JSON.parse(localStorage.getItem(LEARN_KEY) ?? "[]");
      } catch {
        return [];
      }
    }
    /** Sends events not yet sent to the app's /api/learn route. Safe to call often. */
    async syncLearning(url = "/api/learn") {
      const all = this.learningLog();
      const sent = Number(localStorage.getItem(LEARN_SENT_KEY) ?? "0");
      const fresh = all.slice(sent);
      if (!fresh.length || typeof navigator !== "undefined" && navigator.onLine === false) return 0;
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: fresh }) });
        if (!r.ok) return 0;
        localStorage.setItem(LEARN_SENT_KEY, String(all.length));
        return fresh.length;
      } catch {
        return 0;
      }
    }
    roomLabel() {
      return this.roomSelect()?.selectedOptions[0]?.text.replace(/\s*·.*$/, "") ?? "";
    }
    roomNames() {
      const sel = this.roomSelect();
      return sel ? [...sel.options].filter((o) => o.value).map((o) => norm2(o.text.replace(/\s*·.*$/, ""))) : [];
    }
    currentRoomArea() {
      const o = this.roomSelect()?.selectedOptions[0];
      return o && o.value ? areaForRoomName(o.text) : null;
    }
    async step(which) {
      const b = buttonByText(which);
      if (!b) return `I can't find the ${which === "Next" ? "next" : "previous"} button here.`;
      b.click();
      await wait(150);
      return this.describe();
    }
    matchStandard(t) {
      const sel = this.standardSelect();
      if (!sel) return null;
      let best = null;
      for (const o of [...sel.options]) {
        const name = o.text.replace(/^\d+\.\s*/, "");
        const phrases = [name.toLowerCase().replace(/\s*-\s*/g, " "), ...STANDARD_ALIASES[name.toLowerCase()] ?? []];
        for (const p of phrases) {
          if (hasPhrase(t, p)) {
            const score = norm2(p).length;
            if (!best || score > best.score) best = { value: o.value, name, score, phrase: norm2(p) };
          }
        }
      }
      return best;
    }
    async jumpTo(spoken) {
      const m = this.matchStandard(spoken);
      const sel = this.standardSelect();
      if (!m || !sel) return null;
      if (sel.value !== m.value) {
        setNativeValue(sel, m.value);
        await wait(150);
      }
      return this.describe();
    }
    chooseRoom(spoken) {
      const sel = this.roomSelect();
      if (!sel) return "I can't find the room list.";
      const want = tokens(spoken);
      let best = null;
      let bestScore = 0;
      for (const o of [...sel.options]) {
        const have = tokens(o.text);
        const score = want.filter((w) => have.includes(w)).length;
        if (score > bestScore) {
          best = o;
          bestScore = score;
        }
      }
      if (!best) return `No room called ${spoken}. Add it on screen first.`;
      return this.chooseRoomOption(best);
    }
    addComment(text) {
      const el = this.comments();
      if (!el) return "I can't find the comments box.";
      const clean = text.trim().replace(/^\w/, (c) => c.toUpperCase());
      setNativeValue(el, el.value ? `${el.value.trimEnd()} ${clean}${/[.!?]$/.test(clean) ? "" : "."}` : `${clean}${/[.!?]$/.test(clean) ? "" : "."}`);
      return "Comment added.";
    }
    readOptions() {
      const kinds = [...new Set(findings().filter((f) => inSeason(f.text, this.today())).map((f) => f.text))];
      this.optionsStandard = this.currentStandard();
      this.lastOptions = kinds;
      if (!kinds.length) return "No findings listed for this standard.";
      return kinds.slice(0, 8).map((k, i) => `${i + 1}: ${trimDot(k.split(" ").slice(0, 9).join(" "))}`).join(". ") + ". Say number and the option.";
    }
    async pickOption(n) {
      const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
      const i = (words[n] ?? parseInt(n, 10)) - 1;
      const text = this.lastOptions[i];
      if (!text) return "Say options first, then pick a number.";
      if (this.optionsStandard && this.optionsStandard !== this.currentStandard()) await this.jumpTo(this.optionsStandard);
      const group = findings().filter((f) => f.text === text);
      if (!group.length) return "That option is gone. Say options again.";
      if (this.unsure && Date.now() - this.unsure.at < 12e4) {
        const { said, room } = this.unsure;
        this.learn({ at: "", said, room, outcome: "corrected", chosen: text, standard: this.currentStandard() });
        this.unsure = null;
      }
      return this.chooseArea(group, null, this.autoArea ? this.currentRoomArea() : null);
    }
    async markFromSpeech(t, inBatch = false) {
      this.said = t;
      const hqs = translateHqs(t);
      if (hqs.retired) return hqs.retired;
      const known = this.learnedFor(t);
      if (known) {
        if (known.standard !== this.currentStandard()) await this.jumpTo(known.standard);
        const group = findings().filter((f) => f.text === known.deficiency);
        if (group.length) {
          this.lastSource = "learned";
          const spokenAreaL = AREAS.find((a) => t.split(" ").includes(a));
          return this.chooseArea(group, spokenAreaL ?? null, this.autoArea ? this.currentRoomArea() : null, inBatch);
        }
      }
      let named = this.matchStandard(t);
      if (!named && hqs.standard) named = this.matchStandard(hqs.standard);
      if (named && named.name !== this.currentStandard()) {
        await this.jumpTo(named.name);
      }
      const spokenArea = AREAS.find((a) => t.split(" ").includes(a));
      const roomArea = this.autoArea ? this.currentRoomArea() : null;
      if (hqs.askFirst && !inBatch) {
        this.noteUnsure("ambiguous");
        return `${hqs.askFirst} ${this.readOptions()}`;
      }
      const all = findings().filter((f) => inSeason(f.text, this.today()));
      if (!all.length) return inBatch ? `Couldn't place "${t}".` : `No findings to mark on ${this.currentStandard() || "this screen"}.`;
      const spoken = tokens(t).filter((w) => !AREAS.includes(w));
      const expanded = new Set(spoken.flatMap((w) => [w, ...WORD_SYNONYMS[w] ?? []]));
      hqs.hint.forEach((w) => expanded.add(w));
      const naming = new Set((named?.phrase ?? "").split(" ").filter(Boolean).flatMap((w) => [w, ...WORD_SYNONYMS[w] ?? []]));
      const said = new Set(spoken.filter((w) => !naming.has(w)).flatMap((w) => [w, ...WORD_SYNONYMS[w] ?? []]));
      if (t.includes("not working") || t.includes("doesn't work") || t.includes("does not work")) {
        ["inoperable", "function", "produce", "operate"].forEach((w) => expanded.add(w));
      }
      const byText = /* @__PURE__ */ new Map();
      all.forEach((f) => byText.set(f.text, [...byText.get(f.text) ?? [], f]));
      const optionWords = [...byText.keys()].map((text) => new Set(tokens(text)));
      const common = optionWords.length > 1 ? new Set([...optionWords[0]].filter((w) => optionWords.every((o) => o.has(w)))) : /* @__PURE__ */ new Set();
      const scored = [...byText.entries()].map(([text, group]) => {
        const words = [...new Set(tokens(text))].filter((w) => !common.has(w));
        const hits = words.filter((w) => expanded.has(w)).reduce((sum, w) => sum + (WEAK.has(w) || naming.has(w) && !said.has(w) ? 0.3 : 1), 0);
        return { text, group, score: words.length ? hits / Math.sqrt(words.length) : 0 };
      }).sort((a, b) => b.score - a.score);
      if (scored[1] && scored[0].score > 0 && scored[1].score >= scored[0].score * 0.75) {
        const pair = [scored[0], scored[1]];
        const only = pair.find((x) => /\bonly 1\b/i.test(x.text));
        const elsewhere = pair.find((x) => /\belsewhere\b/i.test(x.text));
        const baths = this.roomNames().filter((n) => /\bbath/.test(n)).length;
        if (only && elsewhere && baths > 0) {
          const pick = baths === 1 ? only : elsewhere;
          scored.splice(scored.indexOf(pick), 1);
          scored.unshift({ ...pick, score: pick.score + 1 });
        }
      }
      let top = scored[0];
      const close = !!(scored[1] && top && scored[1].score >= top.score * 0.75);
      this.lastSource = "local";
      if (this.jev && !(top && top.score > 0 && !close)) {
        if ((!top || top.score === 0) && !named) {
          const std = await this.jevPickStandard(t);
          if (std && std !== this.currentStandard()) await this.jumpTo(std);
        }
        const groups = /* @__PURE__ */ new Map();
        findings().filter((f) => inSeason(f.text, this.today())).forEach((f) => groups.set(f.text, [...groups.get(f.text) ?? [], f]));
        let pick = await this.jevPickFinding(t, [...groups.keys()]);
        if (!pick && named) {
          const std = await this.jevPickStandard(t);
          if (std && std !== this.currentStandard()) {
            await this.jumpTo(std);
            groups.clear();
            findings().filter((f) => inSeason(f.text, this.today())).forEach((f) => groups.set(f.text, [...groups.get(f.text) ?? [], f]));
            pick = await this.jevPickFinding(t, [...groups.keys()]);
          }
        }
        if (pick?.sure) {
          this.lastSource = "jev";
          return this.chooseArea(groups.get(pick.sure) ?? [], spokenArea ?? null, roomArea, inBatch);
        }
        if (pick?.maybe && !inBatch) {
          this.lastSource = "jev";
          this.optionsStandard = this.currentStandard();
          this.lastOptions = pick.maybe;
          this.noteUnsure("ambiguous");
          const short = pick.maybe.map((k) => trimDot(shorten(k, 9)));
          const said2 = new Set(short).size === short.length ? short : pick.maybe.map(trimDot);
          return `Did you mean ${said2.map((k, i) => `${i + 1}: ${k}`).join(", or ")}? Say number and the option.`;
        }
        if (groups.size && !scored.some((x) => groups.has(x.text))) {
          scored.length = 0;
          groups.forEach((group, text) => scored.push({ text, group, score: 0 }));
          top = scored[0];
        }
      }
      if (!top || top.score === 0) {
        if (scored.length === 1 && named) return this.chooseArea(scored[0].group, spokenArea ?? null, roomArea, inBatch);
        this.noteUnsure("unmatched");
        if (inBatch) return `Couldn't place "${t}".`;
        this.optionsStandard = this.currentStandard();
        this.lastOptions = scored.map((s) => s.text);
        if (scored.length > 4) return `I'm on ${this.currentStandard()}, but couldn't match that. Say options to hear the list.`;
        return `I'm on ${this.currentStandard()}, but couldn't match that. ${this.readOptions()}`;
      }
      if (scored[1] && scored[1].score === top.score) {
        this.noteUnsure("ambiguous");
        if (inBatch) return `Couldn't place "${t}". Say it again on its own.`;
        this.optionsStandard = this.currentStandard();
        this.lastOptions = scored.filter((s) => s.score === top.score).map((s) => s.text);
        return `That could be more than one. ${this.lastOptions.slice(0, 4).map((k, i) => `${i + 1}: ${trimDot(k.split(" ").slice(0, 9).join(" "))}`).join(". ")}. Say number and the option.`;
      }
      return this.chooseArea(top.group, spokenArea ?? null, roomArea, inBatch);
    }
    /**
     * Area order of preference: what the inspector said, then the room's likely area,
     * then the only option. Otherwise ask. A spoken area that doesn't apply is an error;
     * a room guess that doesn't apply just falls back to asking.
     */
    chooseArea(group, spoken, fromRoom = null, short = false) {
      if (!group.length) return "That option is gone. Say options again.";
      if (spoken) {
        const pick2 = group.find((f) => f.area === spoken);
        return pick2 ? this.mark(pick2, short) : `That finding isn't recorded under ${spoken} here. It applies to ${group.map((g) => g.area).join(" or ")}.`;
      }
      const pick = fromRoom && group.find((f) => f.area === fromRoom) || (group.length === 1 ? group[0] : null);
      if (pick) return this.mark(pick, short);
      this.pendingArea = group;
      return `${trimDot(group[0].text)}. Which area: ${group.map((g) => g.area).join(" or ")}?`;
    }
    mark(f, short = false) {
      const area = f.area[0].toUpperCase() + f.area.slice(1);
      if (f.recorded) return `Already recorded: ${f.area}, ${trimDot(shorten(f.text))}.`;
      f.button.click();
      this.unsure = null;
      if (this.lastSource === "jev" && this.said) {
        this.learn({ at: "", said: this.said, room: this.roomLabel(), standard: this.currentStandard(), outcome: "jev", chosen: f.text, area: f.area });
      }
      this.marked.push({ standard: this.currentStandard(), room: this.roomSelect()?.value ?? "", area: f.area, text: f.text });
      if (short) return `${area}, ${trimDot(shorten(f.text))}, ${SEVERITY_SHORT[f.severity] ?? "recorded"}.`;
      const sev = SEVERITY[f.severity];
      return `${area}: ${trimDot(f.text)}.${sev ? " " + sev + "." : ""}`;
    }
    async undo() {
      const last = this.marked.pop();
      if (!last) return "Nothing to undo.";
      const roomSel = this.roomSelect();
      if (roomSel && roomSel.value !== last.room) {
        setNativeValue(roomSel, last.room);
        await wait(150);
      }
      if (this.currentStandard() !== last.standard) await this.jumpTo(last.standard);
      const f = findings().find((x) => x.area === last.area && x.text === last.text && x.recorded);
      if (!f) return "That finding is already removed.";
      f.button.click();
      return `Removed: ${last.area}, ${trimDot(shorten(last.text))}.`;
    }
  };
  var HeadsetSession = class {
    constructor(log = () => {
    }) {
      __publicField(this, "pilot");
      /** Optional Kokoro clip voice; the browser voice is used when it can't say something. */
      __publicField(this, "speaker", null);
      __publicField(this, "enabled", false);
      __publicField(this, "listening", false);
      __publicField(this, "audio", null);
      __publicField(this, "presses", 0);
      __publicField(this, "timer");
      __publicField(this, "rec", null);
      __publicField(this, "onChange", () => {
      });
      /** Runs when headset mode turns off, e.g. to sync learning events. */
      __publicField(this, "onDisable", () => {
      });
      /** While set (during setup), headset presses are reported here instead of acting. */
      __publicField(this, "buttonTest", null);
      /** Skip the spoken "Headset on" (setup speaks its own lines). */
      __publicField(this, "quietEnable", false);
      this.pilot = new VoicePilot((t) => this.speak(t), log);
    }
    speak(text) {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      const sp = this.speaker;
      if (sp) {
        sp.stop();
        void sp.say(text).then((ok) => {
          if (!ok) this.browserSpeak(text);
        });
        return;
      }
      this.browserSpeak(text);
    }
    browserSpeak(text) {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 1.05;
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
        ms.metadata = new MediaMetadata({ title: "NSPIRE headset mode", artist: "HACSM practice" });
        const onPress = () => {
          this.press();
          this.keepPlaying();
        };
        ms.setActionHandler("play", onPress);
        ms.setActionHandler("pause", onPress);
        ms.setActionHandler("nexttrack", () => {
          void this.pilot.handle("next");
        });
        ms.setActionHandler("previoustrack", () => {
          void this.pilot.handle("previous");
        });
        ms.playbackState = "playing";
      }
      this.enabled = true;
      this.onChange();
      if (!this.quietEnable) this.speak("Headset on. " + this.pilot.describe());
    }
    disable() {
      this.audio?.pause();
      const ms = navigator.mediaSession;
      if (ms) {
        ["play", "pause", "nexttrack", "previoustrack"].forEach((a) => ms.setActionHandler(a, null));
        ms.playbackState = "none";
      }
      this.rec?.stop();
      this.enabled = false;
      this.onChange();
      this.onDisable();
    }
    keepPlaying() {
      this.audio?.play().catch(() => void 0);
      if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
    }
    /** Same as a headset button press; also used by tests. */
    simulatePress() {
      this.press();
    }
    press() {
      this.presses += 1;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        const n = this.presses;
        this.presses = 0;
        if (this.buttonTest) {
          this.buttonTest(n);
          return;
        }
        if (n === 1) this.listen();
        else if (n === 2) void this.pilot.handle("next");
        else void this.pilot.handle("where am i");
      }, 450);
    }
    listen() {
      if (this.listening) {
        this.rec?.stop();
        return;
      }
      const W = window;
      const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
      if (!Ctor) {
        this.speak("This browser can't do speech recognition.");
        return;
      }
      window.speechSynthesis?.cancel();
      this.speaker?.stop();
      this.audio?.pause();
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        void this.pilot.handle(e.results[0][0].transcript);
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech") this.speak("Didn't catch that.");
        else if (e.error === "network") this.speak("Speech needs a connection.");
      };
      rec.onend = () => {
        this.listening = false;
        this.keepPlaying();
        this.onChange();
      };
      this.rec = rec;
      this.listening = true;
      this.onChange();
      rec.start();
    }
  };
  function silentWav(seconds = 1, rate = 8e3) {
    const n = seconds * rate;
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const s = (o, x) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    s(0, "RIFF");
    v.setUint32(4, 36 + n, true);
    s(8, "WAVE");
    s(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate, true);
    v.setUint16(32, 1, true);
    v.setUint16(34, 8, true);
    s(36, "data");
    v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }

  // clipSpeaker.ts
  var MAX_PHRASE_WORDS = 70;
  var GAP_SECONDS = 0.06;
  function planClips(text, has2) {
    const words = norm2(text).split(" ").filter(Boolean);
    const n = words.length;
    if (!n) return null;
    const best = Array(n + 1).fill(null);
    best[n] = [];
    for (let i = n - 1; i >= 0; i--) {
      for (let j = Math.min(n, i + MAX_PHRASE_WORDS); j > i; j--) {
        const rest = best[j];
        if (!rest) continue;
        const key = words.slice(i, j).join(" ");
        if (has2(key) && (!best[i] || rest.length + 1 < best[i].length)) best[i] = [key, ...rest];
      }
    }
    return best[0];
  }
  var ClipSpeaker = class _ClipSpeaker {
    constructor(base, manifest) {
      this.base = base;
      this.manifest = manifest;
      __publicField(this, "ctx", null);
      __publicField(this, "buffers", /* @__PURE__ */ new Map());
      __publicField(this, "playing", []);
    }
    static async load(base = "/voice") {
      try {
        const r = await fetch(`${base}/manifest.json`);
        if (!r.ok) return null;
        return new _ClipSpeaker(base, await r.json());
      } catch {
        return null;
      }
    }
    get size() {
      return Object.keys(this.manifest.clips).length;
    }
    canSay(text) {
      return planClips(text, (k) => k in this.manifest.clips) !== null;
    }
    /** Call from a tap (browsers only start audio after one). Optionally preload every clip. */
    unlock(preloadAll = false) {
      this.ctx ?? (this.ctx = new AudioContext());
      void this.ctx.resume();
      if (preloadAll) Object.keys(this.manifest.clips).forEach((k) => void this.buffer(k).catch(() => void 0));
    }
    buffer(key) {
      let p = this.buffers.get(key);
      if (!p) {
        const ctx = this.ctx;
        p = fetch(`${this.base}/${this.manifest.clips[key]}`).then((r) => {
          if (!r.ok) throw new Error(`clip ${r.status}`);
          return r.arrayBuffer();
        }).then((b) => ctx.decodeAudioData(b));
        p.catch(() => this.buffers.delete(key));
        this.buffers.set(key, p);
      }
      return p;
    }
    stop() {
      this.playing.forEach((s) => {
        try {
          s.stop();
        } catch {
        }
      });
      this.playing = [];
    }
    /** Returns false if it couldn't say it with clips; the caller then uses the browser voice. */
    async say(text) {
      const plan = planClips(text, (k) => k in this.manifest.clips);
      if (!plan) return false;
      this.unlock();
      const ctx = this.ctx;
      let bufs;
      try {
        bufs = await Promise.all(plan.map((k) => this.buffer(k)));
      } catch {
        return false;
      }
      this.stop();
      let at = ctx.currentTime + 0.02;
      for (const b of bufs) {
        const src = ctx.createBufferSource();
        src.buffer = b;
        src.connect(ctx.destination);
        src.start(at);
        this.playing.push(src);
        at += b.duration + GAP_SECONDS;
      }
      return true;
    }
  };

  // tools/bundle_entry.ts
  window.VoicePilotLib = { VoicePilot, HeadsetSession, jevViaProxy, norm: norm2, inSeason, ClipSpeaker, planClips, HQS: { HQS_ITEMS, HQS_PHRASES, HQS_RETIRED, translateHqs } };
})();
