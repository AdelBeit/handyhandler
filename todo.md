# TODO

- [ ] TICKET-006: MVP Twilio setup – configure Twilio API keys, decoupled messaging layer, CLI command that sends a test SMS.
- [ ] TICKET-007: SMS credential capture flow (portal URL, username, password, consent) built on the decoupled Twilio layer.
- [ ] TICKET-008: Design an SMS remediation path when portals ask for extra/unspecified info (send targeted "need more info" prompts, capture data, keep user in the loop).
- [ ] TICKET-009: Add optional credential reuse flow – if the user agrees, encrypt credentials using their phone number + PIN so future SMS sessions can reuse login data securely.
- [ ] TICKET-010: Add a Discord messaging channel (bot token/webhook) as a second transport option.
