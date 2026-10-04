"""Background AI labeler: suggests HUD deficiencies for phrases the pilot couldn't place.

Reads learning events (JSONL from learn_receiver.py, or a JSON export from the app),
asks an AI model to classify each unresolved phrase against the NSPIRE catalog in two
small steps (standard, then deficiency), and writes review.csv for a person to approve.
Nothing reaches inspectors until build_learned.py turns approved rows into learned.json.

Default model: GLM-5.3 served on the DGX Spark with vLLM, e.g.
  vllm serve zai-org/GLM-5.3-FP8 --served-model-name glm-5.3 --port 8000
(adjust parallelism and quantization to your Sparks). Any OpenAI-compatible endpoint works,
so phrases can stay in-house.

  python label_misses.py --events data/learn --catalog catalog.json \
      --api http://localhost:8000/v1 --model glm-5.3 --out review.csv
  Reasoning is skipped by default (quicker; the catalog is in the prompt and a person reviews
  every row). Add --reason to let the model think first on hard batches.
  (set AI_API_KEY if the endpoint needs one)

Standard library only.
"""
import argparse
import collections
import csv
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

SYSTEM = ("You classify what a housing inspector said during a HUD NSPIRE inspection. "
          "Inspectors may use old HQS wording. Answer only with JSON. If nothing fits, use null.")


def load_events(path: Path) -> list[dict]:
    files = sorted(path.glob("*.jsonl")) + sorted(path.glob("*.json")) if path.is_dir() else [path]
    events = []
    for f in files:
        text = f.read_text()
        if f.suffix == ".jsonl":
            events += [json.loads(line) for line in text.splitlines() if line.strip()]
        else:
            data = json.loads(text)
            events += data.get("events", data) if isinstance(data, dict) else data
    return [e for e in events if isinstance(e, dict) and e.get("said")]


def last_json(text: str) -> dict | None:
    """The answer is the last JSON object; reasoning models may think out loud first."""
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    for start in [i for i, c in enumerate(text) if c == "{"][::-1]:
        depth = 0
        for j in range(start, len(text)):
            depth += {"{": 1, "}": -1}.get(text[j], 0)
            if depth == 0:
                try:
                    obj = json.loads(text[start:j + 1])
                    if isinstance(obj, dict):
                        return obj
                except ValueError:
                    pass
                break
    return None


FAST = True
REASONING_SEEN = False


def chat(api: str, model: str, key: str, prompt: str) -> dict | None:
    payload = {"model": model, "temperature": 0, "max_tokens": 4096, "messages": [
        {"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]}
    if FAST:
        payload["chat_template_kwargs"] = {"enable_thinking": False}
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(api.rstrip("/") + "/chat/completions", data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=600) as r:
        msg = json.load(r)["choices"][0]["message"]
    global REASONING_SEEN
    if msg.get("reasoning_content") or "<think>" in (msg.get("content") or ""):
        REASONING_SEEN = True
    return last_json(msg.get("content") or "")


def classify(api, model, key, catalog: dict, said: str, room: str, hint_standard: str):
    names = list(catalog)
    p1 = (f'Inspector said: "{said}"\nRoom: {room or "unknown"}\nThe app was on: {hint_standard or "unknown"}\n'
          f"NSPIRE standards:\n" + "\n".join(f"- {n}" for n in names) +
          '\nReply as {"standard": "<exact name or null>", "confidence": 0-1}')
    a = chat(api, model, key, p1) or {}
    std = a.get("standard")
    if std not in catalog:
        return None, None, 0.0, "no standard fits"
    defs = catalog[std]
    p2 = (f'Inspector said: "{said}"\nStandard: {std}\nHUD deficiencies:\n' +
          "\n".join(f"{i + 1}. {d}" for i, d in enumerate(defs)) +
          '\nReply as {"number": <1-' + str(len(defs)) + ' or null>, "confidence": 0-1, "reason": "<short>"}')
    b = chat(api, model, key, p2) or {}
    n = b.get("number")
    if not isinstance(n, int) or not 1 <= n <= len(defs):
        return std, None, 0.0, "standard only"
    conf = min(float(a.get("confidence") or 0), float(b.get("confidence") or 0))
    return std, defs[n - 1], round(conf, 2), str(b.get("reason", ""))[:200]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--events", default="data/learn")
    ap.add_argument("--catalog", default="catalog.json")
    ap.add_argument("--api", default="http://localhost:8000/v1")
    ap.add_argument("--model", default="glm-5.3")
    ap.add_argument("--reason", action="store_true", help="let the model reason before answering (slower)")
    ap.add_argument("--out", default="review.csv")
    a = ap.parse_args()
    key = os.environ.get("AI_API_KEY", "")
    global FAST
    FAST = not a.reason
    catalog = json.loads(Path(a.catalog).read_text())
    events = load_events(Path(a.events))

    # Corrections were already labeled by an inspector; only unresolved phrases go to the AI.
    corrected = {e["said"] for e in events if e.get("outcome") == "corrected"}
    groups = collections.defaultdict(list)
    for e in events:
        if e.get("outcome") in ("unmatched", "ambiguous", "jev") and e["said"] not in corrected:
            groups[e["said"]].append(e)

    done = set()
    if Path(a.out).exists():
        with open(a.out, newline="") as fh:
            done = {row["phrase"] for row in csv.DictReader(fh)}
    fields = ["phrase", "count", "rooms", "app_standard", "jev_choice", "ai_standard", "ai_deficiency", "ai_confidence", "ai_reason", "approve"]
    new_file = not Path(a.out).exists()
    with open(a.out, "a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        if new_file:
            w.writeheader()
        made = 0
        for said, evs in sorted(groups.items(), key=lambda kv: -len(kv[1])):
            if said in done:
                continue
            std_hint = collections.Counter(e.get("standard", "") for e in evs).most_common(1)[0][0]
            jev = next((e.get("chosen", "") for e in evs if e.get("outcome") == "jev"), "")
            try:
                std, dfc, conf, why = classify(a.api, a.model, key, catalog, said, evs[0].get("room", ""), std_hint)
            except Exception as ex:  # keep going; a later run retries this phrase
                print(f"  skipped {said!r}: {ex}", file=sys.stderr)
                continue
            w.writerow({"phrase": said, "count": len(evs), "rooms": "; ".join(sorted({e.get("room", "") for e in evs}))[:120],
                        "app_standard": std_hint, "jev_choice": jev, "ai_standard": std or "", "ai_deficiency": dfc or "",
                        "ai_confidence": conf, "ai_reason": why, "approve": ""})
            made += 1
    print(f"{len(events)} events, {len(groups)} unresolved phrases, {made} new rows in {a.out}")
    if FAST and REASONING_SEEN:
        print("Note: the model still reasoned. Its chat template may ignore the skip request; "
              "check your vLLM reasoning settings if speed matters.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
