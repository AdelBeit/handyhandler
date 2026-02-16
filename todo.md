## TODO

- [x] TICKET-006: MVP Discord setup – configure Discord bot token via `.env`, add a decoupled messaging layer, and provide a CLI test command that sends a Discord message.
- [ ] TICKET-009: Add optional credential reuse flow – if the user agrees, encrypt credentials using their Discord user ID + PIN so future Discord sessions can reuse login data securely.
- [ ] TICKET-007: Discord credential capture flow (portal URL, username, password, consent) built on the decoupled Discord layer.
- [ ] TICKET-025: Portal required-fields detection – detect required fields from each portal’s form and prompt only for those before submission.
- [ ] TICKET-014: Provide one-time-token local server URLs for user attachments so automation can fetch them during a run.
- [ ] TICKET-016: Cleanup dangling sessions/assets after 24 hours or when TinyFish fails and awaits user input. Notify the user on timeout/failure and remove temp assets.
