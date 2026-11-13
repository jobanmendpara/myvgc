#!/usr/bin/env bash
# Waits up to 150 seconds for a PR's `check` and `smoke / smoke` to finish.
#
#   scripts/wait-for-checks.sh <pr number>
#
# Exits 0 when both pass, 1 when one fails (or is cancelled or skipped), and 2 when one is still
# pending after the wait: call it again. Any other exit code is an error, such as a bad PR number.
#
# Agents run it in the foreground, again and again, until it exits 0 or 1. A Monitor or a
# background `gh pr checks --watch` lets the agent's turn end, which the harness takes as its
# hand-back, and a foreground `--watch` is moved to the background after about 180 seconds
# (docs/wiki/shipping-flow.md, "Waiting for CI"). Hence the bounded wait.
#
# WAIT_FOR_CHECKS_TIMEOUT and WAIT_FOR_CHECKS_INTERVAL (seconds) override the wait and the time
# between polls.
set -euo pipefail
# An unexpected error exits 3, so it is never mistaken for a failed check (1).
trap 'exit 3' ERR

CHECKS=('check' 'smoke / smoke')
timeout=${WAIT_FOR_CHECKS_TIMEOUT:-150}
interval=${WAIT_FOR_CHECKS_INTERVAL:-30}

pr=${1:-}
if [[ ! $pr =~ ^[0-9]+$ || ! $timeout =~ ^[0-9]+$ || ! $interval =~ ^[0-9]+$ ]]; then
  echo "usage: scripts/wait-for-checks.sh <pr number>" >&2
  echo "WAIT_FOR_CHECKS_TIMEOUT and WAIT_FOR_CHECKS_INTERVAL must be whole seconds." >&2
  exit 64
fi

# Prints one "<state><tab><check>" line per named check, where the state is pass, fail or pending.
# A check that isn't reported yet is pending. Exits its subshell with 3 when gh fails for any reason
# other than having no checks to report, which ends the script with 3 too.
poll() {
  local output errors
  errors=$(mktemp)
  # gh may exit non-zero while checks are pending (8) or failing (1); the states it printed still
  # count, so only an empty output with a non-zero exit is treated as an error.
  if ! output=$(gh pr checks "$pr" --json name,bucket --jq '.[] | "\(.bucket)\t\(.name)"' 2>"$errors") \
    && [[ -z $output ]]; then
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

start=$SECONDS
while true; do
  states=$(poll)
  echo "[$((SECONDS - start))s] $(printf '%s\n' "$states" | tr '\t' ' ' | paste -sd ',' - | sed 's/,/, /g')"

  if grep -q '^fail' <<<"$states"; then
    echo "A check failed on PR #$pr."
    exit 1
  fi
  if ! grep -q '^pending' <<<"$states"; then
    echo "Both checks passed on PR #$pr."
    exit 0
  fi
  if ((SECONDS - start + interval > timeout)); then
    echo "Still pending on PR #$pr after $((SECONDS - start))s. Run this script again."
    exit 2
  fi
  sleep "$interval"
done
