#!/usr/bin/env bash
# Waits up to 170 seconds for a PR's `check` and `smoke / smoke` to finish and, when auto-merge is
# queued (`gh pr merge <n> --auto --merge --delete-branch`), for GitHub to merge it.
#
#   scripts/wait-for-checks.sh <pr number>
#
# Exit codes:
#   0   both checks passed and the PR is merged (it prints the merge commit), or both passed and no
#       auto-merge is queued.
#   1   a check failed (or was cancelled or skipped): fix it and push.
#   2   a check or the queued merge is still pending at the deadline, or `gh` hasn't answered by
#       then: call it again.
#   3   `gh` failed, or another unexpected error: call it again. GitHub's transient "GraphQL:
#       Something went wrong" is retried once first, a few seconds later (DEV-236), so it exits 3
#       only when the retry fails too.
#   4   the PR conflicts with main (`mergeStateStatus` is `DIRTY`), so auto-merge can't land: rebase
#       onto origin/main, push with `--force-with-lease`, and call it again.
#   5   both checks passed but the risky-path gate (`risky-change-gate`) is failing: the PR changes a
#       risky path and is waiting on the maintainer to add `approved` (DEV-273). Don't call it
#       again: tell the maintainer. Auto-merge stays queued, so adding the label is the merge.
#   64  a bad PR number or setting.
# A failed check is reported before a conflict or a waiting gate. The gate counts only once it is
# reported: on a PR that runs no gate, as before the gate's workflow exists, the script behaves as
# it did without it. While the gate is pending, the script waits for it like a check. While checks are pending, and while auto-merge is
# queued, it also asks `gh pr view` whether the PR has gone `DIRTY`, as when another PR merged first
# (DEV-181).
#
# Agents run it in the foreground, again and again, until it exits 0 or 1. A Monitor or a
# background `gh pr checks --watch` lets the agent's turn end, which the harness takes as its
# hand-back, and the harness moves any foreground command to the background after 180 seconds,
# whatever its Bash timeout: a 10-minute timeout didn't change that on 2026-11-25 (DEV-240;
# docs/wiki/shipping-flow.md, "Waiting for CI"). Hence the bounded wait: one deadline covers every
# phase, and a `gh` call still running at the deadline is killed. The 170-second default leaves
# 10 seconds of the 180 for a slow start and killing a last `gh` call. Time the machine spends asleep
# counts against the deadline, as it does against the harness's limit, so a call that sleeps past
# the deadline exits 2 when the machine wakes, without asking `gh` again.
#
# WAIT_FOR_CHECKS_TIMEOUT, WAIT_FOR_CHECKS_INTERVAL and WAIT_FOR_CHECKS_RETRY_DELAY (seconds)
# override the wait, the time between polls and the wait before retrying a GraphQL error. scripts/wait-for-checks.test.ts (`pnpm test:scripts`) tests the script with a stub
# `gh`.
set -euo pipefail
# An unexpected error exits 3, so it is never mistaken for a failed check (1).
trap 'exit 3' ERR

CHECKS=('check' 'smoke / smoke')
# The risky-path gate's check: the job name in .github/workflows/risky-change-gate.yml (DEV-289).
GATE='risky-change-gate'
timeout=${WAIT_FOR_CHECKS_TIMEOUT:-170}
interval=${WAIT_FOR_CHECKS_INTERVAL:-30}
retry_delay=${WAIT_FOR_CHECKS_RETRY_DELAY:-5}
# With branch protection on main (2026-11-15), a queued auto-merge lands a few seconds after the
# checks pass, so it is polled more often than the checks: every 5 seconds, or every
# WAIT_FOR_CHECKS_INTERVAL when that is shorter.
merge_interval=$((interval < 5 ? interval : 5))

pr=${1:-}
if [[ ! $pr =~ ^[0-9]+$ || ! $timeout =~ ^[0-9]+$ || ! $interval =~ ^[0-9]+$ ||
  ! $retry_delay =~ ^[0-9]+$ ]]; then
  echo "usage: scripts/wait-for-checks.sh <pr number>" >&2
  echo "WAIT_FOR_CHECKS_TIMEOUT, WAIT_FOR_CHECKS_INTERVAL and WAIT_FOR_CHECKS_RETRY_DELAY must be whole seconds." >&2
  exit 64
fi

start=$SECONDS
deadline=$((start + timeout))
echo "Waiting up to ${timeout}s for PR #$pr."

# Exits 2, saying what is still pending.
out_of_time() {
  echo "$1 on PR #$pr after $((SECONDS - start))s. Run this script again."
  exit 2
}

# Runs a command until the deadline at most. A command still running then is stopped (SIGTERM,
# then SIGKILL a second later), and this returns 124, as coreutils' `timeout` does (macOS has no
# `timeout`).
by_deadline() {
  "$@" &
  local pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if ((SECONDS >= deadline)); then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -KILL "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 0.2
  done
  wait "$pid"
}

# Runs `gh <args...>` by the deadline, printing its output, with its errors in the file <errors>,
# and returns its exit status. GitHub now and then fails a call with "GraphQL: Something went
# wrong" and answers the same call a few seconds later (DEV-236), so that error is retried once,
# after retry_delay seconds. When the retry would start at the deadline or later, this returns
# 124, as if gh hadn't answered by then.
ask_gh() {
  local errors=$1 output status=0
  shift
  output=$(by_deadline gh "$@" 2>"$errors") || status=$?
  if ((status != 0 && status != 124)) && grep -q 'GraphQL: Something went wrong' "$errors"; then
    if ((SECONDS + retry_delay >= deadline)); then
      echo "gh $1 $2 failed with a GraphQL error, and there's no time left to retry it." >&2
      return 124
    fi
    echo "gh $1 $2 failed with a GraphQL error; retrying in ${retry_delay}s." >&2
    sleep "$retry_delay"
    status=0
    output=$(by_deadline gh "$@" 2>"$errors") || status=$?
  fi
  printf '%s' "$output"
  return "$status"
}

