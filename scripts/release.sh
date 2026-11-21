#!/usr/bin/env bash
# Cut a decrypts release.
#
# Usage (from anywhere in the repo):
#   VERSION=1.2.3 mise run release            # full release: test, changelog, tag, assets, publish
#   DRY_RUN=1 VERSION=1.2.3 mise run release  # rehearsal on a throwaway worktree; nothing is
#                                             # pushed, tagged or changed in this checkout
#   SKIP_E2E=1 ...                            # skip the Docker e2e suite (prints a loud warning)
#
# Releases are tagged decrypts-vX.Y.Z (SemVer). Fork tags deliberately never
# match upstream's vX.Y.Z pattern, which mise run upstream:check/merge rely on.
set -euo pipefail

# ---------------------------------------------------------------------------
# Arguments and constants
# ---------------------------------------------------------------------------
VERSION="${VERSION:?set VERSION=X.Y.Z (plain SemVer, e.g. VERSION=1.2.3)}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_E2E="${SKIP_E2E:-0}"
REPO="codyro/decrypts.net"
TAG="decrypts-v${VERSION}"
TODAY="$(date +%F)"

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "ERROR: VERSION must be plain SemVer X.Y.Z, got '$VERSION'" >&2; exit 1; }

# Absolute path of the real checkout (the worktree this script was invoked
# from). In DRY_RUN all mutations happen in a throwaway worktree instead.
REAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$REAL_ROOT"

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# check <description> <command...>: abort on failure, unless DRY_RUN, in which
# case print what would have failed and continue the rehearsal.
check() {
  local msg="$1"; shift
  if "$@"; then return 0; fi
  if [ "$DRY_RUN" = "1" ]; then
    warn "DRY_RUN: this would fail: $msg"
    return 0
  fi
  die "$msg"
}

