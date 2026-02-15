## TODO

- [x] TICKET-006: MVP Discord setup – configure Discord bot token via `.env`, add a decoupled messaging layer, and provide a CLI test command that sends a Discord message.
- [ ] TICKET-007: Discord credential capture flow (portal URL, username, password, consent) built on the decoupled Discord layer.
- [ ] TICKET-008: Design a Discord remediation path when portals ask for extra/unspecified info (send targeted "need more info" prompts, capture data, keep user in the loop).
- [ ] TICKET-009: Add optional credential reuse flow – if the user agrees, encrypt credentials using their Discord user ID + PIN so future Discord sessions can reuse login data securely.
- [ ] TICKET-011: Allow Discord sessions to restart mid-flow when the user issues another trigger (e.g., "new request"), including a clear "start over" confirmation so they can begin a fresh maintenance ticket without cancel.
- [ ] TICKET-012: When a user triggers "new request" or similar, move the conversation into a DM before collecting portal/credentials so all sensitive info stays private.
