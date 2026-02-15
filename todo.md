# TODO

- [ ] TICKET-006A: MVP Twilio setup – configure Twilio API keys, decoupled messaging layer, CLI command that sends a test SMS.
- [ ] TICKET-006B: SMS credential capture flow (portal URL, username, password, consent) built on top of the decoupled Twilio layer.
- [ ] TICKET-007: Design an SMS remediation path when portals ask for extra/unspecified info (send targeted "need more info" prompts, capture data, keep user in the loop).
- [ ] TICKET-008: Add optional credential reuse flow – if the user agrees, encrypt credentials using their phone number + PIN so future SMS sessions can reuse login data securely.
