'use client';

import { useEffect, useRef, useState } from 'react';
import { HeadsetSession, jevViaProxy } from './voicePilot';
import { ClipSpeaker } from './clipSpeaker';
import VoiceSetup, { savedSetup, type SetupResult } from './VoiceSetup';

/**
 * Drop into the inspection page (or the root layout): a "Headset" button that turns
 * on Bluetooth headset control and voice commands. Only renders where a standard
 * selector exists, so it stays out of the way on other pages.
 */
interface Props {
  /** Folder with Kokoro clips and manifest.json (made by tools/make_voice_clips.py). */
  voice?: string | false;
  /** Use the /api/jev route for phrases the local matcher can't settle. */
  jev?: boolean;
  /** Load reviewed phrases from this file and send learning events to /api/learn. */
  learned?: string | false;
}

export default function VoicePilotButton({ voice = '/voice', jev = false, learned = '/learned.json' }: Props) {
  const session = useRef<HeadsetSession | null>(null);
  const [, force] = useState(0);
  const [visible, setVisible] = useState(false);
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  useEffect(() => { setSetup(savedSetup()); }, []);

  useEffect(() => {
    const s = new HeadsetSession();
    s.onChange = () => force(n => n + 1);
    if (jev) s.pilot.jev = jevViaProxy('/api/jev');
    if (voice) void ClipSpeaker.load(voice).then(sp => { if (sp) s.speaker = sp; });
    let timer: number | undefined;
    if (learned) {
      void s.pilot.loadLearned(learned);
      // Background sync: every few minutes, and whenever the connection comes back.
      const sync = () => { void s.pilot.syncLearning('/api/learn'); };
      timer = window.setInterval(sync, 5 * 60_000);
      window.addEventListener('online', sync);
      s.onDisable = sync;
    }
    session.current = s;
    const check = () => setVisible(!!s.pilot.standardSelect());
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); window.clearInterval(timer); s.disable(); };
  }, [voice, jev, learned]);

  if (!visible || !session.current) return null;
  const s = session.current;

  if (showSetup) {
    return <VoiceSetup session={s} onClose={r => { setShowSetup(false); if (r) setSetup(r); }} />;
  }

  // First time on this device: one obvious button that starts the guided setup.
  if (!setup) {
    return (
      <div className="no-print fixed bottom-24 right-3 z-50">
        <button type="button" onClick={() => setShowSetup(true)}
          className="min-h-14 rounded-full bg-[#0A3D6B] px-5 text-lg font-semibold text-white shadow-lg">
          Set up voice
        </button>
      </div>
    );
  }

  // After setup. If the earbud button didn't work, the Talk button is always there and bigger.
  const bigTalk = !setup.buttonWorks;
  return (
    <div className="no-print fixed right-2 top-1/2 z-50 flex -translate-y-1/2 flex-col items-end gap-2">
      <button
        type="button"
        aria-pressed={s.enabled}
        onClick={() => (s.enabled ? s.disable() : s.enable().catch(() => s.speak('Tap again to allow audio.')))}
        className={`min-h-12 rounded-full px-4 text-base font-semibold text-white shadow-lg ${s.enabled ? 'bg-green-700' : 'bg-slate-700'}`}
      >
        {s.enabled ? 'Voice on' : 'Voice off'}
      </button>
      {s.enabled && (
        <button
          type="button"
          onClick={() => s.listen()}
          className={`rounded-full font-semibold text-white shadow-lg ${bigTalk ? 'min-h-20 px-7 text-xl' : 'min-h-12 px-4 text-base'} ${s.listening ? 'bg-red-700' : 'bg-green-700'}`}
        >
          {s.listening ? 'Listening…' : 'Talk'}
        </button>
      )}
      <button type="button" onClick={() => setShowSetup(true)}
        className="min-h-10 rounded-full bg-white px-3 text-sm font-semibold text-[#0A3D6B] shadow">
        Voice help
      </button>
    </div>
  );
}
