"""Turn phrases.json into Kokoro voice clips plus a manifest the app can play offline.

Run Kokoro Web on the DGX Spark (arm64 image available):
  docker run -d --name kokoro -p 3000:3000 -e KW_SECRET_API_KEY=pick-a-secret \
    -v ~/kokoro-cache:/kokoro/cache --restart unless-stopped ghcr.io/eduardolat/kokoro-web:latest

Then, from any machine that can reach it:
  KOKORO_KEY=pick-a-secret python make_voice_clips.py --api http://spark:3000/api/v1 \
      --phrases phrases.json --out ../public/voice --voice af_heart

Copy the output folder into the Next.js app's public/voice/. Re-running only makes clips
that are missing, so adding a standard or changing the voice is cheap. Standard library only.
"""
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def clip_name(key: str, voice: str, model: str, speed: float) -> str:
    return hashlib.sha1(f"{voice}|{model}|{speed}|{key}".encode()).hexdigest()[:16] + ".mp3"


def synth(api: str, token: str, text: str, voice: str, model: str, speed: float, retries: int = 3) -> bytes:
    body = json.dumps({"model": model, "voice": voice, "input": text, "response_format": "mp3", "speed": speed}).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(api.rstrip("/") + "/audio/speech", data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if len(data) < 100:
                raise ValueError("empty audio")
            return data
        except (urllib.error.URLError, ValueError, TimeoutError) as e:
            if attempt == retries - 1:
                raise RuntimeError(f"{text[:40]!r}: {e}") from e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:3000/api/v1")
    ap.add_argument("--phrases", default="phrases.json")
    ap.add_argument("--out", default="voice")
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--model", default="model_q8f16")
    ap.add_argument("--speed", type=float, default=1.1)
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()

    token = os.environ.get("KOKORO_KEY", "")
    phrases: dict[str, str] = json.loads(Path(a.phrases).read_text())
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    clips = {key: clip_name(key, a.voice, a.model, a.speed) for key in phrases}
    todo = [k for k, f in clips.items() if not (out / f).exists()]
    print(f"{len(phrases)} phrases, {len(todo)} to make, voice {a.voice}, model {a.model}")

    failed = []
    def work(key: str) -> str:
        (out / clips[key]).write_bytes(synth(a.api, token, phrases[key], a.voice, a.model, a.speed))
        return key

    done = 0
    with cf.ThreadPoolExecutor(max_workers=max(1, a.workers)) as pool:
        futures = {pool.submit(work, k): k for k in todo}
        for fut in cf.as_completed(futures):
            try:
                fut.result()
                done += 1
                if done % 25 == 0 or done == len(todo):
                    print(f"  {done}/{len(todo)}")
            except Exception as e:  # keep going; report at the end
                failed.append(futures[fut])
                print(f"  failed: {e}", file=sys.stderr)

    manifest = {"voice": a.voice, "model": a.model, "speed": a.speed, "made": time.strftime("%Y-%m-%d"),
                "clips": {k: f for k, f in clips.items() if (out / f).exists()}}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    size = sum((out / f).stat().st_size for f in manifest["clips"].values())
    print(f"manifest: {len(manifest['clips'])} clips, {size / 1e6:.1f} MB, {len(failed)} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
