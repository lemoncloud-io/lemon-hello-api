#!/usr/bin/env bash
# bin/deploy-dev.sh — manual code deploy of this service to the `lemon` dev or prod stage through the deploy service.
# Steps: preflight → pack (Docker) → offline plan → `lemon-lambda-deploy --apply` → probe GET / and /hello/0.
# Stages: `dev` (no prompt; `--ask` to confirm first) and `prod` (`npm run deploy:prod`; asks before --apply unless `--yes`,
# and applies only a pack of a committed tree). Both are deploy-service functions; the code mode never changes env.
# The service name comes from package.json, so the same file works in every v5 service.
set -euo pipefail

# ---------- defaults (override with flags) ----------
STAGE="dev"
PROFILE="lemon"
CONFIG=""          # deploy.code.<stage>.json (real values, never committed); default .artifacts/deploy.code.<stage>.json
ARTIFACT=""        # pack output directory; default: a new pack under .artifacts/lambda/
SKIP_PACK=0        # reuse --artifact instead of packing
PLAN_ONLY=0        # stop after the offline plan
ASK=0              # 1 = ask before --apply (dev default: apply right away; prod: always, unless --yes)
YES=0              # 1 = --yes given (the only way to skip the prod prompt)

# ---------- helpers ----------
usage() {
    # short usage text; the header comment above holds the long form
    cat <<'EOF'
Usage: bin/deploy-dev.sh [options]
  --stage <name>       stage to deploy: dev | prod (default: dev; `npm run deploy:prod` passes prod)
  --profile <name>     AWS profile for the probe and the identity check (default: lemon; must match the config)
  --config <file>      deploy config in code mode (default: .artifacts/deploy.code.<stage>.json)
  --artifact <dir>     pack output directory to deploy (default: run a new pack)
  --skip-pack          do not pack; requires --artifact
  --plan-only          print the offline plan and stop (no AWS change)
  --ask                ask before --apply (dev default: apply right away; prod asks unless --yes)
  --yes                apply without asking (needed to skip the prod prompt)
  -h, --help           this text

Config: the default .artifacts/deploy.code.<stage>.json is git-ignored. When it is missing, the script
  fills it once from the private lane folder ../.wt/v5-private/<service>/ next to the main checkout
  (override: DEPLOY_PRIVATE_DIR) — deploy.code.<stage>.json is copied, else deploy.<stage>.json is reduced
  to code mode with jq. Without a private folder it writes the file from deploy.config.example.json and stops.
EOF
}
log() { printf '[deploy-dev] %s\n' "$*"; }
die() { printf '[deploy-dev] ERROR: %s\n' "$*" >&2; exit 2; }
# hide account numbers and API Gateway hosts in anything we print
redact() { sed -E 's/[0-9]{12}/<acct>/g; s#https://[a-z0-9]+\.execute-api[^" ]*#<endpoint>#g'; }

# ---------- flags ----------
while [ $# -gt 0 ]; do
    case "$1" in
        --stage) STAGE="$2"; shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        --config) CONFIG="$2"; shift 2 ;;
        --artifact) ARTIFACT="$2"; shift 2 ;;
        --skip-pack) SKIP_PACK=1; shift ;;
        --plan-only) PLAN_ONLY=1; shift ;;
        --ask) ASK=1; shift ;;
        --yes) YES=1; ASK=0; shift ;;
        -h|--help) usage; exit 0 ;;
        *) die "unknown option: $1 (see --help)" ;;
    esac
done

# ---------- preflight ----------
# run from the service root so the lemon-* bins and pack.config.json resolve
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -f package.json ] && [ -f pack.config.json ] || die "run from the service checkout (package.json / pack.config.json not found)"
command -v jq >/dev/null || die "jq not found"
# the service name is the deploy project name (package.json `name`)
PROJECT="$(jq -r '.name // empty' package.json)"
[ -n "$PROJECT" ] || die "package.json has no name"
# stage guard: the deploy service owns the lemon dev and prod stages
case "$STAGE" in
    dev) ;;
    prod) [ "$YES" -eq 1 ] || ASK=1 ;; # prod asks before --apply unless --yes
    *) die "stage '$STAGE' is not deployed here (dev | prod)" ;;
esac
# tools
command -v node >/dev/null || die "node not found (needs Node >= 24)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 24 ] || die "Node >= 24 required (found $(node -v))"
command -v aws >/dev/null || die "aws CLI not found"
[ -x node_modules/.bin/lemon-lambda-deploy ] || die "lemon-core bins missing: run npm ci"
# the pack script is `pack` in most v5 services and `lambda:pack` in a few
if jq -e '.scripts.pack' package.json >/dev/null; then PACK_SCRIPT="pack"; elif jq -e '.scripts["lambda:pack"]' package.json >/dev/null; then PACK_SCRIPT="lambda:pack"; else die "no pack script (pack / lambda:pack) in package.json"; fi
if [ "$SKIP_PACK" -eq 0 ]; then
    command -v docker >/dev/null || die "docker not found (pack builds in Docker)"
    docker info >/dev/null 2>&1 || die "docker is not running"
