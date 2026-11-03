#!/usr/bin/env bash
# bin/ship-check.sh — pre-ship leak check of the current branch against a base ref (the S3 "leak check" gate).
# Checks: tree clean → protected files unchanged → leak scan of the diff → package.json version form.
# Read-only: git only, no AWS, no network. A matched line is never printed — only counts and file names.
# Runs on the git checkout of the current directory (npm runs it from the service root), so it works in every v5 service.
# Exit: 0 = every check passed, 1 = a check failed, 2 = usage error / not a git repository / base ref not found.
set -euo pipefail

# ---------- defaults (override with flags) ----------
BASE="origin/v5"   # the ref the branch ships onto
# protected paths: no change against the base (the env files and the Serverless stack files)
PROTECTED=(env serverless.yml serverless-vpc.yml)
# leak patterns: 12-digit account number, ARN prefix, access key id, AWS host, profile credentials line.
# The one-letter brackets ([n], [s]) match the same text but keep this file's own diff from matching the patterns.
LEAK_RE='[0-9]{12}|ar[n]:aws|AKIA[0-9A-Z]{12}|amazo[n]aws|credential[s]=profile'
# dev version form (5.YY.MMDD + optional letter); a prod bump is the owner's step and fails here
DEV_VERSION_RE='^5\.[0-9]{2}\.[0-9]{4}[a-z]?$'

# ---------- helpers ----------
usage() {
    # short usage text; the header comment above holds the long form
    cat <<'EOF'
Usage: bin/ship-check.sh [--base <ref>]
  --base <ref>     ref to compare with (default: origin/v5); `git fetch` first so it is current
  -h, --help       this text

Checks (each prints one PASS / FAIL line, then a summary line):
  tree       `git status --porcelain` is empty
  protected  no diff against the base in env/, serverless.yml, serverless-vpc.yml
  leak-scan  `git diff <base>` has no 12-digit number, ARN prefix, access key id, AWS host or profile credentials line
             (only the count and the file names are printed, never the line)
  version    package.json "version" is unchanged, or exactly one new value in the dev form 5.YY.MMDD[letter]
Exit: 0 all passed, 1 a check failed, 2 usage / not a git repository / base ref not found.
EOF
}
log() { printf '[ship-check] %s\n' "$*"; }
die() { printf '[ship-check] ERROR: %s\n' "$*" >&2; exit 2; }
# hide account numbers and API Gateway hosts in anything we print
redact() { sed -E 's/[0-9]{12}/<acct>/g; s#https://[a-z0-9]+\.execute-api[^" ]*#<endpoint>#g'; }
# first N lines joined with ", " (+ the rest as a count) — keeps a detail on one line
join_some() {
    local max="$1" all n
    all="$(cat)"
    n="$(printf '%s\n' "$all" | grep -c . || true)"
    printf '%s' "$(printf '%s\n' "$all" | head -n "$max" | paste -sd, - | sed 's/,/, /g')"
    if [ "$n" -gt "$max" ]; then printf ' (+%s more)' "$((n - max))"; fi
}
FAILS=0
# one result line per check; a FAIL is counted for the exit code
result() {
    local status="$1" name="$2" detail="$3"
    if [ "$status" = "FAIL" ]; then FAILS=$((FAILS + 1)); fi
    printf '[ship-check] %s %s — %s\n' "$status" "$name" "$(printf '%s' "$detail" | redact)"
}

# ---------- flags ----------
while [ $# -gt 0 ]; do
    case "$1" in
        --base)
            if [ $# -lt 2 ] || [ -z "$2" ]; then die "--base needs a ref (see --help)"; fi
            BASE="$2"; shift 2 ;;
        --base=*)
            BASE="${1#--base=}"
            if [ -z "$BASE" ]; then die "--base needs a ref (see --help)"; fi
            shift ;;
        -h|--help) usage; exit 0 ;;
        *) die "unknown option: $1 (see --help)" ;;
    esac
done

# ---------- preflight ----------
command -v git >/dev/null || die "git not found"
# the checkout of the current directory, from its root so the protected pathspecs resolve
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not a git repository: $(pwd)"
cd "$ROOT"
# resolve the base once; the diffs use the commit id (a ref that looks like an option never reaches git diff)
BASE_SHA="$(git rev-parse --verify --quiet "${BASE}^{commit}")" || die "base ref not found: $BASE (git fetch first, or --base <ref>)"
# byte-wise matching: a diff with non-UTF-8 bytes must not stop grep
export LC_ALL=C

