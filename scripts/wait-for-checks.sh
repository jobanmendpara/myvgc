#!/usr/bin/env bash
# Waits up to 150 seconds for a PR's `check` and `smoke / smoke` to finish and, when auto-merge is
# queued (`gh pr merge <n> --auto --merge --delete-branch`), for GitHub to merge it.
#
#   scripts/wait-for-checks.sh <pr number>
#
# Exits 0 when both pass and the PR is merged (it prints the merge commit), or when both pass and
# no auto-merge is queued; 1 when one fails (or is cancelled or skipped); and 2 when a check or the
# queued merge is still pending at the deadline, or `gh` hasn't answered by then: call it again.
# Any other exit code is an error, such as a bad PR number (64) or a `gh` failure (3).
#
# Agents run it in the foreground, again and again, until it exits 0 or 1. A Monitor or a
# background `gh pr checks --watch` lets the agent's turn end, which the harness takes as its
# hand-back, and a foreground `--watch` is moved to the background after about 180 seconds
# (docs/wiki/shipping-flow.md, "Waiting for CI"). Hence the bounded wait: one deadline covers every
# phase, and a `gh` call still running at the deadline is killed. Time the machine spends asleep
# counts against the deadline, as it does against the harness's limit, so a call that sleeps past
# the deadline exits 2 when the machine wakes, without asking `gh` again.
#
# WAIT_FOR_CHECKS_TIMEOUT and WAIT_FOR_CHECKS_INTERVAL (seconds) override the wait and the time
# between polls. scripts/wait-for-checks.test.ts (`pnpm test:scripts`) tests the script with a stub
# `gh`.
set -euo pipefail
# An unexpected error exits 3, so it is never mistaken for a failed check (1).
trap 'exit 3' ERR

CHECKS=('check' 'smoke / smoke')
timeout=${WAIT_FOR_CHECKS_TIMEOUT:-150}
interval=${WAIT_FOR_CHECKS_INTERVAL:-30}
# With branch protection on main (2026-11-15), a queued auto-merge lands a few seconds after the
# checks pass, so it is polled more often than the checks: every 5 seconds, or every
# WAIT_FOR_CHECKS_INTERVAL when that is shorter.
merge_interval=$((interval < 5 ? interval : 5))

pr=${1:-}
if [[ ! $pr =~ ^[0-9]+$ || ! $timeout =~ ^[0-9]+$ || ! $interval =~ ^[0-9]+$ ]]; then
  echo "usage: scripts/wait-for-checks.sh <pr number>" >&2
  echo "WAIT_FOR_CHECKS_TIMEOUT and WAIT_FOR_CHECKS_INTERVAL must be whole seconds." >&2
  exit 64
fi

start=$SECONDS
deadline=$((start + timeout))

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

# Waits <seconds> before the next poll, or exits 2 when that poll would start at the deadline or
# later.
pause() {
  if ((SECONDS + $1 >= deadline)); then out_of_time "$2"; fi
  sleep "$1"
}

# Prints one "<state><tab><check>" line per named check, where the state is pass, fail or pending.
# A check that isn't reported yet is pending, and so is every check when gh hasn't answered by the
# deadline. Exits its subshell with 3 when gh fails for any reason other than having no checks to
# report, which ends the script with 3 too.
poll() {
  local output errors status=0
  errors=$(mktemp)
  # gh may exit non-zero while checks are pending (8) or failing (1); the states it printed still
  # count, so only an empty output with a non-zero exit is treated as an error.
  output=$(by_deadline gh pr checks "$pr" --json name,bucket --jq '.[] | "\(.bucket)\t\(.name)"' \
    2>"$errors") || status=$?
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
    echo "Both checks passed on PR #$pr."
    break
  fi
  pause "$interval" 'Still pending'
done

while true; do
  if ((SECONDS >= deadline)); then out_of_time 'Auto-merge still pending'; fi
  status=0
  view=$(by_deadline gh pr view "$pr" --json state,autoMergeRequest,mergeCommit \
    --jq '[.state, (.autoMergeRequest != null), (.mergeCommit.oid // "")] | @tsv') || status=$?
  if ((status == 124)); then out_of_time "gh pr view didn't answer, so auto-merge may be pending"; fi
  if ((status != 0)); then exit 3; fi
  IFS=$'\t' read -r state queued commit <<<"$view"
  if [[ -z $state ]]; then
    echo "gh pr view gave no state for PR #$pr." >&2
    exit 3
  fi
  if [[ $state == MERGED ]]; then
    echo "PR #$pr merged as $commit."
    exit 0
  fi
  if [[ $state != OPEN || $queued != true ]]; then
    echo "PR #$pr is $state with no auto-merge queued."
    exit 0
  fi
  pause "$merge_interval" 'Auto-merge still pending'
done
