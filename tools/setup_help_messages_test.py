import http.server, threading, functools
from playwright.sync_api import sync_playwright
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8766), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(__import__('pathlib').Path(__file__).resolve().parent / 'setup_harness')))
threading.Thread(target=srv.serve_forever,daemon=True).start()
ERR="""class FakeRec { start(){ setTimeout(()=>{ this.onerror && this.onerror({error:'network'}); this.onend && this.onend(); }, 200);} stop(){} }
window.webkitSpeechRecognition = FakeRec; window.SpeechRecognition = FakeRec;
navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), {name:'NotAllowedError'}));"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':820,'height':1180}, user_agent='Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')
    pg=ctx.new_page(); pg.add_init_script(ERR); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8766/index.html'); pg.wait_for_selector('#voice-setup-title')
    pg.get_by_role('button', name='I added it').click(); pg.get_by_role('button', name='Next: connect earbuds').click(); pg.get_by_role('button', name='My earbuds are connected').click()
    pg.get_by_role('button', name='Turn on microphone').click(); pg.wait_for_selector('text=The microphone is turned off'); 
    print('mic denied tip:', pg.locator('[role=status]').first.inner_text()[:160].replace('\n',' | ')); pg.screenshot(path='/tmp/setup_fail_mic.png')
    pg.get_by_role('button', name='Skip').click()
    pg.get_by_role('button', name='Play').click(); pg.get_by_role('button', name='No').click()
    print('no sound tip:', pg.locator('[role=status]').first.inner_text()[:120].replace('\n',' | '))
    pg.get_by_role('button', name='Skip').click()
    pg.get_by_role('button', name='Start').click(); pg.get_by_role('button', name="My earbuds don't have a button").click()
    print('no button tip:', pg.locator('[role=status]').first.inner_text()[:120].replace('\n',' | ')); pg.screenshot(path='/tmp/setup_fail_button.png')
    pg.get_by_role('button', name='Next').click(); pg.get_by_role('button', name='Listen').click(); pg.wait_for_selector('text=Voice needs an internet connection')
    print('network tip:', pg.locator('[role=status]').first.inner_text()[:140].replace('\n',' | '))
    pg.get_by_role('button', name='Skip').click(); pg.get_by_role('button', name='Start inspecting').click(); pg.wait_for_selector('#result')
    print('result:', pg.locator('#result').inner_text(), '| errors:', errs)
    b.close()
srv.shutdown()
