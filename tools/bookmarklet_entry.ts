import { HeadsetSession } from '../voicePilot';
(() => {
  const w = window as unknown as { __voicePilot?: boolean };
  if (w.__voicePilot) return;
  w.__voicePilot = true;
  const s = new HeadsetSession();
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;right:8px;top:50%;transform:translateY(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px';
  const mk = (label: string, bg: string) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.style.cssText = `min-height:48px;padding:0 16px;border:0;border-radius:24px;color:#fff;font:600 15px system-ui;background:${bg};box-shadow:0 2px 8px rgba(0,0,0,.25)`;
    return b;
  };
  const head = mk('Headset off', '#334155');
  const talk = mk('Talk', '#0A3D6B');
  talk.style.display = 'none';
  s.onChange = () => {
    head.textContent = s.enabled ? 'Headset on' : 'Headset off';
    head.style.background = s.enabled ? '#15803d' : '#334155';
    talk.style.display = s.enabled ? '' : 'none';
    talk.textContent = s.listening ? 'Listening…' : 'Talk';
    talk.style.background = s.listening ? '#b91c1c' : '#0A3D6B';
  };
  head.onclick = () => (s.enabled ? s.disable() : s.enable().catch(() => s.speak('Tap again to allow audio.')));
  talk.onclick = () => s.listen();
  bar.append(head, talk);
  document.body.append(bar);
})();
