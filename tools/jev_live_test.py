import os, json, urllib.request, time
from playwright.sync_api import sync_playwright
import os
APP_URL = os.environ.get("APP_URL", "https://hacsm-nspire-practice.vercel.app")
KEY=os.environ["JEV_KEY"]
script=open(str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'voicePilot.bundle.js')).read()
def forward(route):
    if not route.request.post_data: return route.fulfill(status=400, body="{}")
    req=json.loads(route.request.post_data)
    if not isinstance(req, dict) or not req.get("options"): return route.fulfill(status=400, body="{}")
    criteria=dict(list(req["options"].items())[:254]); criteria["none"]="The inspector did not describe any of these."
    state={"inspector_said":req["said"]}
    if req.get("room"): state["room"]=req["room"]
    if req.get("standard"): state["standard"]=req["standard"]
    body=json.dumps({"state":state,"model":"jev-1.13.0","questions":{"pick":{"type":"choice","instructions":req["question"],"criteria":criteria}}}).encode()
    r=urllib.request.Request("https://api.typesafe.ai/v1/systemone",data=body,headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
    a=json.load(urllib.request.urlopen(r,timeout=10))["answers"]["pick"]
    route.fulfill(status=200,content_type="application/json",body=json.dumps({"choice":a["choice"],"confidence":a["confidence"],"probabilities":a["probabilities"]}))
phrases=["there's black stuff growing on the bathroom ceiling","the stove knob is gone","toilet keeps running and won't flush right","bedroom window is painted shut","tenant says the heater blows cold air","the tub doesn't drain","smoke alarm missing"]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":820,"height":1180}, service_workers="block"); pg=ctx.new_page()
    pg.route("**/api/jev", forward)
    pg.goto(APP_URL.rstrip("/")+"/inspect/new/", wait_until="networkidle"); pg.wait_for_timeout(1500)
    pg.add_script_tag(content=script)
    pg.evaluate("window.__p=new VoicePilotLib.VoicePilot(()=>{}); window.__p.jev=VoicePilotLib.jevViaProxy('/api/jev', 6000)")
    for ph in phrases:
        t=time.time(); r=pg.evaluate(f"window.__p.handle({ph!r})"); dt=time.time()-t
        src=pg.evaluate("window.__p.lastSource"); std=pg.evaluate("window.__p.currentStandard()")
        print(f"> {ph}\n  [{src}, {dt:.2f}s, on {std}] {r}")
        if "Which area" in r: pg.evaluate("window.__p.handle('unit')")
    b.close()
