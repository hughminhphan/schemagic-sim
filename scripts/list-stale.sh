#!/usr/bin/env bash
# List local branches and worktrees whose work is already contained in
# origin/main.
#
# THIS SCRIPT NEVER DELETES ANYTHING. It prints a report and the exact commands
# a human could run. Deciding what to remove is a human decision: a branch can
# be fully merged and still be the only place a reviewer's notes live, and a
# worktree can hold gigabytes of uncommitted campaign data.
#
# "Contained in origin/main" means every commit on the branch is reachable from
# origin/main, which covers squash-merged and rebase-merged branches as well as
# plain merges.
#
# Usage: scripts/list-stale.sh [--fetch]
#   --fetch   run `git fetch origin --prune` first (network access)

set -euo pipefail

BASE="origin/main"
repo_root="$(git rev-parse --show-toplevel)"
main_worktree="$(git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir)"
main_worktree="$(dirname "$main_worktree")"

if [ "${1:-}" = "--fetch" ]; then
  echo "fetching origin..."
  git fetch origin --prune
fi

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "error: $BASE not found. Run 'git fetch origin' first." >&2
  exit 1
fi

base_sha="$(git rev-parse "$BASE")"
echo "base: $BASE ($(git rev-parse --short "$BASE"))"
echo

# ---------------------------------------------------------------------------
# Branches
# ---------------------------------------------------------------------------
current="$(git rev-parse --abbrev-ref HEAD)"
merged=()
active=()

# A branch checked out in ANY worktree is in use. Git refuses to delete it, and
# suggesting it would be noise at best and a lost lane at worst.
checked_out=""
while IFS= read -r line; do
  case "$line" in
    "branch "*) checked_out="${checked_out}
${line#branch refs/heads/}" ;;
  esac
done < <(git worktree list --porcelain)

is_checked_out() {
  printf '%s\n' "$checked_out" | grep -qxF "$1"
}

worktree_for_branch() {
  local wanted="$1" path=""
  while IFS= read -r line; do
    case "$line" in
      "worktree "*) path="${line#worktree }" ;;
      "branch refs/heads/$wanted") printf '%s' "$path"; return 0 ;;
    esac
  done < <(git worktree list --porcelain)
  return 1
}

while IFS= read -r branch; do
  [ -n "$branch" ] || continue
  [ "$branch" = "main" ] && continue
  tip="$(git rev-parse "$branch")"
  if [ "$tip" = "$base_sha" ]; then
    merged+=("$branch|identical to $BASE")
  elif git merge-base --is-ancestor "$branch" "$BASE"; then
    merged+=("$branch|contained in $BASE")
  else
    ahead="$(git rev-list --count "$BASE..$branch")"
    behind="$(git rev-list --count "$branch..$BASE")"
    active+=("$branch|$ahead ahead, $behind behind")
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads)

echo "== Local branches fully contained in $BASE (${#merged[@]}) =="
if [ ${#merged[@]} -eq 0 ]; then
  echo "  none"
else
  for entry in "${merged[@]}"; do
    branch="${entry%%|*}"
    note="${entry#*|}"
    marker=""
    if [ "$branch" = "$current" ]; then
      marker="  <- checked out here, in use"
    elif is_checked_out "$branch"; then
      marker="  <- checked out in $(worktree_for_branch "$branch"), in use"
    fi
    printf '  %-40s %s%s\n' "$branch" "$note" "$marker"
  done
fi
echo

echo "== Local branches with unmerged work (${#active[@]}) =="
if [ ${#active[@]} -eq 0 ]; then
  echo "  none"
else
  for entry in "${active[@]}"; do
    printf '  %-40s %s\n' "${entry%%|*}" "${entry#*|}"
  done
fi
echo

# ---------------------------------------------------------------------------
# Worktrees
# ---------------------------------------------------------------------------
echo "== Worktrees =="
stale_worktrees=()
path=""
branch=""
while IFS= read -r line; do
  case "$line" in
    "worktree "*) path="${line#worktree }" ;;
    "branch "*)   branch="${line#branch refs/heads/}" ;;
    "detached")   branch="(detached)" ;;
    "")
      [ -n "$path" ] || continue
      size="$(du -sh "$path" 2>/dev/null | cut -f1 || echo "?")"
      state="active"
      if [ "$path" = "$main_worktree" ]; then
        state="main worktree"
      elif [ "$branch" != "(detached)" ] && [ -n "$branch" ] \
           && git merge-base --is-ancestor "refs/heads/$branch" "$BASE" 2>/dev/null; then
        dirty="$(git -C "$path" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
        if [ "$dirty" != "0" ]; then
          state="contained in $BASE but has $dirty uncommitted change(s)"
        else
          state="contained in $BASE, clean"
          stale_worktrees+=("$path|$branch|$size")
        fi
      fi
      printf '  %-58s %-24s %6s  %s\n' "$path" "$branch" "$size" "$state"
      path=""; branch=""
      ;;
  esac
done < <(git worktree list --porcelain; echo)
echo

# ---------------------------------------------------------------------------
# Suggested commands, printed only. Nothing here is executed.
# ---------------------------------------------------------------------------
if [ ${#merged[@]} -gt 0 ] || [ ${#stale_worktrees[@]} -gt 0 ]; then
  echo "== Suggested commands (NOT run by this script) =="
  for entry in "${stale_worktrees[@]}"; do
    echo "  git worktree remove ${entry%%|*}"
  done
  for entry in "${merged[@]}"; do
    branch="${entry%%|*}"
    is_checked_out "$branch" && continue
    echo "  git branch -d $branch"
  done
  echo
  echo "  Review each line before running it. Check a worktree for untracked"
  echo "  campaign data first; 'git status' does not show ignored files."
fi
