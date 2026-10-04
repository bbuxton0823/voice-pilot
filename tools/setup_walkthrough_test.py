import http.server, threading, functools
from playwright.sync_api import sync_playwright
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8765), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(__import__('pathlib').Path(__file__).resolve().parent / 'setup_harness')))
threading.Thread(target=srv.serve_forever,daemon=True).start()
FAKE_SPEECH="""
class FakeRec { start(){ setTimeout(()=>{ this.onresult && this.onresult({results:[[{transcript:'smoke alarm missing'}]]}); this.onend && this.onend(); }, 300);} stop(){} }
window.webkitSpeechRecognition = FakeRec; window.SpeechRecognition = FakeRec;
"""
def run(viewport, ua, tag, steps_shots):
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        ctx=b.new_context(viewport=viewport, user_agent=ua, permissions=['microphone'])
        pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.add_init_script(FAKE_SPEECH)
        pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('#voice-setup-title')
        def shot(name):
            if name in steps_shots: pg.screenshot(path=f'/tmp/setup_{tag}_{name}.png')
        def title(): return pg.locator('#voice-setup-title').inner_text()
        log=[]
        log.append(title()); shot('1welcome'); pg.get_by_role('button', name='I added it').click(); pg.get_by_role('button', name='Next: connect earbuds').click()
        log.append(title()); shot('2pair'); pg.get_by_role('button', name='My earbuds are connected').click()
        log.append(title()); pg.get_by_role('button', name='Turn on microphone').click(); pg.wait_for_selector('text=Microphone is on'); pg.wait_for_timeout(400); shot('3mic')
        log.append(pg.locator('[role=status]').first.inner_text()); pg.get_by_role('button', name='The bar moves. Next').click()
        log.append(title()); pg.get_by_role('button', name='Play').click(); pg.wait_for_timeout(300); shot('4hear')
        pg.get_by_role('button', name='Yes, I heard it').click(); pg.get_by_role('button', name='Next').click()
        log.append(title()); pg.get_by_role('button', name='Start').click(); pg.wait_for_selector('text=Press your earbud button now')
        pg.evaluate('window.__session.simulatePress()'); pg.wait_for_selector('text=Your earbud button works'); shot('5button')
        log.append('button ok'); pg.get_by_role('button', name='Next').click()
        log.append(title()); pg.get_by_role('button', name='Listen').click(); pg.wait_for_selector('text=I heard: "smoke alarm missing"'); shot('6speak')
        pg.get_by_role('button', name='Next').click()
        log.append(title()); shot('7done'); pg.get_by_role('button', name='Start inspecting').click()
        pg.wait_for_selector('#result'); log.append(pg.locator('#result').inner_text())
        log.append('saved: '+str(pg.evaluate("localStorage.getItem('voicepilot:setup')")))
        print(tag, '| errors:', errs); print('\n'.join('  '+x for x in log))
        b.close()
IPAD='Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
AND='Mozilla/5.0 (Linux; Android 14; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36'
run({'width':820,'height':1180}, IPAD, 'ipad', {'1welcome','2pair','3mic','5button','7done'})
run({'width':412,'height':915}, AND, 'android', {'2pair','6speak'})
srv.shutdown()