# ---------- 1. tree ----------
# a dirty tree means the diff below is not what will ship
DIRTY="$(git status --porcelain)"
if [ -z "$DIRTY" ]; then
    result PASS tree "clean"
else
    # path column only (status letters dropped)
    N_DIRTY="$(printf '%s\n' "$DIRTY" | grep -c .)"
    result FAIL tree "$N_DIRTY path(s) not committed: $(printf '%s\n' "$DIRTY" | cut -c4- | join_some 3)"
fi

# ---------- 2. protected files ----------
# names only: the content of env files is never printed
CHANGED_PROTECTED="$(git diff "$BASE_SHA" --name-only -- "${PROTECTED[@]}")"
if [ -z "$CHANGED_PROTECTED" ]; then
    result PASS protected "no change in ${PROTECTED[*]}"
else
    result FAIL protected "$(printf '%s\n' "$CHANGED_PROTECTED" | grep -c .) file(s) changed: $(printf '%s\n' "$CHANGED_PROTECTED" | join_some 5)"
fi

# ---------- 3. leak scan ----------
# the whole diff against the base (headers, context, added and removed lines), like the manual gate command
DIFF="$(git diff "$BASE_SHA")"
# line numbers of the matching diff lines; the matched text goes no further than this pipe
HITS="$(printf '%s\n' "$DIFF" | grep -naE "$LEAK_RE" | cut -d: -f1 | tr '\n' ' ' || true)"
if [ -z "${HITS// /}" ]; then
    result PASS leak-scan "0 matches in the diff"
else
    N_HITS="$(printf '%s' "$HITS" | wc -w | tr -d ' ')"
    # map each matching diff line to the file of its `diff --git` header (file names only)
    HIT_FILES="$(printf '%s\n' "$DIFF" | awk -v hits="$HITS" '
        BEGIN { n = split(hits, h, " "); for (i = 1; i <= n; i++) hit[h[i]] = 1 }
        /^diff --git / { file = $NF; sub(/^b\//, "", file) }
        (NR in hit) && !(file in seen) { seen[file] = 1; print file }
    ')"
    N_FILES="$(printf '%s\n' "$HIT_FILES" | grep -c . || true)"
    result FAIL leak-scan "$N_HITS matching line(s) in $N_FILES file(s): $(printf '%s\n' "$HIT_FILES" | join_some 5) (lines not shown; open the diff yourself)"
fi

# ---------- 4. version ----------
# the "version" lines of the package.json diff: none, or one dev bump
VDIFF="$(git diff "$BASE_SHA" -- package.json)"
V_ADDED="$(printf '%s\n' "$VDIFF" | grep -E '^\+[[:space:]]*"version"[[:space:]]*:' || true)"
V_REMOVED="$(printf '%s\n' "$VDIFF" | grep -E '^-[[:space:]]*"version"[[:space:]]*:' || true)"
N_ADDED="$(printf '%s\n' "$V_ADDED" | grep -c . || true)"
N_REMOVED="$(printf '%s\n' "$V_REMOVED" | grep -c . || true)"
# the quoted value of a `"version": "x"` line
value_of() { sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/'; }
if [ "$N_ADDED" -eq 0 ] && [ "$N_REMOVED" -eq 0 ]; then
    result PASS version "unchanged"
elif [ "$N_ADDED" -eq 1 ] && [ "$N_REMOVED" -le 1 ]; then
    NEW_V="$(printf '%s\n' "$V_ADDED" | value_of)"
    OLD_V="$(printf '%s\n' "$V_REMOVED" | value_of)"
    if printf '%s\n' "$NEW_V" | grep -qE "$DEV_VERSION_RE"; then
        result PASS version "${OLD_V:-none} -> $NEW_V (dev form)"
    else
        result FAIL version "${OLD_V:-none} -> $NEW_V is not the dev form 5.YY.MMDD[letter] (a prod bump is the owner's step)"
    fi
else
    result FAIL version "$N_ADDED added / $N_REMOVED removed \"version\" line(s); expected none or one dev bump"
fi

# ---------- summary ----------
SUMMARY_BASE="base $BASE @ $(git rev-parse --short "$BASE_SHA")"
if [ "$FAILS" -eq 0 ]; then
    log "PASS all 4 checks ($SUMMARY_BASE)" | redact
    exit 0
fi
log "FAIL $FAILS of 4 checks ($SUMMARY_BASE)" | redact
exit 1
