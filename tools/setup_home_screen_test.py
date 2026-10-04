import http.server, threading, functools
from playwright.sync_api import sync_playwright
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8767), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(__import__('pathlib').Path(__file__).resolve().parent / 'setup_harness')))
threading.Thread(target=srv.serve_forever,daemon=True).start()
IPAD='Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
AND='Mozilla/5.0 (Linux; Android 14; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36'
PROMPT="""window.addEventListener('load',()=>setTimeout(()=>{ const e=new Event('beforeinstallprompt'); e.prompt=()=>Promise.resolve(); e.userChoice=Promise.resolve({outcome:'accepted'}); window.dispatchEvent(e); },500));"""
def case(name, ua, init, check):
    with sync_playwright() as p:
        b=p.chromium.launch(); ctx=b.new_context(viewport={'width':820,'height':1180}, user_agent=ua); pg=ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        if init: pg.add_init_script(init)
        pg.goto('http://127.0.0.1:8767/index.html'); pg.wait_for_selector('#voice-setup-title')
        first=pg.locator('#voice-setup-title').inner_text()
        ok=check(pg)
        print(('PASS ' if ok and not errs and first.startswith('First, put the app') else 'FAIL ')+name, '|', first, '|', errs)
        pg.screenshot(path=f'/tmp/install_{name}.png'); b.close()
case('ipad_safari', IPAD, None, lambda pg: pg.get_by_text('Add to Home Screen', exact=False).count()>0 and (pg.get_by_role('button', name='I added it').click() or True) and pg.get_by_text('The app is on your home screen').count()==1)
case('ipad_from_icon', IPAD, "Object.defineProperty(navigator,'standalone',{get:()=>true});", lambda pg: pg.get_by_text('The app is on your home screen').count()==1 and pg.get_by_role('button', name='Next: connect earbuds').count()==1)
case('android_install_button', AND, PROMPT, lambda pg: (pg.get_by_role('button', name='Add to home screen').click() or True) and (pg.wait_for_selector('text=The app is on your home screen') is not None))
case('android_menu_steps', AND, None, lambda pg: pg.get_by_text('three dots', exact=False).count()==1)
srv.shutdown()
