---
name: git-pr
description: Create GitHub pull requests using the gh CLI. Use when the user asks to open a PR, create a pull request, or run gh pr create.
---

# Git PR

## Workflow
1. Check `git status` and `git log -1` to confirm the branch is ready.
2. Push the current branch if it isn’t on the remote yet.
3. Create the PR with `gh pr create`.
4. Summarize the PR URL and key metadata (title, base, head).

## Notes
- If no PR title/body is provided, prompt the user for them or propose defaults.
- Do not run tests unless the user asks.
