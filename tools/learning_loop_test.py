import json, os, re, subprocess, sys, time, threading, urllib.request, csv, http.server
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
APP_URL = os.environ.get("APP_URL", "https://hacsm-nspire-practice.vercel.app")
T=Path('/tmp/looptest'); subprocess.run(['rm','-rf',str(T)]); T.mkdir()
TOOLS=str(Path(__file__).resolve().parent)
script=open(str(Path(__file__).resolve().parent.parent / 'voicePilot.bundle.js')).read()
# 1. receiver
rec=subprocess.Popen([sys.executable,f'{TOOLS}/learn_receiver.py','--port','8787','--data',str(T/'learn')],env={**os.environ,'LEARN_SECRET':'s3cret'})
time.sleep(1)
def fwd(route):
    body=route.request.post_data
    r=urllib.request.Request('http://127.0.0.1:8787/learn',data=body.encode(),headers={'Content-Type':'application/json','X-Learn-Secret':'s3cret'})
    route.fulfill(status=200, content_type='application/json', body=urllib.request.urlopen(r).read())
learned_holder={}
def serve_learned(route):
    route.fulfill(status=200 if learned_holder else 404, content_type='application/json', body=learned_holder.get('body','{}'))
def page(p):
    b=p.chromium.launch(); ctx=b.new_context(service_workers="block"); pg=ctx.new_page()
    pg.route("**/api/learn", fwd); pg.route("**/learned.json", serve_learned)
    pg.goto(APP_URL.rstrip("/")+"/inspect/new/", wait_until="networkidle"); pg.wait_for_timeout(1200)
    pg.add_script_tag(content=script); pg.evaluate("window.__p=new VoicePilotLib.VoicePilot(()=>{})")
    return b,pg
with sync_playwright() as p:
    b,pg=page(p)
    for s in ["black gunk growing on the ceiling","number 2","unit","unit","the stove is acting funny","nonsense words here"]:
        print(">",s,"\n  ",pg.evaluate(f"window.__p.handle({s!r})")[:120])
    log=pg.evaluate("window.__p.learningLog()"); print("events on device:",[(e['outcome'],e['said']) for e in log])
    print("synced:", pg.evaluate("window.__p.syncLearning('/api/learn')"), "| again:", pg.evaluate("window.__p.syncLearning('/api/learn')"))
    b.close()
rec.terminate()
print("receiver files:", [f.name for f in (T/'learn').glob('*.jsonl')])
# 3. mock LLM
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        req=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        u=req['messages'][1]['content']; said=re.search(r'Inspector said: "(.*?)"',u).group(1)
        if 'NSPIRE standards:' in u:
            ans={"standard": "Mold-Like Substance" if 'gunk' in said else ("Cooking Appliance" if 'stove' in said else None), "confidence":0.8}
        else: ans={"number":1,"confidence":0.7,"reason":"visible growth" }
        assert req["model"]=="glm-5.3"
        out=json.dumps({"choices":[{"message":{"reasoning_content":"thinking...","content":"<think>Compare {options} first.</think>"+json.dumps(ans)}}]}).encode()
        self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(out)
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8899),H); threading.Thread(target=srv.serve_forever,daemon=True).start()
r=subprocess.run([sys.executable,f'{TOOLS}/label_misses.py','--events',str(T/'learn'),'--catalog',f'{TOOLS}/catalog.json','--api','http://127.0.0.1:8899/v1','--model','glm-5.3','--out',str(T/'review.csv')],capture_output=True,text=True,cwd=TOOLS); print(r.stdout.strip(), r.stderr.strip()[:300])
rows=list(csv.DictReader(open(T/'review.csv'))); 
for row in rows: print("  review:", row['phrase'],'->',row['ai_standard'],'|',row['ai_deficiency'][:60],'| conf',row['ai_confidence'])
for row in rows: row['approve']='y' if row['ai_deficiency'] else ''
with open(T/'review.csv','w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
r=subprocess.run([sys.executable,f'{TOOLS}/build_learned.py','--events',str(T/'learn'),'--review',str(T/'review.csv'),'--catalog',f'{TOOLS}/catalog.json','--out',str(T/'learned.json')],capture_output=True,text=True,cwd=TOOLS); print(r.stdout.strip(), r.stderr.strip()[:300])
learned_holder['body']=(T/'learned.json').read_text(); print(learned_holder['body'][:600])
with sync_playwright() as p:
    b,pg=page(p)
    print("loaded learned:", pg.evaluate("window.__p.loadLearned('/learned.json')"))
    for s in ["black gunk growing on the ceiling","the stove is acting funny"]:
        r=pg.evaluate(f"window.__p.handle({s!r})"); print(">",s,"\n   [",pg.evaluate("window.__p.lastSource"),"]",r[:140])
    b.close()
srv.shutdown()
