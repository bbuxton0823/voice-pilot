import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
APP_URL = os.environ.get("APP_URL", "https://hacsm-nspire-practice.vercel.app")
VOICE=Path(sys.argv[1] if len(sys.argv)>1 else '../public/voice')
script=open(str(Path(__file__).resolve().parent.parent / 'voicePilot.bundle.js')).read()
steps=["where am i","smoke alarm missing","unit","undo","smoke detector not working","inside","next","go to water heater","options","number 1","unit",
 "gfci doesn't trip","dead outlet","unit","outlet not grounded","inside","lots of roaches","unit","window won't lock","inside","front door won't close","unit",
 "kitchen outlet dead and gfci doesn't trip and cabinet door broken","bedroom smoke alarm missing","window won't lock","shared kitchen 1 outlet dead","inside",
 "front yard gfci doesn't trip","shared bathroom 1 sink clogged and lots of roaches","inside","inside","undo","undo","banana phone","comment battery removed by tenant"]
def serve(route):
    name=route.request.url.split('/voice/')[-1].split('?')[0]
    f=VOICE/name
    if f.exists(): route.fulfill(status=200, body=f.read_bytes(), content_type='application/json' if name.endswith('.json') else 'audio/mpeg')
    else: route.fulfill(status=404, body='')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); ctx=b.new_context(viewport={"width":820,"height":1180}, service_workers="block"); pg=ctx.new_page()
    pg.route("**/voice/**", serve)
    pg.goto(APP_URL.rstrip("/")+"/inspect/new/", wait_until="networkidle"); pg.wait_for_timeout(1200)
    pg.get_by_text("Add rooms / configure layout").click(); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Add layout rooms").click(); pg.wait_for_timeout(200)
    pg.get_by_label("Layout").select_option("shared"); pg.get_by_role("button", name="Add layout rooms").click(); pg.wait_for_timeout(200)
    pg.get_by_label("Other room / space").fill("Front yard"); pg.get_by_role("button", name="Add named room").click(); pg.wait_for_timeout(200)
    pg.add_script_tag(content=script)
    print("speaker clips:", pg.evaluate("VoicePilotLib.ClipSpeaker.load('/voice').then(s=>{window.__sp=s; return s && s.size})"))
    pg.evaluate("window.__p=new VoicePilotLib.VoicePilot(()=>{})")
    covered=0; misses=[]
    for st in steps:
        r=pg.evaluate(f"window.__p.handle({st!r})"); pg.wait_for_timeout(150)
        ok=pg.evaluate(f"window.__sp.canSay({r!r})")
        covered+=ok
        if not ok: misses.append(r)
    print(f"Replies fully in the Kokoro voice: {covered}/{len(steps)}")
    for m in misses: print("  browser voice:", m[:140])
    played=pg.evaluate("""async()=>{ window.__sp.unlock(); const r=await window.__sp.say('Unit: Smoke alarm is not installed where required. Life-threatening, 24 hours.'); return [r, VoicePilotLib.planClips('Unit: Smoke alarm is not installed where required. Life-threatening, 24 hours.', k=>true).length]}""")
    plan=pg.evaluate("""VoicePilotLib.planClips('Unit: Smoke alarm is not installed where required. Life-threatening, 24 hours.', k=>['unit','smoke alarm is not installed where required','life threatening 24 hours','smoke alarm'].includes(k))""")
    print("say() played:", played[0], "| plan:", plan)
    b.close()
