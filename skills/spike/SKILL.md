---
name: spike
description: Linear SDLC workflow orchestrator for a single ticket at a time. Use when creating or running the spike() pipeline, managing ticket state files (todo/inprogress/review/blocked/done), or generating agent handoff scaffolds and validation logic.
---

# Spike Orchestrator

## Quick start
- Use `spike()` as the only entry point.
- Operate on one ticket at a time.
- Enforce linear flow: `todo.md` → `inprogress.md` → `review.md` → (human merge) → `done.md`.
- If fatal issues, move to `blocked.md` and stop.

## Required files
See `references/scaffold.md` for file templates, agent definitions, and handoff logic.

## Operating rules
- Validate ticket state before every action.
- One agent run per ticket.
- Reviewers are idempotent (post comments once only).
- No agent merges or fixes code; human handles all fixes/merges.

## When updating workflow
- Keep steps deterministic.
- Avoid loops or duplicate reviews.
- Preserve audit trail in git commits and PR comments.
