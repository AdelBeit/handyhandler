Backlog

Post-MVP (Phase 1.5)
- Implement encrypted credential vault with AES-GCM and tie it into automation runner (per `tinyfishdesigniteration.md`).
- Define failure-state UX and recovery messaging
- Logging and traceability plan for proof-of-submission (what is stored, retention)
- Human-in-the-loop operational process (SLA, staffing, escalation policy)

Phase 2
- Tenant SMS channel integration (e.g., Tully)
- Tenant identity verification and onboarding flow
- Portal URL intake and credential setup flow
- Switch plaintext credentials store to encrypted JSON blob (AES-GCM) using CREDENTIALS_MASTER_KEY
- Credential storage policy and security requirements
- OTP timeout, retry, and fallback behavior
- Attachments support (photos/videos)
- Compliance/privacy policy (PII handling, consent)
- Expanded success criteria (error rate, user satisfaction)
- Multilingual support
- Handyman workflow integration and marketplace coordination
