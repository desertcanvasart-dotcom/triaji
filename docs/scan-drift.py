#!/usr/bin/env python3
"""
Schema-drift scanner. Flags every Supabase column reference in apps/web + apps/admin
that does NOT exist in the LIVE Postgres schema (via the PostgREST OpenAPI spec).

Usage:
  set -a; source .env.local; set +a
  curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -o /tmp/schema.json
  python3 docs/scan-drift.py            # grouped counts by table
  python3 docs/scan-drift.py --files    # per-reference with file paths

Caveats: heuristic. Skips embeds/aliases in selects (tokens with ( : ! . *). Filter-method
columns use a 300-char window after `.from('t')`, so a few cross-query false positives are
possible — verify a flag against the live DB before "fixing" it.
"""
import json, re, glob, os, sys, collections

cols = {t: set(v.get('properties', {}).keys())
        for t, v in json.load(open('/tmp/schema.json'))['definitions'].items()}

def balanced(t, i):
    d = 1; s = i
    while i < len(t) and d > 0:
        c = t[i]
        if c in '([{': d += 1
        elif c in ')]}': d -= 1
        i += 1
    return t[s:i-1]

def top_split(s):
    out = []; d = 0; cur = ''
    for ch in s:
        if ch in '([{': d += 1; cur += ch
        elif ch in ')]}': d -= 1; cur += ch
        elif ch == ',' and d == 0: out.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur)
    return out

IDENT = re.compile(r'^[a-z_][a-z0-9_]*$')
FILT = r"\.(?:eq|neq|gt|gte|lt|lte|is|in|like|ilike|match|order)\(\s*['\"]([a-z_][a-z0-9_]*)['\"]"
call = re.compile(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]\s*\)\s*\.(select|insert|update|upsert)\(")

hits = set()
files = (glob.glob('apps/web/app/api/**/*.ts', recursive=True)
         + glob.glob('apps/web/lib/**/*.ts', recursive=True)
         + glob.glob('apps/admin/app/**/*.ts', recursive=True)
         + glob.glob('apps/admin/lib/**/*.ts', recursive=True))

for f in files:
    txt = open(f).read()
    for m in call.finditer(txt):
        table, op = m.group(1), m.group(2)
        if table not in cols:
            continue
        arg = balanced(txt, m.end())
        if op == 'select':
            sm = re.search(r"['\"`]([^'\"`]*)['\"`]", arg)
            if sm:
                for tok in top_split(sm.group(1)):
                    tok = tok.strip()
                    if tok and not any(x in tok for x in '(:!.') and tok != '*' \
                       and IDENT.match(tok) and tok not in cols[table]:
                        hits.add((table, tok, 'select', os.path.relpath(f)))
        else:
            obj = arg.strip()
            if obj.startswith('['): obj = obj[1:].strip()
            if not obj.startswith('{'): continue
            inner = obj[1:obj.rfind('}')] if '}' in obj else obj[1:]
            for part in top_split(inner):
                km = re.match(r"\s*([a-z_][a-z0-9_]*)\s*:", part)
                if km and km.group(1) not in cols[table]:
                    hits.add((table, km.group(1), op, os.path.relpath(f)))
    parts = re.split(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]\s*\)", txt)
    for i in range(1, len(parts), 2):
        table = parts[i]
        if table not in cols: continue
        for fm in re.finditer(FILT, (parts[i+1] if i+1 < len(parts) else '')[:300]):
            if fm.group(1) not in cols[table]:
                hits.add((table, fm.group(1), 'filter', os.path.relpath(f)))

if '--files' in sys.argv:
    for table, c, op, f in sorted(hits):
        print(f"  {table}.{c}  [{op}]  <- {f}")
print(f"\ntotal drift refs: {len(hits)}")
cnt = collections.Counter(t for t, *_ in hits)
for t, n in cnt.most_common():
    print(f"  {n:3d}  {t}")