# Waits <seconds> before the next poll, or exits 2 when that poll would start at the deadline or
# later.
pause() {
  if ((SECONDS + $1 >= deadline)); then out_of_time "$2"; fi
  sleep "$1"
}

# Prints one "<state><tab><check>" line per named check, where the state is pass, fail or pending.
# A check that isn't reported yet is pending, and so is every check when gh hasn't answered by the
# deadline. Then, when the gate is reported, one "gate-<state><tab><gate>" line for it. Exits its subshell with 3 when gh fails for any reason other than having no checks to
# report, which ends the script with 3 too.
poll() {
  local output errors status=0
  errors=$(mktemp)
  # gh may exit non-zero while checks are pending (8) or failing (1); the states it printed still
  # count, so only an empty output with a non-zero exit is treated as an error.
  output=$(ask_gh "$errors" pr checks "$pr" --json name,bucket --jq '.[] | "\(.bucket)\t\(.name)"') \
    || status=$?
  if ((status == 124)); then
    echo "gh pr checks didn't answer by the deadline." >&2
  elif ((status != 0)) && [[ -z $output ]]; then
    # Straight after a push, and while a run is queued, gh says "no checks reported".
    if ! grep -q 'no checks reported' "$errors"; then
      cat "$errors" >&2
      rm -f "$errors"
      exit 3
    fi
  fi
  rm -f "$errors"

  local name bucket
  for name in "${CHECKS[@]}"; do
    bucket=$(printf '%s\n' "$output" | awk -F '\t' -v name="$name" '$2 == name { print $1; exit }')
    case $bucket in
      pass) printf 'pass\t%s\n' "$name" ;;
      pending | '') printf 'pending\t%s\n' "$name" ;;
      *) printf 'fail\t%s (%s)\n' "$name" "$bucket" ;;
    esac
  done
  bucket=$(printf '%s\n' "$output" | awk -F '\t' -v name="$GATE" '$2 == name { print $1; exit }')
  case $bucket in
    '') ;;
    pass) printf 'gate-pass\t%s\n' "$GATE" ;;
    pending) printf 'gate-pending\t%s\n' "$GATE" ;;
    *) printf 'gate-fail\t%s (%s)\n' "$GATE" "$bucket" ;;
  esac
}

# Asks gh about the PR and sets state and queued. Exits 0 when the PR is merged (printing the merge
# commit), 4 when it conflicts with main, 3 when gh fails, and 2, saying <pending>, when gh hasn't
# answered by the deadline.
view() {
  local output commit merge_state errors status=0
  errors=$(mktemp)
  output=$(ask_gh "$errors" pr view "$pr" --json state,autoMergeRequest,mergeCommit,mergeStateStatus \
    --jq '[.state, (.autoMergeRequest != null), .mergeStateStatus, (.mergeCommit.oid // "")] | @tsv') \
    || status=$?
  if ((status != 0 && status != 124)); then cat "$errors" >&2; fi
  rm -f "$errors"
  if ((status == 124)); then out_of_time "$1"; fi
  if ((status != 0)); then exit 3; fi
  # The merge commit, which may be empty, comes last: `read` merges runs of tabs.
  IFS=$'\t' read -r state queued merge_state commit <<<"$output"
  if [[ -z $state ]]; then
    echo "gh pr view gave no state for PR #$pr." >&2
    exit 3
  fi
  if [[ $state == MERGED ]]; then
    echo "PR #$pr merged as $commit."
    exit 0
  fi
  if [[ $state == OPEN && $merge_state == DIRTY ]]; then
    echo "PR #$pr conflicts with main (mergeStateStatus DIRTY), so auto-merge can't land."
    echo "Rebase onto origin/main, push with --force-with-lease, and run this script again."
    exit 4
  fi
}

while true; do
  # Already past the deadline, as when the machine slept: don't start another gh call.
  if ((SECONDS >= deadline)); then out_of_time 'Still pending'; fi
  states=$(poll)
  echo "[$((SECONDS - start))s] $(printf '%s\n' "$states" | tr '\t' ' ' | paste -sd ',' - | sed 's/,/, /g')"

  if grep -q '^fail' <<<"$states"; then
    echo "A check failed on PR #$pr."
    exit 1
  fi
  if ! grep -q '^pending' <<<"$states"; then
    if grep -q '^gate-fail' <<<"$states"; then
      echo "Both checks passed on PR #$pr, but it changes a risky path: it's waiting on the maintainer"
      echo "to add \`approved\` (the $GATE check). Tell the maintainer; adding the label merges it."
      exit 5
    fi
    if ! grep -q '^gate-pending' <<<"$states"; then
      echo "Both checks passed on PR #$pr."
      break
    fi
  fi
  # A check is pending; one reason is a conflict, since GitHub runs no checks on a DIRTY PR.
  if ((SECONDS >= deadline)); then out_of_time 'Still pending'; fi
  view "gh pr view didn't answer, so a check may be pending"
  pause "$interval" 'Still pending'
done

while true; do
  if ((SECONDS >= deadline)); then out_of_time 'Auto-merge still pending'; fi
  view "gh pr view didn't answer, so auto-merge may be pending"
  if [[ $state != OPEN || $queued != true ]]; then
    echo "PR #$pr is $state with no auto-merge queued."
    exit 0
  fi
  pause "$merge_interval" 'Auto-merge still pending'
done
