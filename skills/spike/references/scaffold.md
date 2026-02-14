# Spike-Orchestrated Linear Workflow Scaffold

## Required markdown file templates

### todo.md
```
# TODO

- [ ] <ticket-id>: <short title>
```

### inprogress.md
```
# IN PROGRESS

- [ ] <ticket-id>: <short title>
  - branch: ticket-<short-name>
  - started: <YYYY-MM-DD HH:MM TZ>
```

### review.md
```
# IN REVIEW

- [ ] <ticket-id>: <short title>
  - branch: ticket-<short-name>
  - pr: <pr-url>
```

### blocked.md
```
# BLOCKED

- [ ] <ticket-id>: <short title>
  - reason: <short blocker>
```

### done.md
```
# DONE

- [x] <ticket-id>: <short title>
```

## Agent definitions (linear handoff)

### spike() Orchestrator Skill
Responsibilities:
- Pick exactly one ticket from `todo.md`.
- Trigger MainAgent for that ticket.
- Stop after triggering MainAgent.

Handoff:
- spike() → MainAgent

### MainAgent
Runs only if the ticket is in `todo.md`.

Actions:
- Create branch: `ticket-<short-name>`.
- Move ticket → `inprogress.md` with branch name and timestamp.
- Commit state change.
- Handoff → ImplementationAgent.

### ImplementationAgent
Runs only if the ticket is in `inprogress.md`.

Actions:
- Check out `ticket-<short-name>`.
- Implement the feature.
- Commit: `feat(ticket-<id>): <short description>`.
- Create PR.
- Move ticket → `review.md` and include PR URL.
- Handoff → GapReviewer.

### GapReviewer
Runs only if the ticket is in `review.md` and PR exists.

Idempotency:
- If PR has comment token `[GAP_REVIEW_COMPLETE]`, exit.

Actions:
- Review strictly against ticket requirements.
- Leave inline comments only.
- If no gaps: add top-level comment `LGTM [GAP_REVIEW_COMPLETE]`.

Constraints:
- Must not suggest new features, redesigns, or refactors.

Handoff:
- GapReviewer → CodeStandardsReviewer

### CodeStandardsReviewer
Runs only if the ticket is in `review.md` and PR exists.

Idempotency:
- If PR has comment token `[STANDARDS_REVIEW_COMPLETE]`, exit.

Actions:
- Review for conciseness and minimalism only.
- Flag duplication, dead code, unnecessary abstraction, complex logic.
- Leave inline comments only.
- If clean: add top-level comment `LGTM [STANDARDS_REVIEW_COMPLETE]`.

Constraints:
- Must not change behavior or add features.
- Must not merge or fix code.

Stop:
- After CodeStandardsReviewer completes, stop. Human takes over.

## Explicit state validation logic

Common checks (all agents):
- If ticket not in expected state file, stop.
- If ticket appears in multiple state files, stop and move to `blocked.md`.
- If required metadata (branch/pr) missing, stop and move to `blocked.md`.

MainAgent validation:
- Ticket must exist in `todo.md` only.

ImplementationAgent validation:
- Ticket must exist in `inprogress.md` with branch set.

GapReviewer validation:
- Ticket must exist in `review.md` with PR URL set.

CodeStandardsReviewer validation:
- Ticket must exist in `review.md` with PR URL set.

## Linear handoff pseudocode

```
spike():
  ticket = pick_first(todo.md)
  call MainAgent(ticket)

MainAgent(ticket):
  assert ticket in todo.md
  branch = "ticket-<short-name>"
  git_checkout_new(branch)
  move_ticket(todo.md, inprogress.md, branch, timestamp)
  git_commit("chore(spike): move to inprogress <ticket-id>")
  call ImplementationAgent(ticket)

ImplementationAgent(ticket):
  assert ticket in inprogress.md with branch
  git_checkout(branch)
  implement()
  git_commit("feat(ticket-<id>): <short description>")
  pr = create_pr()
  move_ticket(inprogress.md, review.md, pr)
  git_commit("chore(spike): move to review <ticket-id>")
  call GapReviewer(ticket)

GapReviewer(ticket):
  assert ticket in review.md with pr
  if pr_has("[GAP_REVIEW_COMPLETE]"):
    return
  review_against_requirements()
  if no_gaps:
    pr_comment("LGTM [GAP_REVIEW_COMPLETE]")
  call CodeStandardsReviewer(ticket)

CodeStandardsReviewer(ticket):
  assert ticket in review.md with pr
  if pr_has("[STANDARDS_REVIEW_COMPLETE]"):
    return
  review_minimalism()
  if clean:
    pr_comment("LGTM [STANDARDS_REVIEW_COMPLETE]")
  return
```

## Reviewer scope enforcement

- Reviewers leave inline comments only; no code changes.
- Review strictly within ticket scope.
- No redesigns, refactors, or new features.
- Post the idempotency token only once.
