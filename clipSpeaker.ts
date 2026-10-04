/**
 * Plays Voice Pilot replies in a Kokoro voice from pre-made clips, offline and instantly.
 *
 * Each reply is split into the fewest known phrases ("Unit" + "Smoke alarm is not
 * installed where required" + "Life-threatening, 24 hours") and the clips are played
 * back to back. If any part of a reply has no clip, the whole reply uses the browser's
 * voice instead, so you never hear two voices in one sentence.
 */
import { norm } from './voicePilot';

interface Manifest { voice: string; clips: Record<string, string> }

const MAX_PHRASE_WORDS = 70;
const GAP_SECONDS = 0.06;

/** Fewest clips that cover the reply exactly, or null. Exported for tests. */
export function planClips(text: string, has: (key: string) => boolean): string[] | null {
  const words = norm(text).split(' ').filter(Boolean);
  const n = words.length;
  if (!n) return null;
  const best: (string[] | null)[] = Array(n + 1).fill(null);
  best[n] = [];
  for (let i = n - 1; i >= 0; i--) {
    for (let j = Math.min(n, i + MAX_PHRASE_WORDS); j > i; j--) {
      const rest = best[j];
      if (!rest) continue;
      const key = words.slice(i, j).join(' ');
      if (has(key) && (!best[i] || rest.length + 1 < best[i]!.length)) best[i] = [key, ...rest];
    }
  }
  return best[0];
}

export class ClipSpeaker {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private playing: AudioBufferSourceNode[] = [];

  private constructor(private base: string, private manifest: Manifest) {}

  static async load(base = '/voice'): Promise<ClipSpeaker | null> {
    try {
      const r = await fetch(`${base}/manifest.json`);
      if (!r.ok) return null;
      return new ClipSpeaker(base, (await r.json()) as Manifest);
    } catch {
      return null;
    }
  }

  get size() { return Object.keys(this.manifest.clips).length; }

  canSay(text: string): boolean {
    return planClips(text, k => k in this.manifest.clips) !== null;
  }

  /** Call from a tap (browsers only start audio after one). Optionally preload every clip. */
  unlock(preloadAll = false) {
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    if (preloadAll) Object.keys(this.manifest.clips).forEach(k => void this.buffer(k).catch(() => undefined));
  }

  private buffer(key: string): Promise<AudioBuffer> {
    let p = this.buffers.get(key);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(`${this.base}/${this.manifest.clips[key]}`)
        .then(r => { if (!r.ok) throw new Error(`clip ${r.status}`); return r.arrayBuffer(); })
        .then(b => ctx.decodeAudioData(b));
      p.catch(() => this.buffers.delete(key));
      this.buffers.set(key, p);
    }
    return p;
  }

  stop() {
    this.playing.forEach(s => { try { s.stop(); } catch { /* already ended */ } });
    this.playing = [];
  }

  /** Returns false if it couldn't say it with clips; the caller then uses the browser voice. */
  async say(text: string): Promise<boolean> {
    const plan = planClips(text, k => k in this.manifest.clips);
    if (!plan) return false;
    this.unlock();
    const ctx = this.ctx!;
    let bufs: AudioBuffer[];
    try {
      bufs = await Promise.all(plan.map(k => this.buffer(k)));
    } catch {
      return false;
    }
    this.stop();
    let at = ctx.currentTime + 0.02;
    for (const b of bufs) {
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.start(at);
      this.playing.push(src);
      at += b.duration + GAP_SECONDS;
    }
    return true;
  }
}
