MVP Plan (Phase 1)

Goal
Deliver a CLI-based web agent that can log into a tenant’s rental portal and submit a complete maintenance request, with basic manual handoff for edge cases.

Core User Flow (CLI MVP)
1. Operator provides portal URL and tenant credentials via CLI.
2. Operator describes the maintenance issue.
3. Agent logs in, infers required fields from the portal UI, and fills out the request.
4. Agent submits the ticket and returns proof-of-submission.
5. Agent asks follow-up questions in the CLI if the portal requires missing details.

Target Scope (Hackathon MVP)
- CLI-only interface for testing and demos.
- Works with any portal URL the operator supplies.
- Form-field inference per portal (no predefined schema).
- Manual handoff for CAPTCHA/OTP when prompted.
- Proof-of-submission (confirmation page capture).

Feature List
- CLI input
  - Portal URL and credentials
  - Issue description and follow-up answers
- Portal automation
  - Login
  - Form completion and submission
  - Error detection and retry
- Human-in-the-loop
  - Manual solve for CAPTCHA/OTP
  - Escalation when submission fails
- Output
  - Confirmation summary and proof-of-submission


Success Criteria
- Agent can submit complete tickets on multiple real portals via CLI
- Median time from CLI input to submission under 5 minutes
- Clear proof-of-submission for every ticket

Risks and Mitigations
- Portal variability
  - Use dynamic field inference and fallback questioning
- CAPTCHA/OTP friction
  - Fast manual handoff path
- Portal DOM changes
  - Robust selectors and fallback flows
