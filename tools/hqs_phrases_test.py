from playwright.sync_api import sync_playwright
import os
APP_URL = os.environ.get("APP_URL", "https://hacsm-nspire-practice.vercel.app")
script=open(str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'voicePilot.bundle.js')).read()
cases=[("heater not working","64 degrees"),("furnace doesn't work","permanently installed heating source"),("missing knockouts in the panel","exposed conductor"),("burner knob missing","Cooking"),("no TPR discharge line","discharge piping is missing"),
 ("toilet loose at the base","Toilet"),("refrigerator gasket torn","Refrigerator"),("outlet cover plate cracked","Cover plates depend"),
 ("cracked window pane","isn't recorded"),("2.10 stove doesn't work","Cooking"),("site and neighborhood","aren't part of NSPIRE"),
 ("peeling paint in the kitchen","Lead"),("space heater only","Portable heat"),("trash in the yard","Litter"),("bathroom fan doesn't work","Ventilation"),
 ("window won't stay up","Window"),("double tapped breaker","aren't named")]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(service_workers="block"); pg=ctx.new_page()
    pg.goto(APP_URL.rstrip("/")+"/inspect/new/", wait_until="networkidle"); pg.wait_for_timeout(1200)
    pg.add_script_tag(content=script); pg.evaluate("window.__p=new VoicePilotLib.VoicePilot(()=>{})")
    ok=0
    for said,expect in cases:
        r=pg.evaluate(f"window.__p.handle({said!r})"); std=pg.evaluate("window.__p.currentStandard()")
        good = expect.lower() in (r+" "+std).lower(); ok+=good
        print(("PASS " if good else "FAIL ")+f"> {said}\n     [{std}] {r[:170]}")
        if "Which area" in r: pg.evaluate("window.__p.handle('unit')")
    print(f"{ok}/{len(cases)}")
    b.close()
