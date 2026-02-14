Decoupled TinyFish Integration + Credential Storage (MVP)

Design Goals
- Business logic never handles raw credentials directly.
- TinyFish integration isolated behind a narrow interface.
- Credentials stored minimally and encrypted at rest.
- Clear path to upgrade from CLI-only to SMS/tenant onboarding later.

High-Level Architecture
- core/ (business logic)
  - Takes structured inputs: PortalAuthRef, MaintenanceRequest, PortalUrl.
  - No TinyFish API calls here.
- integrations/tinyfish/
  - Translates a structured request into TinyFish goal + url and runs run-sse.
- secrets/
  - Stores/retrieves portal credentials by tenant_id or auth_ref.
  - Returns decrypted credentials only to the TinyFish integration layer.

1) Credential Storage (MVP-safe)
Storage option (MVP):
- Encrypted JSON blob stored on disk (e.g., ./data/credentials.enc).
- Encryption via AES-GCM using a master key in .env (e.g., CREDENTIALS_MASTER_KEY).
- Each record: { id, portal_url, username, password, metadata, created_at }.

Why this works for MVP
- Keeps credentials out of logs, out of code, and out of git.
- All access is through a single vault module.

Interfaces (proposed)
```ts
// secrets/vault.ts
type CredentialRecord = {
  id: string
  portalUrl: string
  username: string
  password: string
  createdAt: string
  metadata?: Record<string, string>
}

interface CredentialsVault {
  put(record: CredentialRecord): Promise<string>      // returns id
  get(id: string): Promise<CredentialRecord>
  delete(id: string): Promise<void>
}
```

2) TinyFish Integration (decoupled)
Goal: Core logic calls AutomationRunner.run() without knowing TinyFish.

```ts
// integrations/automation.ts
type AutomationRequest = {
  portalUrl: string
  credentials: { username: string; password: string }
  issue: { description: string; category?: string; urgency?: string }
  extras?: Record<string, string>
}

type AutomationResult = {
  success: boolean
  confirmation?: string
  raw?: unknown
}

interface AutomationRunner {
  run(req: AutomationRequest): Promise<AutomationResult>
}
```

TinyFish-specific implementation:
```ts
// integrations/tinyfish/runner.ts
class TinyFishRunner implements AutomationRunner {
  run(req: AutomationRequest): Promise<AutomationResult> { ... }
}
```

3) Business Logic stays clean
```ts
// core/submitRequest.ts
async function submitMaintenanceRequest(input) {
  const creds = await vault.get(input.authRef)
  const result = await automation.run({
    portalUrl: input.portalUrl,
    credentials: creds,
    issue: input.issue
  })
  return result
}
```

4) Security Notes (MVP-appropriate)
- .env contains TINYFISH_API_KEY + CREDENTIALS_MASTER_KEY.
- .gitignore includes .env and data/.
- Never print credentials to console.
- Add optional LOG_REDACTION filter for debug output.

5) Future-proofing (Phase 2)
- Swap the vault to use a proper KMS / hosted secrets (AWS KMS, GCP, etc).
- Replace TinyFish runner with another provider without touching core logic.
