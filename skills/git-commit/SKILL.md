---
name: git-commit
description: Create git commits consistently. Use when the user asks to make a commit, commit changes, or run git commit.
---

# Git Commit

## Workflow
1. Check `git status` to confirm what will be committed.
2. If there are unstaged changes, stage them with `git add` (either all or specific paths as requested).
3. Create a commit with a clear message using `git commit -m "<message>"`.
4. Show `git log -1` or `git show --stat -1` to confirm the commit.

## Notes
- Do not amend commits unless explicitly requested.
- Avoid destructive git commands unless asked.
- If the user wants a message but doesn’t provide one, propose a short, concrete message and confirm.
