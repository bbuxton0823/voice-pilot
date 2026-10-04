'use client';

/**
 * Voice setup: a two-minute, one-step-per-screen walkthrough for inspectors who
 * don't want to think about Bluetooth, permissions or browsers.
 *
 * Every step checks itself and says what to do in plain words when something
 * doesn't work. Nothing is required: each step has a way forward, so nobody gets
 * stuck. Results are remembered on this device.
 */
import { useEffect, useRef, useState } from 'react';
import type { HeadsetSession } from './voicePilot';

export const SETUP_KEY = 'voicepilot:setup';

export interface SetupResult {
  done: string;            // date finished
  earbuds: string | null;  // name of the earbuds we saw, if any
  buttonWorks: boolean;    // false -> always show the on-screen Talk button
  heardWell: boolean;
}

export function savedSetup(): SetupResult | null {
  try { return JSON.parse(localStorage.getItem(SETUP_KEY) ?? 'null'); } catch { return null; }
}

type Step = 'install' | 'pair' | 'mic' | 'hear' | 'button' | 'speak' | 'done';
/** Putting the app on the home screen is always the first step. */
const ORDER: Step[] = ['install', 'pair', 'mic', 'hear', 'button', 'speak', 'done'];

// ------------------------------------------------------------------ home screen install
interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let installPrompt: InstallPromptEvent | null = null;
let installedNow = false;
const installListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  // Chrome on Android offers a real install button through an event that can arrive at any time.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e as InstallPromptEvent;
    installListeners.forEach(f => f());
  });
  window.addEventListener('appinstalled', () => { installedNow = true; installPrompt = null; installListeners.forEach(f => f()); });
}

/** True when the app was opened from its home screen icon. */
export function openedFromHomeScreen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const EARBUD_NAMES = /airpods|buds|bluetooth|headset|hands-?free|beats|jabra|bose|sony|jbl|shokz|aftershokz|plantronics|poly|skullcandy|soundcore|earbud|headphone/i;

function platform(): 'ipad' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ipad';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function speechSupported(): boolean {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// ------------------------------------------------------------------ small building blocks
function Big({ children, onClick, tone = 'primary', disabled }: {
  children: React.ReactNode; onClick: () => void; tone?: 'primary' | 'plain'; disabled?: boolean;
}) {
  const style = tone === 'primary'
    ? 'bg-[#0A3D6B] text-white hover:bg-[#0c4a82]'
    : 'bg-white text-[#0A3D6B] border-2 border-[#0A3D6B] hover:bg-slate-50';
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`min-h-16 w-full rounded-2xl px-6 text-xl font-semibold disabled:opacity-50 ${style}`}>
      {children}
    </button>
  );
}