fi
# config: default path; when it is missing, take it from the private lane folder once
# the private folder sits next to the main checkout (not next to a nested worktree), so resolve from the git common dir
MAIN_ROOT="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
PRIVATE_DIR="${DEPLOY_PRIVATE_DIR:-$MAIN_ROOT/../.wt/v5-private/$PROJECT}"
if [ -z "$CONFIG" ]; then
    CONFIG=".artifacts/deploy.code.${STAGE}.json"
    if [ ! -f "$CONFIG" ]; then
        mkdir -p .artifacts
        if [ -f "$PRIVATE_DIR/deploy.code.${STAGE}.json" ]; then
            # a ready code-mode config in the private folder: copy it
            cp "$PRIVATE_DIR/deploy.code.${STAGE}.json" "$CONFIG"
            log "config copied from the private folder → $CONFIG"
        elif [ -f "$PRIVATE_DIR/deploy.${STAGE}.json" ]; then
            # the lane config exists (code or bootstrap mode): keep its account/endpoint/bucket values, force code mode
            jq '{schemaVersion, mode: "code", project, stage, region, account, profile, endpoint, artifactBucket, keyPrefix}' \
                "$PRIVATE_DIR/deploy.${STAGE}.json" > "$CONFIG"
            log "config derived from the private lane config → $CONFIG"
        else
            # nothing private on this machine: create the file from the example and stop so the real values can be filled in
            jq --arg stage "$STAGE" --arg profile "$PROFILE" --arg project "$PROJECT" \
                '.stage = $stage | .profile = $profile | .project = $project | .keyPrefix = ($project + "/" + $stage)' \
                deploy.config.example.json > "$CONFIG"
            die "no config found. Created $CONFIG from deploy.config.example.json — fill account, endpoint and artifactBucket (ask the deploy lane owner), then run again. (private folder checked: $PRIVATE_DIR)"
        fi
    fi
fi
[ -f "$CONFIG" ] || { usage >&2; die "config not found: $CONFIG"; }
CFG_MODE="$(jq -r '.mode // empty' "$CONFIG")"
CFG_STAGE="$(jq -r '.stage // empty' "$CONFIG")"
CFG_PROFILE="$(jq -r '.profile // empty' "$CONFIG")"
CFG_PROJECT="$(jq -r '.project // empty' "$CONFIG")"
[ "$CFG_MODE" = "code" ] || die "config mode must be 'code' (found '${CFG_MODE:-none}'); bootstrap runs are a human step of the deploy lane"
[ "$CFG_STAGE" = "$STAGE" ] || die "config stage '$CFG_STAGE' != --stage '$STAGE'"
[ "$CFG_PROFILE" = "$PROFILE" ] || die "config profile '$CFG_PROFILE' != --profile '$PROFILE'"
[ "$CFG_PROJECT" = "$PROJECT" ] || die "config project '$CFG_PROJECT' is not $PROJECT"
# credentials: read-only identity check, account number hidden
log "identity: $(aws sts get-caller-identity --profile "$PROFILE" --query Arn --output text 2>&1 | redact)"
# source state: a dirty tree is allowed but shown (the manifest records it); prod applies a committed tree only
GIT_SHA="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain)" ]; then
    if [ "$STAGE" = "prod" ] && [ "$PLAN_ONLY" -eq 0 ]; then
        die "prod applies a committed tree only: commit the changes first (--plan-only works on a dirty tree)"
    fi
    log "WARNING: working tree is dirty; the pack manifest will say dirty=true"
fi
BRANCH="$(git branch --show-current || true)"
if [ "$STAGE" = "prod" ] && [ "$BRANCH" != "v5" ]; then
    log "WARNING: prod from '${BRANCH:-detached HEAD}', not v5"
fi
if [ "$STAGE" = "prod" ] && [ -n "$BRANCH" ] && ! git merge-base --is-ancestor HEAD "origin/$BRANCH" 2>/dev/null; then
    log "WARNING: HEAD is not on origin/$BRANCH (push it first, or fetch if it is pushed)"
fi
log "project=$PROJECT stage=$STAGE profile=$PROFILE config=$CONFIG source=$GIT_SHA ($(git branch --show-current || echo detached))"

# ---------- pack ----------
if [ "$SKIP_PACK" -eq 1 ]; then
    [ -n "$ARTIFACT" ] || die "--skip-pack needs --artifact <dir>"
