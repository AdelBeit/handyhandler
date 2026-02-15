## TODO

- [x] TICKET-006: MVP Discord setup – configure Discord bot token via `.env`, add a decoupled messaging layer, and provide a CLI test command that sends a Discord message.
- [ ] TICKET-007: Discord credential capture flow (portal URL, username, password, consent) built on the decoupled Discord layer.
- [ ] TICKET-008: Design a Discord remediation path when portals ask for extra/unspecified info (send targeted "need more info" prompts, capture data, keep user in the loop).
- [ ] TICKET-009: Add optional credential reuse flow – if the user agrees, encrypt credentials using their Discord user ID + PIN so future Discord sessions can reuse login data securely.
- [ ] TICKET-014: Provide one-time-token local server URLs for user attachments so automation can fetch them during a run.
- [ ] TICKET-015: Introduce per-session state management to support multi-stage back-and-forth when extra info is needed (store assets and responses per session).
