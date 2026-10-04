"""Receives learning events from the app and appends them to daily JSONL files.

Runs on the DGX Spark (standard library only). Expose it to Vercel with a Cloudflare
Tunnel or Tailscale Funnel, and set the same secret on both sides.

  LEARN_SECRET=long-random-string python learn_receiver.py --port 8787 --data data/learn
"""
import argparse
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

FIELDS = {"at": 40, "said": 200, "room": 60, "standard": 120, "outcome": 20, "chosen": 400, "area": 10}
OUTCOMES = {"unmatched", "ambiguous", "corrected", "jev"}


def make_handler(data_dir: Path, secret: str):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code: int, obj: dict):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path.rstrip("/") not in ("", "/learn"):
                return self._send(404, {"error": "not found"})
            if self.headers.get("X-Learn-Secret") != secret:
                return self._send(401, {"error": "unauthorized"})
            length = int(self.headers.get("Content-Length") or 0)
            if length > 512_000:
                return self._send(413, {"error": "too large"})
            try:
                events = json.loads(self.rfile.read(length)).get("events", [])
            except (ValueError, AttributeError):
                return self._send(400, {"error": "bad json"})
            kept = []
            for e in events[:200]:
                if not isinstance(e, dict) or e.get("outcome") not in OUTCOMES or not e.get("said"):
                    continue
                kept.append({k: str(e.get(k, ""))[:n] for k, n in FIELDS.items()})
            if kept:
                data_dir.mkdir(parents=True, exist_ok=True)
                with (data_dir / f"{time.strftime('%Y-%m-%d')}.jsonl").open("a") as fh:
                    for e in kept:
                        fh.write(json.dumps(e) + "\n")
            return self._send(200, {"stored": len(kept)})

        def log_message(self, *args):
            pass
    return Handler


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--data", default="data/learn")
    a = ap.parse_args()
    secret = os.environ.get("LEARN_SECRET")
    if not secret:
        raise SystemExit("Set LEARN_SECRET.")
    ThreadingHTTPServer(("0.0.0.0", a.port), make_handler(Path(a.data), secret)).serve_forever()


if __name__ == "__main__":
    main()
