import sys
from playwright.sync_api import sync_playwright
import os
APP_URL = os.environ.get("APP_URL", "https://hacsm-nspire-practice.vercel.app")
script=open(sys.argv[1] if len(sys.argv)>1 else 'voicePilot.bundle.js').read()
steps=[
 ("kitchen outlet dead and gfci doesn't trip and cabinet door broken", ["Room: Kitchen 1. Recorded 3","Unit, Outlet does not","Unit, GFCI","Unit, Storage component"]),
 ("bedroom smoke alarm missing", ["Room: Bedroom 1","Unit: Smoke alarm is not installed","Life-threatening"]),
 ("window won't lock", ["Unit: Window cannot be secured","Moderate"]),
 ("outlet dead gfci won't trip", ["Recorded 2","Outlet does not","GFCI"]),
 ("shared kitchen 1 outlet dead", ["Room: Shared kitchen 1","Which area"]),
 ("inside", ["Inside: Outlet does not have visible damage","Severe"]),
 ("front yard gfci doesn't trip", ["Room: Front yard","Outside: GFCI"]),
 ("shared bathroom 1 sink clogged and lots of roaches", ["Room: Shared bathroom 1","Which area"]),
 ("inside", ["Inside, Sink is not draining","Which area"]),
 ("inside", ["Recorded 2.","Inside, Extensive cockroach"]),
 ("undo", ["Removed: inside, Extensive cockroach"]),
 ("undo", ["Removed: inside, Sink is not draining"]),
 ("undo", ["Removed: outside, GFCI"]),
 ("toilet clogged", ["at least 1 toilet is installed elsewhere"]),
 ("kitchen banana phone and smoke alarm missing", ["Room: Kitchen 1"]),
]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":820,"height":1180})
    pg.goto(APP_URL.rstrip("/")+"/inspect/new/", wait_until="networkidle"); pg.wait_for_timeout(1500)
    pg.get_by_text("Add rooms / configure layout").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Add layout rooms").click(); pg.wait_for_timeout(300)
    pg.get_by_label("Layout").select_option("shared"); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Add layout rooms").click(); pg.wait_for_timeout(300)
    pg.get_by_label("Other room / space").fill("Front yard"); pg.get_by_role("button", name="Add named room").click(); pg.wait_for_timeout(300)
    pg.add_script_tag(content=script)
    pg.evaluate("window.__p=new VoicePilotLib.VoicePilot(()=>{})")
    ok=0
    for said,expects in steps:
        r=pg.evaluate(f"window.__p.handle({said!r})"); pg.wait_for_timeout(250)
        good=all(e.lower() in r.lower() for e in expects); ok+=good
        print(("PASS " if good else "FAIL ")+f"> {said}\n     {r}")
    c=pg.locator("text=/LT 24-hour/").first.inner_text()+" / "+pg.locator("text=/30-day/").first.inner_text()
    print(f"\n{ok}/{len(steps)} passed. Counters: {c}")
    b.close()
