# TODO

- [ ] TICKET-006: Design/ticket the SMS credential capture flow: prompt for portal URL, username, password, and consent before storing them (encrypted vault) for MVP.
- [ ] TICKET-007: Design an SMS remediation path when portals ask for extra/unspecified info (send targeted "need more info" prompts, capture data, keep user in the loop).
- [ ] TICKET-008: Add optional credential reuse flow – if the user agrees, encrypt credentials using their phone number + PIN so future SMS sessions can reuse login data securely.