# ---------------------------------------------------------------------------
# Temporary state, cleaned up on exit
# ---------------------------------------------------------------------------
WORKTREE=""
WORKTREE_PARENT=""
DRY_TAG_CREATED=0
WORKER_CFG=""
NOTES_FILE=""
cleanup() {
  if [ -n "$WORKER_CFG" ]; then rm -f "$WORKER_CFG"; fi
  if [ -n "$NOTES_FILE" ]; then rm -f "$NOTES_FILE"; fi
  if [ "$DRY_RUN" = "1" ] && [ "$DRY_TAG_CREATED" = "1" ]; then
    # Tags are shared across worktrees; the rehearsal tag must not linger.
    git -C "$REAL_ROOT" tag -d "$TAG" >/dev/null 2>&1 || true
  fi
  if [ -n "$WORKTREE" ]; then
    git -C "$REAL_ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  fi
  if [ -n "$WORKTREE_PARENT" ]; then rm -rf "$WORKTREE_PARENT"; fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Pre-checks
# ---------------------------------------------------------------------------
log "Pre-checks"

command -v zip >/dev/null || die "zip is not installed"
if [ "$DRY_RUN" = "1" ]; then
  command -v gh >/dev/null || warn "DRY_RUN: gh is not installed (would fail without DRY_RUN)"
  gh auth status >/dev/null 2>&1 || warn "DRY_RUN: 'gh auth status' fails (would fail without DRY_RUN)"
else
  command -v gh >/dev/null || die "gh is not installed"
  gh auth status >/dev/null 2>&1 || die "gh auth status failed; run 'gh auth login' first"
fi

check "not on branch main (switch first)" [ "$(git -C "$REAL_ROOT" branch --show-current)" = "main" ]
check "tracked files are dirty (commit or stash first)" \
  [ -z "$(git -C "$REAL_ROOT" status --porcelain --untracked-files=no)" ]

git -C "$REAL_ROOT" fetch origin
check "local main does not match origin/main (push or pull first)" \
  [ "$(git -C "$REAL_ROOT" rev-parse main)" = "$(git -C "$REAL_ROOT" rev-parse origin/main)" ]

git -C "$REAL_ROOT" rev-parse -q --verify "refs/tags/$TAG" >/dev/null \
  && die "tag $TAG already exists locally"
git -C "$REAL_ROOT" ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1 \
  && die "tag $TAG already exists on origin"

# Newest previous fork release, and the upstream tag this release is based on.
PREV_TAG="$(git -C "$REAL_ROOT" tag --list 'decrypts-v*' --sort=-v:refname | head -n 1)"
if [ -n "$PREV_TAG" ]; then
  PREV_VERSION="${PREV_TAG#decrypts-v}"
  LATEST="$(printf '%s\n%s\n' "$PREV_VERSION" "$VERSION" | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1)"
  [ "$LATEST" = "$VERSION" ] || die "$VERSION is not greater than the last fork release ($PREV_TAG)"
fi
BASE_TAG="$(git -C "$REAL_ROOT" describe --tags --match 'v*' --abbrev=0)"

if [ "$DRY_RUN" = "1" ]; then
  WORKTREE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/decrypts-release.XXXXXX")"
  WORKTREE="$WORKTREE_PARENT/wt"
  log "DRY_RUN: creating throwaway worktree at $WORKTREE (this checkout stays untouched)"
  git -C "$REAL_ROOT" worktree add --detach "$WORKTREE" HEAD >/dev/null
  ROOT="$WORKTREE"
  # The temp worktree's mise.toml is not trusted yet; trust it so mise run
  # does not prompt (or refuse) mid-release.
  mise trust "$WORKTREE/mise.toml" >/dev/null 2>&1 || true
fi

RELEASE_DIR="$ROOT/release"
CL="$ROOT/CHANGELOG_DECRYPTS.md"
RELEASE_HEADING="## ${VERSION} — ${TODAY} (based on upstream ${BASE_TAG})"

# ---------------------------------------------------------------------------
# 2. Tests
# ---------------------------------------------------------------------------
log "Running tests: mise run test"
( cd "$ROOT" && mise run test )
if [ "$SKIP_E2E" = "1" ]; then
  warn "SKIP_E2E=1: the Docker e2e suite was NOT run. Only release anyway if you are sure."
else
  log "Running e2e suite: mise run test:e2e"
  ( cd "$ROOT" && mise run test:e2e )
fi

# ---------------------------------------------------------------------------
# 3. Changelog: rename ## Unreleased, insert a fresh one, keep the notes
# ---------------------------------------------------------------------------
log "Updating CHANGELOG_DECRYPTS.md"
[ -f "$CL" ] || die "$CL not found"
UNRELEASED_BODY="$(awk '/^## Unreleased$/{flag=1; next} /^## /{flag=0} flag' "$CL")"
[ -n "$(printf '%s' "$UNRELEASED_BODY" | tr -d '[:space:]')" ] || die "## Unreleased section is empty; nothing to release"

awk -v new_heading="$RELEASE_HEADING" '
  $0 == "## Unreleased" && !done {
    print "## Unreleased"
    print ""
    print new_heading
    done=1
    next
  }
  { print }
' "$CL" > "$CL.tmp" && mv "$CL.tmp" "$CL"

NOTES_FILE="$(mktemp "${TMPDIR:-/tmp}/decrypts-notes.XXXXXX.md")"
awk -v heading="$RELEASE_HEADING" '$0 == heading { flag=1; print; next } /^## /{flag=0} flag' "$CL" > "$NOTES_FILE"

# ---------------------------------------------------------------------------
# 4. VERSION file, commit, annotated tag
# ---------------------------------------------------------------------------
log "Writing VERSION, committing and tagging $TAG"
printf '%s\n' "$VERSION" > "$ROOT/VERSION"
git -C "$ROOT" add VERSION CHANGELOG_DECRYPTS.md
git -C "$ROOT" commit -m "chore: release decrypts v${VERSION}" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git -C "$ROOT" tag -a "$TAG" -m "decrypts v${VERSION}"
[ "$DRY_RUN" = "1" ] && DRY_TAG_CREATED=1

# ---------------------------------------------------------------------------
# 5. Build release assets into release/
# ---------------------------------------------------------------------------
log "Building release assets into $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# 5a. Frontend: same-origin production build (served by the worker's [assets]).
#     Env vars are set explicitly because process env beats .env files, so a
#     fresh clone builds the same as the owner's machine.
( cd "$ROOT" && VITE_API_BASE='' VITE_IS_TELEGRAM=false pnpm --dir frontend build )
FRONTEND_ZIP="$RELEASE_DIR/decrypts-frontend-${VERSION}.zip"
( cd "$ROOT/frontend/dist" && zip -qr "$FRONTEND_ZIP" . )

# 5b. Worker bundle: wrangler dry-run against a TEMP COPY of
#     wrangler.toml.template. The real worker/wrangler.toml holds production
#     secrets and is never read, copied or modified.
WORKER_CFG="$ROOT/worker/.wrangler-release.toml"
cp "$ROOT/worker/wrangler.toml.template" "$WORKER_CFG"
WORKER_OUT="$(mktemp -d "${TMPDIR:-/tmp}/decrypts-worker.XXXXXX")"
( cd "$ROOT/worker" && pnpm exec wrangler deploy --dry-run --outdir "$WORKER_OUT" --minify --config "$WORKER_CFG" )
WORKER_BUNDLE="$(find "$WORKER_OUT" -maxdepth 1 -name '*.js' | head -n 1)"
[ -n "$WORKER_BUNDLE" ] || die "no worker bundle produced in $WORKER_OUT"
cp "$WORKER_BUNDLE" "$RELEASE_DIR/decrypts-worker-${VERSION}.js"
rm -rf "$WORKER_OUT"
rm -f "$WORKER_CFG"; WORKER_CFG=""

# 5c. Database: schema plus every migration patch.
DB_TMP="$(mktemp -d "${TMPDIR:-/tmp}/decrypts-db.XXXXXX")"
cp "$ROOT"/db/*.sql "$DB_TMP/"
DB_ZIP="$RELEASE_DIR/decrypts-db-${VERSION}.zip"
( cd "$DB_TMP" && zip -qr "$DB_ZIP" . )
rm -rf "$DB_TMP"

# 5d. Checksums.
(
  cd "$RELEASE_DIR"
  if command -v sha256sum >/dev/null; then
    sha256sum "decrypts-frontend-${VERSION}.zip" "decrypts-worker-${VERSION}.js" "decrypts-db-${VERSION}.zip" > SHA256SUMS
  else
    shasum -a 256 "decrypts-frontend-${VERSION}.zip" "decrypts-worker-${VERSION}.js" "decrypts-db-${VERSION}.zip" > SHA256SUMS
  fi
)

log "Assets:"
for f in "$RELEASE_DIR"/*; do
  printf '  %s  %s\n' "$(du -h "$f" | cut -f1)" "$(basename "$f")"
done
if [ "$DRY_RUN" = "1" ]; then
  log "Release notes that would be published:"
  sed 's/^/  | /' "$NOTES_FILE"
fi

# ---------------------------------------------------------------------------
# 6. Publish
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = "1" ]; then
  log "DRY_RUN: would publish with:"
  echo "  git push --atomic origin main refs/tags/$TAG"
  echo "  gh release create $TAG --repo $REPO --verify-tag --title \"decrypts v${VERSION}\" --notes-file <notes> \\"
  echo "      $FRONTEND_ZIP $RELEASE_DIR/decrypts-worker-${VERSION}.js $DB_ZIP $RELEASE_DIR/SHA256SUMS"
else
  log "Publishing"
  # Never `git push --tags`: it would copy all of upstream's v* tags into the fork.
  git -C "$ROOT" push --atomic origin main "refs/tags/$TAG"
  gh release create "$TAG" --repo "$REPO" --verify-tag --title "decrypts v${VERSION}" --notes-file "$NOTES_FILE" \
    "$FRONTEND_ZIP" "$RELEASE_DIR/decrypts-worker-${VERSION}.js" "$DB_ZIP" "$RELEASE_DIR/SHA256SUMS"
fi

# ---------------------------------------------------------------------------
# 7. Next steps
# ---------------------------------------------------------------------------
DB_BASE="${PREV_TAG:-$BASE_TAG}"
if git -C "$ROOT" diff --quiet "$DB_BASE" HEAD -- db/; then
  DB_STATUS="db/ is unchanged since $DB_BASE — no database migration needed."
else
  DB_STATUS="db/ changed since $DB_BASE — run the production migration after deploying (Admin -> Database -> Migrate, or ADMIN_AUTH=… mise run db:migrate)."
fi

log "Next steps"
cat <<EOF
  1. Deploy from this commit:  mise run deploy
  2. $DB_STATUS
EOF
