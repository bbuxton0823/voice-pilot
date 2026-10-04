"""Builds learned.json from reviewed phrases. Copy the result to the app's public/ folder.

Sources, in order of trust:
  1. Inspector corrections in the app (picked an option after the pilot was unsure).
  2. Rows in review.csv marked approve = y (the AI or Jev suggestion, checked by a person).
     Edit ai_standard / ai_deficiency in the sheet before approving if the suggestion was wrong.
A phrase that maps to more than one deficiency keeps the majority; ties are left out.

  python build_learned.py --events data/learn --review review.csv --catalog catalog.json --out ../public/learned.json
"""
import argparse
import collections
import csv
import json
import time
from pathlib import Path

from label_misses import load_events


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--events", default="data/learn")
    ap.add_argument("--review", default="review.csv")
    ap.add_argument("--catalog", default="catalog.json")
    ap.add_argument("--out", default="learned.json")
    ap.add_argument("--min-words", type=int, default=2, help="ignore one-word phrases; too vague to learn from")
    ap.add_argument("--corrections-need-review", action="store_true",
                    help="don't trust field corrections on their own; only approved review rows count")
    a = ap.parse_args()
    catalog = json.loads(Path(a.catalog).read_text())
    valid = {(s, d) for s, ds in catalog.items() for d in ds}

    votes = collections.defaultdict(collections.Counter)
    if Path(a.events).exists():
        for e in load_events(Path(a.events)):
            if not a.corrections_need_review and e.get("outcome") == "corrected" and (e.get("standard"), e.get("chosen")) in valid:
                votes[e["said"]][(e["standard"], e["chosen"])] += 2  # a person chose this in the field
    if Path(a.review).exists():
        with open(a.review, newline="") as fh:
            for row in csv.DictReader(fh):
                if row.get("approve", "").strip().lower() in ("y", "yes", "1", "true"):
                    pair = (row["ai_standard"].strip(), row["ai_deficiency"].strip())
                    if pair in valid:
                        votes[row["phrase"]][pair] += 1

    aliases, skipped = [], 0
    for phrase, counter in votes.items():
        if len(phrase.split()) < a.min_words:
            skipped += 1
            continue
        top = counter.most_common(2)
        if len(top) > 1 and top[0][1] == top[1][1]:
            skipped += 1
            continue
        (std, dfc), n = top[0]
        aliases.append({"phrase": phrase, "standard": std, "deficiency": dfc, "n": n})
    aliases.sort(key=lambda x: (-x["n"], x["phrase"]))
    Path(a.out).write_text(json.dumps({"version": time.strftime("%Y-%m-%d"), "aliases": aliases}, indent=1, ensure_ascii=False))
    print(f"{len(aliases)} learned phrases -> {a.out} ({skipped} skipped as vague or tied)")


if __name__ == "__main__":
    main()