function Good({ children }: { children: React.ReactNode }) {
  return <p role="status" className="rounded-xl bg-green-50 p-4 text-lg font-semibold text-green-800">✓ {children}</p>;
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3 text-lg">
      {items.map((t, i) => (
        <li key={t} className="flex gap-3">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#0A3D6B] text-base font-bold text-white">{i + 1}</span>
          <span className="pt-0.5">{t}</span>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ the wizard
export default function VoiceSetup({ session, onClose }: { session: HeadsetSession; onClose: (r: SetupResult | null) => void }) {
  const [step, setStep] = useState<Step>('install');
  const [install, setInstall] = useState<'idle' | 'prompted' | 'added' | 'dismissed'>(
    openedFromHomeScreen() || installedNow ? 'added' : 'idle');
  const [earbuds, setEarbuds] = useState<string | null>(null);
  const [micState, setMicState] = useState<'idle' | 'asking' | 'ok' | 'denied' | 'none'>('idle');
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState<'idle' | 'played' | 'yes' | 'no'>('idle');
  const [button, setButton] = useState<'idle' | 'waiting' | 'ok' | 'timeout'>('idle');
  const [speech, setSpeech] = useState<{ state: 'idle' | 'listening' | 'ok' | 'retry' | 'error'; text: string; error?: string }>({ state: 'idle', text: '' });
  const [, setInstallTick] = useState(0);
  useEffect(() => {
    const f = () => { setInstallTick(n => n + 1); if (installedNow) setInstall('added'); };
    installListeners.add(f);
    return () => { installListeners.delete(f); };
  }, []);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number | undefined>(undefined);
  const os = platform();
  const index = ORDER.indexOf(step);

  const go = (s: Step) => { setStep(s); window.scrollTo?.({ top: 0 }); };
  const next = () => go(ORDER[Math.min(index + 1, ORDER.length - 1)]);
  const back = () => go(ORDER[Math.max(index - 1, 0)]);

  // Stop the mic meter whenever we leave the mic step.
  useEffect(() => {
    if (step === 'mic') return;
    if (raf.current) cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
  }, [step]);
  useEffect(() => () => { session.buttonTest = null; stream.current?.getTracks().forEach(t => t.stop()); }, [session]);

  async function findEarbuds(): Promise<string | null> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hit = devices.find(d => (d.kind === 'audioinput' || d.kind === 'audiooutput') && EARBUD_NAMES.test(d.label));
      return hit ? hit.label.replace(/\s*\(.*\)\s*$/, '') : null;
    } catch { return null; }
  }

  async function askMic() {
    setMicState('asking');
    if (!navigator.mediaDevices?.getUserMedia) { setMicState('none'); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      setMicState('ok');
      setEarbuds(await findEarbuds());
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(100, Math.round((peak / 64) * 100)));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setMicState((e as Error).name === 'NotFoundError' ? 'none' : 'denied');
    }
  }

  async function playTest() {
    if (!session.enabled) {
      session.quietEnable = true;
      try { await session.enable(); } catch { /* the voice test still works without headset mode */ }
      session.quietEnable = false;
    }
    session.speak('This is your inspection voice. If you can hear me in your earbuds, tap yes.');
    setHeard('played');
  }

  async function startButtonTest() {
    if (!session.enabled) {
      session.quietEnable = true;
      try { await session.enable(); } catch { /* fall through to the timeout tip */ }
      session.quietEnable = false;
    }
    setButton('waiting');
    const timer = window.setTimeout(() => { session.buttonTest = null; setButton(b => (b === 'waiting' ? 'timeout' : b)); }, 20000);
    session.buttonTest = () => {
      window.clearTimeout(timer);
      session.buttonTest = null;
      setButton('ok');
      session.speak('Got it. That button works.');
    };
  }

  function speechTest() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechLike; webkitSpeechRecognition?: new () => SpeechLike };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { setSpeech({ state: 'error', text: '', error: 'unsupported' }); return; }
    let rec: SpeechLike;
    try { rec = new Ctor(); } catch { setSpeech({ state: 'error', text: '', error: 'unsupported' }); return; }
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    setSpeech({ state: 'listening', text: '' });
    rec.onresult = e => {
      const text = e.results[0][0].transcript;
      const ok = /smoke|alarm|missing/i.test(text);
      setSpeech({ state: ok ? 'ok' : 'retry', text });
      if (ok) session.speak('Perfect. I understood you.');
    };
    rec.onerror = e => setSpeech({ state: e.error === 'no-speech' ? 'retry' : 'error', text: '', error: e.error });
    rec.onend = () => setSpeech(s => (s.state === 'listening' ? { state: 'retry', text: '' } : s));
    rec.start();
  }

  async function addToHomeScreen() {
    if (!installPrompt) return;
    setInstall('prompted');
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    setInstall(outcome === 'accepted' ? 'added' : 'dismissed');
  }

  function finish() {
    const result: SetupResult = {
      done: new Date().toISOString().slice(0, 10), earbuds,
      buttonWorks: button === 'ok', heardWell: heard === 'yes',
    };
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(result)); } catch { /* still usable without saving */ }
    onClose(result);
  }

  // ---------------------------------------------------------------- screens
  let title = '';
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  switch (step) {
    case 'install': {
      title = 'First, put the app on your home screen';
      const fromIcon = openedFromHomeScreen();
      body = (
        <div className="space-y-5 text-lg">
          <p>Then you can open it with one tap, like any other app. After that, we'll set up talking to it through your earbuds. About 2 minutes in all.</p>
          {(fromIcon || install === 'added') && <Good>The app is on your home screen.</Good>}
          {!fromIcon && install !== 'added' && os === 'ipad' && (
            <>
              <Steps items={[
                'Tap the Share button (a square with an arrow pointing up). On iPad it\'s at the top; on iPhone, at the bottom.',
                'Scroll down and tap "Add to Home Screen".',
                'Tap "Add" in the top corner.',
                'Close Safari and tap the new app icon. Setup picks up there.',
              ]} />
              <p className="text-slate-600">Don't see "Add to Home Screen"? Make sure you opened this page in Safari.</p>
            </>
          )}
          {!fromIcon && install !== 'added' && os !== 'ipad' && installPrompt && (
            <p>Tap the button below, then tap <b>Install</b> (or <b>Add</b>).</p>
          )}
          {!fromIcon && install !== 'added' && os !== 'ipad' && !installPrompt && (
            <Steps items={os === 'android'
              ? ['Tap the menu button (three dots) in the top corner of Chrome.', 'Tap "Add to home screen" or "Install app".', 'Tap "Install" or "Add".', 'Open the app from the new icon. Setup picks up there.']
              : ['Open your browser menu.', 'Choose "Install app" or "Add to home screen".', 'Open the app from the new icon.']} />
          )}
          {install === 'dismissed' && <p className="text-slate-600">No problem. You can add it later from Voice help.</p>}
          {!speechSupported() && (
            <Tip title="Voice doesn't work in this view">
              <p>{os === 'ipad' ? 'Voice needs Safari on this iPad. Finish setup there.' : 'Open this app in Chrome, then come back to this screen.'}</p>
            </Tip>
          )}
        </div>
      );
      actions = (fromIcon || install === 'added')
        ? <Big onClick={next}>Next: connect earbuds</Big>
        : os !== 'ipad' && installPrompt
          ? <div className="space-y-3"><Big onClick={addToHomeScreen}>Add to home screen</Big><Big tone="plain" onClick={next}>Not now</Big></div>
          : <div className="space-y-3"><Big onClick={() => setInstall('added')}>I added it</Big><Big tone="plain" onClick={next}>Not now</Big></div>;
      break;
    }

    case 'pair':
      title = 'Connect your earbuds';
      body = (
        <div className="space-y-5">
          <Steps items={os === 'android'
            ? ['Put your earbuds in pairing mode (usually: hold the button on the case until a light blinks).',
               'Open Settings, then Connected devices, then Pair new device.',
               'Tap your earbuds\' name when it appears.',
               'Come back to this app.']
            : ['Put your earbuds in pairing mode (usually: hold the button on the case until a light blinks).',
               'Open Settings, then Bluetooth.',
               'Tap your earbuds\' name when it appears under Other Devices.',
               'Come back to this app.']} />
          <p className="text-lg text-slate-600">Already connected? Skip ahead. No earbuds today? That's fine: the {os === 'ipad' ? 'iPad' : 'phone'}'s own microphone and speaker work too.</p>
        </div>
      );
      actions = <Big onClick={next}>My earbuds are connected</Big>;
      break;

    case 'mic':
      title = 'Let the app hear you';
      body = (
        <div className="space-y-4 text-lg">
          {micState === 'idle' && <p>Tap the button below. When your {os === 'ipad' ? 'iPad' : 'phone'} asks, tap <b>Allow</b>.</p>}
          {micState === 'asking' && <p>Look for the question on screen and tap <b>Allow</b>.</p>}
          {micState === 'ok' && (
            <>
              <Good>Microphone is on{earbuds ? `. Using ${earbuds}` : ''}.</Good>
              <p>Say a few words. This bar should move:</p>
              <div className="h-6 w-full overflow-hidden rounded-full bg-slate-200" aria-label="Microphone level">
                <div className="h-6 rounded-full bg-green-600 transition-[width] duration-75" style={{ width: `${level}%` }} />
              </div>
              {!earbuds && <p className="text-slate-600">We don't see earbuds by name. If yours are connected, that's okay; some don't share their name with apps.</p>}
            </>
          )}
          {micState === 'denied' && (
            <Tip title="The microphone is turned off for this app">
              {os === 'ipad'
                ? <p>In Safari, tap the <b>aA</b> button in the address bar, then <b>Website Settings</b>, and set Microphone to <b>Allow</b>. Then tap Try again.</p>
                : <p>In Chrome, tap the <b>lock</b> next to the web address, then <b>Permissions</b>, and turn on Microphone. Then tap Try again.</p>}
            </Tip>
          )}
          {micState === 'none' && <Tip title="No microphone found"><p>Check that your earbuds are connected in Bluetooth settings, then tap Try again.</p></Tip>}
        </div>
      );
      actions = micState === 'ok'
        ? <Big onClick={next}>The bar moves. Next</Big>
        : <Big onClick={askMic}>{micState === 'idle' ? 'Turn on microphone' : 'Try again'}</Big>;
      break;

    case 'hear':
      title = 'Check you can hear the app';
      body = (
        <div className="space-y-4 text-lg">
          <p>Put your earbuds in and tap Play. You should hear a short message.</p>
          {heard === 'yes' && <Good>Sound works.</Good>}
          {heard === 'no' && (
            <Tip title="Didn't hear it? Try these">
              <p>Turn the volume up using the buttons on the side of the {os === 'ipad' ? 'iPad' : 'phone'}.</p>
              <p>Make sure the {os === 'ipad' ? 'iPad' : 'phone'} isn't on silent.</p>
              <p>Check your earbuds show as connected in Bluetooth settings.</p>
            </Tip>
          )}
        </div>
      );
      actions = heard === 'idle' || heard === 'no'
        ? <Big onClick={playTest}>{heard === 'no' ? 'Play again' : 'Play'}</Big>
        : heard === 'played'
          ? <div className="grid grid-cols-2 gap-3"><Big onClick={() => setHeard('yes')}>Yes, I heard it</Big><Big tone="plain" onClick={() => setHeard('no')}>No</Big></div>
          : <Big onClick={next}>Next</Big>;
      break;

    case 'button':
      title = 'Try the button on your earbud';
      body = (
        <div className="space-y-4 text-lg">
          <p>Most earbuds have a button or a spot you tap to pause music. That's your talk button.</p>
          {button === 'idle' && <p>Tap Start, then press or tap your earbud <b>once</b>.</p>}
          {button === 'waiting' && <p className="font-semibold">Press your earbud button now…</p>}
          {button === 'ok' && <Good>Your earbud button works. Press it once to talk.</Good>}
          {button === 'timeout' && (
            <Tip title="We didn't feel a press. That's okay.">
              <p>Some earbuds don't send their button to apps. You'll get a big green <b>Talk</b> button on screen instead; it works the same way.</p>
            </Tip>
          )}
        </div>
      );
      actions = button === 'idle'
        ? <Big onClick={startButtonTest}>Start</Big>
        : button === 'waiting'
          ? <Big tone="plain" onClick={() => { session.buttonTest = null; setButton('timeout'); }}>My earbuds don't have a button</Big>
          : <Big onClick={next}>Next</Big>;
      break;

    case 'speak':
      title = 'Say a practice finding';
      body = (
        <div className="space-y-4 text-lg">
          <p>Tap Listen, then say:</p>
          <p className="rounded-xl bg-slate-100 p-4 text-center text-2xl font-semibold">"Smoke alarm missing"</p>
          <p className="text-slate-600">This is practice only. Nothing gets recorded.</p>
          {speech.state === 'listening' && <p className="font-semibold">Listening… say it now.</p>}
          {speech.state === 'ok' && <Good>I heard: "{speech.text}"</Good>}
          {speech.state === 'retry' && (
            <Tip title={speech.text ? `I heard "${speech.text}". Let's try once more.` : 'I didn\'t catch that.'}>
              <p>Speak at a normal volume, a little slower than usual. Background noise from TVs or fans can get in the way.</p>
            </Tip>
          )}
          {speech.state === 'error' && (
            <Tip title={speech.error === 'network' ? 'Voice needs an internet connection' : speech.error === 'not-allowed' && !(os === 'ipad' && openedFromHomeScreen()) ? 'The microphone is turned off' : 'Voice isn\'t available here'}>
              <p>{speech.error === 'network'
                ? 'Connect to Wi-Fi or cell data and try again. Everything else in the app still works offline.'
                : os === 'ipad' && openedFromHomeScreen()
                  ? 'Some iPads only allow voice in Safari, not from a home screen icon. Tell your supervisor; for now, use the on-screen buttons. Everything else works from the icon.'
                  : speech.error === 'not-allowed'
                    ? 'Go back one step and turn the microphone on.'
                    : (os === 'ipad' ? 'Open the app in Safari and try again.' : 'Open the app in Chrome and try again.')}</p>
            </Tip>
          )}
        </div>
      );
      actions = speech.state === 'ok'
        ? <Big onClick={next}>Next</Big>
        : <Big onClick={speechTest} disabled={speech.state === 'listening'}>{speech.state === 'idle' ? 'Listen' : 'Try again'}</Big>;
      break;

    case 'done':
      title = "You're ready";
      body = (
        <div className="space-y-5 text-lg">
          <div className="rounded-2xl border-2 border-slate-200 p-5">
            <p className="mb-3 font-semibold">{button === 'ok' ? 'Your earbud button' : 'The green Talk button'}</p>
            <ul className="space-y-2">
              <li><b>Press once:</b> talk</li>
              {button === 'ok' && <li><b>Press twice:</b> next item</li>}
              {button === 'ok' && <li><b>Press three times:</b> where am I?</li>}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-slate-200 p-5">
            <p className="mb-3 font-semibold">Things you can say</p>
            <ul className="space-y-2">
              <li>"Kitchen, outlet dead and GFCI won't trip"</li>
              <li>"Bedroom 1, smoke alarm missing"</li>
              <li>"Next" · "Undo" · "Options" · "Where am I"</li>
            </ul>
          </div>
          <p className="text-slate-600">The app always says back what it recorded. If it's wrong, say "undo".</p>
        </div>
      );
      actions = <Big onClick={finish}>Start inspecting</Big>;
      break;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="voice-setup-title"
      className="fixed inset-0 z-[60] overflow-y-auto bg-white px-5 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <div className="mx-auto flex min-h-full max-w-xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <button type="button" onClick={index === 0 ? () => onClose(null) : back}
            className="min-h-12 rounded-xl px-3 text-lg font-semibold text-[#0A3D6B]">
            {index === 0 ? 'Close' : '← Back'}
          </button>
          {step !== 'done' && (
            <p className="text-base text-slate-600">Step {index + 1} of {ORDER.length - 1}</p>
          )}
          {step !== 'done' && step !== 'install'
            ? <button type="button" onClick={next} className="min-h-12 rounded-xl px-3 text-lg text-slate-600">Skip</button>
            : <span className="w-16" />}
        </div>
        <div className="flex gap-2" aria-hidden="true">
          {ORDER.slice(0, -1).map((s, i) => (
            <div key={s} className={`h-2 flex-1 rounded-full ${i <= index ? 'bg-[#0A3D6B]' : 'bg-slate-200'}`} />
          ))}
        </div>
        <h1 id="voice-setup-title" className="text-3xl font-bold leading-tight text-slate-900">{title}</h1>
        <div aria-live="polite" className="flex-1">{body}</div>
        <div className="sticky bottom-0 bg-white pb-[env(safe-area-inset-bottom)] pt-2">{actions}</div>
      </div>
    </div>
  );
}

interface SpeechLike {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
}
