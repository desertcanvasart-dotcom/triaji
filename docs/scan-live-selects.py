#!/usr/bin/env python3
"""
Live-select scanner. Replays every `.from('table').select(...)` in the app
against the live PostgREST with `limit=0` and reports the ones the database
rejects.

Why a third scanner, next to scan-drift.py and scan-embeds.py: those parse the
schema and reason about it, which leaves them blind in three ways this one is
not.

  1. They glob only `**/*.ts`, so ~370 `.tsx` files — every page component,
     including the public clinic/lab/pharmacy profiles — went unscanned.
  2. They `continue` when a table is absent from the schema, so a query against
     a table that does not exist is silently skipped rather than flagged.
  3. They skip any select token containing `( : ! . *`, which is exactly where
     embeds and aliases live.

Sending the select string to Postgres instead of parsing it removes all three:
whatever the database accepts is correct by definition, embeds included.

Usage:
  set -a; source .env.local; set +a
  python3 docs/scan-live-selects.py                  # report
  python3 docs/scan-live-selects.py --ci             # fail only on NEW failures
  python3 docs/scan-live-selects.py --update-baseline

The baseline holds the failures already known and triaged, so CI stays green on
them while catching anything new. Shrink it; don't grow it.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse

ROOTS = ["apps/web", "apps/admin", "packages"]
BASELINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema-drift-baseline.txt")

FROM_RE = re.compile(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]\s*\)", re.I)


def read_select(src: str, start: int):
    """The raw argument of the first .select( shortly after `start`.

    The search window stops at the next `.from(`: a query's own `.select()`
    always precedes any later `.from()`, so a mutation with no select —
    `.from('x').update(...)` followed within 400 chars by a sibling
    `.from('y').select(...)` — must not borrow the next statement's select.
    """
    window_end = start + 400
    nxt = re.compile(r"\.from\(").search(src, start, window_end)
    if nxt:
        window_end = nxt.start()
    m = re.compile(r"\.select\(").search(src, start, window_end)
    if not m:
        return None
    i, depth, out = m.end(), 1, []
    while i < len(src) and depth:
        c = src[i]
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth == 0:
                break
        out.append(c)
        i += 1
    return "".join(out)


def clean(arg: str):
    """First string literal of the select call, normalised for PostgREST."""
    arg = arg.strip()
    if not arg or arg[0] not in "'\"`":
        return None                       # a variable, not a literal
    quote, i = arg[0], 1
    while i < len(arg):                   # closing quote of the FIRST literal;
        if arg[i] == "\\":                # `.select('id', { count: 'exact' })`
            i += 2                        # has a second argument
            continue
        if arg[i] == quote:
            break
        i += 1
    else:
        return None
    body = arg[1:i]
    if "${" in body:
        return None                       # interpolated — can't replay faithfully
    sel = " ".join(body.split())
    sel = re.sub(r"\s*\(\s*", "(", sel)   # embeds must be tight: `t!inner(a,b)`
    sel = re.sub(r"\s*\)\s*", ")", sel)
    sel = re.sub(r"\s*,\s*", ",", sel)
    return sel or None


def check(base: str, key: str, table: str, select: str):
    url = f"{base}/rest/v1/{table}?select={urllib.parse.quote(select, safe='(),:*!')}&limit=0"
    proc = subprocess.run(
        ["curl", "-s", "--max-time", "25", url,
         "-H", f"apikey: {key}", "-H", f"Authorization: Bearer {key}"],
        capture_output=True, text=True,
    )
    body = proc.stdout.strip()
    if body.startswith("["):
        return None
    try:
        return json.loads(body).get("message", body[:150])
    except Exception:                     # noqa: BLE001
        return body[:150] or "no response from PostgREST"


def collect():
    """Every distinct (table, select) pair in the tree, with one example file."""
    pairs = {}
    for root in ROOTS:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".next")]
            for fn in filenames:
                if not fn.endswith((".ts", ".tsx")):
                    continue
                path = os.path.join(dirpath, fn)
                with open(path, encoding="utf-8", errors="ignore") as fh:
                    src = fh.read()
                for m in FROM_RE.finditer(src):
                    if ".storage" in src[max(0, m.start() - 40):m.start()]:
                        continue          # storage buckets, not tables
                    raw = read_select(src, m.end())
                    if raw is None:
                        continue
                    sel = clean(raw)
                    if sel:
                        pairs.setdefault((m.group(1), sel), path)
    return pairs


def load_baseline():
    if not os.path.exists(BASELINE):
        return set()
    with open(BASELINE, encoding="utf-8") as fh:
        return {ln.strip() for ln in fh if ln.strip() and not ln.startswith("#")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci", action="store_true", help="fail only on failures absent from the baseline")
    ap.add_argument("--update-baseline", action="store_true")
    args = ap.parse_args()

    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set", file=sys.stderr)
        return 2

    pairs = collect()
    failures = {}
    for (table, sel), path in sorted(pairs.items()):
        err = check(base, key, table, sel)
        if err:
            failures[f"{table}|{sel}"] = (path, err)

    print(f"replayed {len(pairs)} distinct (table, select) pairs — {len(failures)} rejected\n")

    if args.update_baseline:
        with open(BASELINE, "w", encoding="utf-8") as fh:
            fh.write("# Known schema drift, one `table|select` per line.\n")
            fh.write("# Regenerate: python3 docs/scan-live-selects.py --update-baseline\n")
            fh.write("# This list should only ever get shorter.\n")
            for k in sorted(failures):
                fh.write(k + "\n")
        print(f"baseline written with {len(failures)} entries → {BASELINE}")
        return 0

    baseline = load_baseline()
    new = {k: v for k, v in failures.items() if k not in baseline}
    fixed = baseline - set(failures)

    for k, (path, err) in sorted(new.items(), key=lambda kv: kv[1][1]):
        table, sel = k.split("|", 1)
        print(f"  NEW  {path}")
        print(f"       {table}: {sel[:110]}{'…' if len(sel) > 110 else ''}")
        print(f"       → {err}\n")

    if fixed:
        print(f"{len(fixed)} baseline entries no longer fail — "
              f"run --update-baseline to shrink the baseline.\n")

    if args.ci:
        if new:
            print(f"::error::{len(new)} new schema drift failure(s). "
                  f"The query does not match the live database.")
            return 1
        print(f"no new drift ({len(baseline)} known failures still in the baseline)")
        return 0

    if not args.ci and not new:
        print("no drift outside the baseline")
    return 0


if __name__ == "__main__":
    sys.exit(main())
