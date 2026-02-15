## TODO

- [x] TICKET-006: MVP Twilio setup – configure Twilio API keys via `.env`, add a decoupled messaging layer, and provide a CLI test command that sends a Twilio SMS.
- [ ] TICKET-007: SMS credential capture flow (portal URL, username, password, consent) built on the decoupled Twilio layer.
- [ ] TICKET-008: Design an SMS remediation path when portals ask for extra/unspecified info (send targeted "need more info" prompts, capture data, keep user in the loop).
- [ ] TICKET-009: Add optional credential reuse flow – if the user agrees, encrypt credentials using their phone number + PIN so future SMS sessions can reuse login data securely.
- [ ] TICKET-011: Allow Discord sessions to restart mid-flow when the user issues another trigger (e.g., "new request"), including a clear "start over" confirmation so they can begin a fresh maintenance ticket without cancel.
- [ ] TICKET-012: When a user triggers "new request" or similar, move the conversation into a DM before collecting portal/credentials so all sensitive info stays private.
- [ ] TICKET-011: Allow Discord sessions to restart mid-flow when the user issues another trigger (e.g., "new request"), including a clear "start over" confirmation so they can begin a fresh maintenance ticket without cancel.
- [ ] TICKET-012: When a user triggers "new request" or similar, move the conversation into a DM before collecting portal/credentials so all sensitive info stays private.
