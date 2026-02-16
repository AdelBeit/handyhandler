# DONE

- [x] TICKET-001: Add decoupled automation interface and TinyFish runner
- [x] TICKET-003: Wire core submitMaintenanceRequest flow (vault -> automation)
- [x] TICKET-002: Add plaintext credentials store (data/credentials.json) + sample format
- [x] TICKET-004: Run credential-backed login smoke test via `scripts/login-smoke-test.js`
- [x] TICKET-005: Run full maintenance smoke test via `scripts/maintenance-smoke-test.js` (login + submission + landing-page count)
- [x] TICKET-010: Add a Discord messaging channel (bot token/webhook) as a second transport option
- [x] TICKET-012: Move "new request" Discord intake to DMs before collecting portal credentials
- [x] TICKET-011: Allow Discord sessions to restart mid-flow when the user issues another trigger (e.g., "new request"), including a clear "start over" confirmation
- [x] TICKET-013: Allow users to send images/documents for maintenance requests and delete after submission
- [x] TICKET-015: Handle remediation when the agent needs more info/images and keep sessions open until the user responds
- [x] TICKET-022: Confirm inferred field values and safely accept only enumerated options when user says no
- [x] TICKET-021: Flow V2 bulk intake
- [x] TICKET-020: Request status lookup
