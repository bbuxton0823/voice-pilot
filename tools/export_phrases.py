"""Collect every phrase Voice Pilot can say, straight from the live app.

Opens the NSPIRE practice app, walks all 63 standards, and records each deficiency
in the full, 8-word and 9-word forms the pilot speaks, plus the pilot's fixed phrases,
room names and numbers. Keys are normalized by the pilot's own norm() in the page,
so they match exactly what the clip player looks up.

  pip install playwright && playwright install chromium
  python export_phrases.py --app https://hacsm-nspire-practice.vercel.app --out phrases.json
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright
import os
APP_URL = os.environ.get("APP_URL", "https://hacsm-nspire-practice.vercel.app")

HERE = Path(__file__).resolve().parent
BUNDLE = HERE.parent / "voicePilot.bundle.js"

FIXED = [
    "Unit", "Inside", "Outside", "Which area", "Unit or inside", "Unit or outside", "Inside or outside",
    "Unit or inside or outside", "Life-threatening, 24 hours", "Severe, 30 days", "Moderate, 30 days",
    "Low, recorded only", "Life-threatening", "Severe", "Moderate", "Low", "Recorded", "Room",
    "Unit / building / outside", "Possible finding", "Possible findings", "Did you mean", "Or",
    "Say number and the option", "Already recorded", "Removed", "Nothing to undo", "Didn't catch that",
    "Comment added", "Headset on", "Couldn't place", "Say it again on its own", "I'm on",
    "But couldn't match that", "Say options to hear the list", "That could be more than one",
    "Tap Photo on the screen", "Browsers only open the camera from a tap", "No findings listed for this standard",
    "That finding is already removed", "Speech needs a connection", "That option is gone", "Say options again",
    "Say options first, then pick a number", "This browser can't do speech recognition",
]
ROOMS = ([f"Bedroom {i}" for i in range(1, 7)] + [f"Bathroom {i}" for i in range(1, 5)] +
         [f"Kitchen {i}" for i in range(1, 3)] + [f"Shared kitchen {i}" for i in range(1, 3)] +
         [f"Shared bathroom {i}" for i in range(1, 4)] +
         ["Rented room", "Hallway", "Living room", "Dining room", "Laundry", "Front yard", "Back yard", "Porch", "Garage"])
NUMBERS = [str(n) for n in range(1, 64)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", default=APP_URL)
    ap.add_argument("--out", default="phrases.json")
    ap.add_argument("--catalog", default="catalog.json", help="standards and their deficiencies, for the AI labeler")
    a = ap.parse_args()
    texts: list[str] = FIXED + ROOMS + NUMBERS
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(service_workers="block")
        pg = ctx.new_page()
        pg.goto(a.app.rstrip("/") + "/inspect/new/", wait_until="networkidle")
        pg.wait_for_timeout(1500)
        pg.add_script_tag(content=BUNDLE.read_text())
        found = pg.evaluate("""async () => {
            const p = new VoicePilotLib.VoicePilot(() => {});
            const sel = p.standardSelect();
            const out = [];
            const catalog = {};
            for (const o of [...sel.options]) {
                out.push(o.text.replace(/^\\d+\\.\\s*/, ''));
                await p.handle('go to ' + o.text.replace(/^\\d+\\.\\s*/, ''));
                if (sel.value !== o.value) {
                    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, o.value);
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 150));
                }
                const defs = [...document.querySelectorAll('button[aria-label]')]
                  .map(b => /^(?:Record|Remove) \\w+ finding: (.*)$/.exec(b.getAttribute('aria-label') || ''))
                  .filter(Boolean).map(m => m[1].trim());
                catalog[o.text.replace(/^\\d+\\.\\s*/, '')] = [...new Set(defs)];
                for (const d of new Set(defs)) {
                    const clean = d.replace(/[.\\s]+$/, '');
                    out.push(clean, clean.split(' ').slice(0, 8).join(' ').replace(/[.\\s]+$/, ''),
                             clean.split(' ').slice(0, 9).join(' ').replace(/[.\\s]+$/, ''));
                }
            }
            return { out, catalog };
        }""")
        texts += found["out"]
        # Explanations for retired HQS items and "ask first" phrases (hqsCrosswalk.ts).
        texts += pg.evaluate("""() => [...VoicePilotLib.HQS.HQS_RETIRED.map(r => r.explain),
            ...VoicePilotLib.HQS.HQS_PHRASES.filter(p => p.askFirst).map(p => p.askFirst),
            'No question is waiting for an area', 'Say the finding first']""")
        Path(a.catalog).write_text(json.dumps(found["catalog"], indent=1, ensure_ascii=False))
        keyed = pg.evaluate("ts => ts.map(t => [VoicePilotLib.norm(t), t])", texts)
        b.close()
    phrases: dict[str, str] = {}
    for key, text in keyed:
        if key and key not in phrases:
            phrases[key] = text
    Path(a.out).write_text(json.dumps(phrases, indent=1, ensure_ascii=False))
    print(f"{len(phrases)} phrases -> {a.out}; catalog -> {a.catalog}")


if __name__ == "__main__":
    main()
