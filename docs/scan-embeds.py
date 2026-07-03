#!/usr/bin/env python3
"""
Embedded-join schema-drift scanner (companion to scan-drift.py).

scan-drift.py only checks TOP-LEVEL select columns + filter columns; it skips
PostgREST embedded resources (tokens containing '(' or ':'). This scanner does the
opposite: it recurses INTO embeds like `alias:fk_col(inner_col, nested:other(...))`,
resolves each embed to its real table via the FK graph (from the OpenAPI
`<fk table='..' column='..'/>` hints), and flags inner columns that don't exist on
the resolved table.

Usage:
  set -a; source .env.local; set +a
  curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -o /tmp/schema.json
  python3 docs/scan-embeds.py            # grouped counts
  python3 docs/scan-embeds.py --files    # per-reference with file paths
  python3 docs/scan-embeds.py --unresolved   # also list embeds we couldn't resolve

Heuristic. An "unresolved" embed (target table not determinable) is reported only
under --files/--unresolved so you can eyeball it; verify any flag against the live DB.
"""
import json, re, glob, os, sys, collections

spec = json.load(open('/tmp/schema.json'))['definitions']
cols = {t: set(v.get('properties', {}).keys()) for t, v in spec.items()}

# Build FK map: (table, column) -> referenced_table
FK = {}
fk_re = re.compile(r"<fk table='([^']+)' column='[^']+'/>")
for t, v in spec.items():
    for c, p in v.get('properties', {}).items():
        m = fk_re.search(p.get('description', '') or '')
        if m:
            FK[(t, c)] = m.group(1)

def balanced(t, i):
    d = 1; s = i
    while i < len(t) and d > 0:
        c = t[i]
        if c in '([{': d += 1
        elif c in ')]}': d -= 1
        i += 1
    return t[s:i-1], i

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

def resolve_target(parent, token_head):
    """token_head is the text before '(' of an embed, e.g. 'alias:fk_col!hint' or 'table'."""
    head = token_head.strip()
    head = head.split('!', 1)[0]            # drop !fk_hint
    cand = head.split(':', 1)[-1].strip()   # part after alias:
    if cand in cols:
        return cand, None                    # direct table name (incl. reverse embeds)
    if parent and (parent, cand) in FK:
        return FK[(parent, cand)], None      # embed-through-FK-column
    return None, cand                        # unresolved

def walk(table, sel, f, hits, unresolved):
    for raw in top_split(sel):
        tok = raw.strip()
        if not tok or tok == '*':
            continue
        if '(' in tok:
            head = tok[:tok.index('(')]
            inner, _ = balanced(tok, tok.index('(') + 1)
            target, cand = resolve_target(table, head)
            if target is None:
                unresolved.add((table or '?', cand, os.path.relpath(f)))
                continue
            walk(target, inner, f, hits, unresolved)
        else:
            # plain column, possibly aliased `alias:realcol`; real col is after ':'
            col = tok.split(':', 1)[-1].strip()
            if any(x in col for x in '.->') or not IDENT.match(col):
                continue
            if table and table in cols and col not in cols[table]:
                hits.add((table, col, os.path.relpath(f)))

call = re.compile(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]\s*\)\s*\.(?:select)\(")
files = (glob.glob('apps/web/app/api/**/*.ts', recursive=True)
         + glob.glob('apps/web/lib/**/*.ts', recursive=True)
         + glob.glob('apps/admin/app/**/*.ts', recursive=True)
         + glob.glob('apps/admin/lib/**/*.ts', recursive=True))

hits = set(); unresolved = set()
for f in files:
    txt = open(f).read()
    for m in call.finditer(txt):
        table = m.group(1)
        if table not in cols:
            continue
        arg, _ = balanced(txt, m.end())
        sm = re.search(r"['\"`]([^'\"`]*)['\"`]", arg)
        if not sm:
            continue
        walk(table, sm.group(1), f, hits, unresolved)

if '--files' in sys.argv:
    for table, c, f in sorted(hits):
        print(f"  {table}.{c}  <- {f}")
if '--files' in sys.argv or '--unresolved' in sys.argv:
    for table, cand, f in sorted(unresolved):
        print(f"  [unresolved embed] {table} -> '{cand}'  <- {f}")
print(f"\nembed-inner drift refs: {len(hits)}   (unresolved embeds: {len(unresolved)})")
cnt = collections.Counter(t for t, *_ in hits)
for t, n in cnt.most_common():
    print(f"  {n:3d}  {t}")

# --ci: exit non-zero when any drift is found (for GitHub Actions)
if '--ci' in sys.argv:
    sys.exit(1 if hits else 0)
