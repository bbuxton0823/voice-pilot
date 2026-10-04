from playwright.sync_api import sync_playwright
import os
APP_URL = os.environ.get("APP_URL", "https://hacsm-nspire-practice.vercel.app")
script=open(str(__import__('pathlib').Path(__file__).resolve().parent / 'voicePilot.bundle.js')).read()
cases=[("smoke alarm missing","Not installed","unit","Unit: Smoke alarm is not installed where required. Life-threatening"),
 ("smoke detector not working","does not produce","inside","Inside: Smoke alarm does not produce"),
 ("gfci doesn't trip","GFCI outlet or GFCI breaker","unit","Severe"),
 ("dead outlet","not energized","unit","Severe"),
 ("outlet not grounded","properly wired","inside","Severe"),
 ("roaches in the kitchen cabinets","Evidence of cockroaches","unit",None),
 ("lots of roaches","Extensive cockroach","unit",None),
 ("window won't lock","cannot be secured","inside","Low"),
 ("window won't lock","cannot be secured","unit","Moderate"),
 ("front door won't close","will not close","unit","Severe"),
 ("water heater no hot water","No hot water",None,None),
 ("mold in the bathroom",None,None,None),
 ("banana phone",None,None,None)]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":820,"height":1180})
    pg.goto(APP_URL.rstrip("/")+"/inspect/new/", wait_until="networkidle"); pg.wait_for_timeout(1500)
    pg.add_script_tag(content=script)
    pg.evaluate("window.__p=new VoicePilotLib.VoicePilot(()=>{})")
    ok=0; n=0
    for said,expect,area,expect2 in cases:
        r=pg.evaluate(f"window.__p.handle({said!r})"); pg.wait_for_timeout(200)
        line=f"> {said}\n  {r}"
        good = expect is None or expect.lower() in r.lower()
        if area:
            r2=pg.evaluate(f"window.__p.handle({area!r})"); pg.wait_for_timeout(200); line+=f"\n  > {area}: {r2}"
            good = good and (expect2 is None or expect2.lower() in r2.lower()) and "Already" not in r2
        n+=1; ok+=good; print(("PASS " if good else "FAIL ")+line)
    pg.evaluate("window.__p.handle('go to smoke alarm')"); pg.wait_for_timeout(200)
    pg.evaluate("window.__p.handle('comment battery removed by tenant')"); pg.wait_for_timeout(200)
    c=pg.evaluate("window.__p.comments()?.value"); print("comment:",repr(c)); n+=1; ok+= c=="Battery removed by tenant."
    counts=pg.locator("text=/LT 24-hour/").first.inner_text()+" / "+pg.locator("text=/30-day/").first.inner_text()
    print(f"\n{ok}/{n} passed. Header counters: {counts}")
    b.close()