else
    # new output directory per run: stage, time and source sha
    [ -n "$ARTIFACT" ] || ARTIFACT=".artifacts/lambda/${STAGE}-$(date +%Y%m%d-%H%M)-${GIT_SHA}"
    mkdir -p .artifacts/lambda
    log "pack ($PACK_SCRIPT) → $ARTIFACT (Docker, a few minutes)"
    npm run -s "$PACK_SCRIPT" -- --output "$ARTIFACT"
fi
[ -f "$ARTIFACT/manifest.json" ] && [ -f "$ARTIFACT/lambda.zip" ] || die "artifact incomplete: $ARTIFACT"
# show what will be shipped
jq -r '"artifact: runtime=\(.runtime) arch=\(.architecture) source=\(.source.gitSha[:7]) dirty=\(.source.dirty) lockfile=\(.validation.lockfile) handler=\(.validation.handlerExport)"' "$ARTIFACT/manifest.json" | sed 's/^/[deploy-dev] /'
log "package.json in zip: $(unzip -p "$ARTIFACT/lambda.zip" package.json | jq -r '"\(.name)/\(.version) lemon-core \(.dependencies["lemon-core"])"')"
# prod: a reused --artifact must also come from this commit, on a clean tree
if [ "$STAGE" = "prod" ] && [ "$PLAN_ONLY" -eq 0 ]; then
    [ "$(jq -r '.source.dirty' "$ARTIFACT/manifest.json")" = "false" ] || die "prod applies a clean pack only: $ARTIFACT was packed from a dirty tree"
    [ "$(jq -r '.source.gitSha' "$ARTIFACT/manifest.json")" = "$(git rev-parse HEAD)" ] || die "prod applies a pack of the checked-out commit only: $ARTIFACT was packed from another commit"
fi

# ---------- offline plan ----------
PLAN="$ARTIFACT/plan.${STAGE}.json"
log "offline plan → $PLAN"
npm run -s lambda:deploy -- --config "$CONFIG" --artifact "$ARTIFACT" > "$PLAN"
# plan summary without secrets
jq -c '{mode, execution, target, artifact: {sha256: .artifact.sha256[:16], bytes: .artifact.bytes, source: .artifact.source}, steps, changes: .configuration.changes}' "$PLAN" | redact | sed 's/^/[deploy-dev] /'
[ "$(jq -r .mode "$PLAN")" = "code" ] || die "plan mode is not code"
if [ "$PLAN_ONLY" -eq 1 ]; then
    log "plan only: stopping before --apply"
    exit 0
fi

# ---------- confirm ----------
# the apply changes AWS state; dev runs right away unless --ask, prod asks unless --yes
if [ "$ASK" -eq 1 ]; then
    printf '[deploy-dev] apply this plan to %s %s (profile %s)? [y/N] ' "$PROJECT" "$STAGE" "$PROFILE"
    read -r ANSWER || ANSWER="" # no terminal (EOF) counts as no
    case "$ANSWER" in y|Y|yes|YES) ;; *) log "aborted"; exit 1 ;; esac
fi

# ---------- apply ----------
RECEIPTS=".artifacts/deploy/receipts"
mkdir -p "$RECEIPTS"
log "apply (separate command from the plan) → receipts in $RECEIPTS"
APPLY_OUT="$ARTIFACT/apply.${STAGE}.json"
if ! npm run -s lambda:deploy -- --config "$CONFIG" --artifact "$ARTIFACT" --apply --receipt-dir "$RECEIPTS" | tee "$APPLY_OUT" | redact | sed 's/^/[deploy-dev] /'; then
    die "apply did not finish (see $APPLY_OUT). The code may already be live: npm run lambda:invoke -- --stage $STAGE --confirm-stage $STAGE --profile $PROFILE --path /"
fi
STATUS="$(jq -r '.status // empty' "$APPLY_OUT")"
[ "$STATUS" = "completed" ] || die "apply status: ${STATUS:-unknown} (see $APPLY_OUT)"

# ---------- probe ----------
# the service answers its name and lemon-core version on GET /
for P in / /hello/0; do
    log "probe GET $P"
    # lemon-core's stage guard wants --confirm-stage on any stage but dev; the same value is accepted on dev
    if ! npm run -s lambda:invoke -- --stage "$STAGE" --confirm-stage "$STAGE" --profile "$PROFILE" --path "$P" 2>&1 | redact | sed 's/^/[deploy-dev]   /' | tail -6; then
        die "probe GET $P failed after a completed apply: the new code is live, check lambda:logs"
    fi
done
log "done: $(jq -r '.deployId' "$APPLY_OUT") completed in $(jq -r '.durationMs' "$APPLY_OUT") ms"
