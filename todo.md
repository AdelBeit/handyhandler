# TODO

- [ ] TICKET-006: MVP Twilio setup – configure Twilio API keys, build a decoupled messaging layer, and add `scripts/send-test-sms.js` for sending test messages.
- [ ] TICKET-007: SMS credential capture flow (prompt for portal URL, username, password, consent) running on top of the messaging layer.
- [ ] TICKET-008: SMS remediation path when portals ask for extra/unspecified info (send targeted “need more info” replies and capture data).
- [ ] TICKET-009: Optional credential reuse (store encrypted creds tied to phone+PIN for future SMS sessions).
