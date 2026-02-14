# Single-Portal Maintenance Requests MVP (Next.js + DaisyUI)

Summary
Build a single-portal Next.js app with a dummy login, a dashboard shell, separate Profile and Maintenance pages, and a New Request page. Maintenance requests are stored in a JSON file via API routes and can be created and canceled (status update). Styling uses DaisyUI.

Goals & Success Criteria
1. Flow: Login → Dashboard → Profile or Maintenance.
2. Maintenance list shows all requests from JSON.
3. New Request creates a new item and persists it to JSON.
4. Cancel/Delete on a request sets status to “Canceled” (no hard delete).
5. UI uses DaisyUI components. and we can just use different daisyui themes for each portal (right now we just have 1 portal)

Scope & Constraints
- Single portal only.
- Dummy login; any input redirects to dashboard.
- No real auth/session gating or per-user data.
- New Request is a dedicated page (not modal).
- Image handling is placeholder or URL string.

Key Decisions (Locked)
- Styling: DaisyUI (Tailwind-based).
- API naming: /api/maintenance (not /api/requests).
- Status values: New, Resolved, Canceled.
- Cancel behavior: Update status to Canceled; keep record.

App Structure
- Routes:
  - /login — dummy login
  - /dashboard — shell with nav
  - /dashboard/profile — profile view
  - /dashboard/maintenance — maintenance list + CTA
  - /dashboard/maintenance/new — new request form
- API routes:
  - GET /api/maintenance — list all requests
  - POST /api/maintenance — append a new request
  - PATCH /api/maintenance/:id (or POST /api/maintenance/cancel) — update status to Canceled

Data Model
MaintenanceRequest
- id: string
- dateFiled: ISO string
- description: string
- category: string
- unit: string
- status: New | Resolved | Canceled
- imageUrl: string | null

Profile
- Read-only static JSON: name, email, phone, unit, address, leaseEndDate

Behavior & Flow
- Login submit → redirect to /dashboard.
- Maintenance list loads from /api/maintenance.
- New Request form posts to /api/maintenance, then redirect back to list (with success message).
- Cancel action updates status to Canceled via API; list updates without page refresh.

Seed Data
- 3 realistic maintenance requests:
  - Example categories: Plumbing, Electrical, Appliance.
  - Example descriptions: “Kitchen sink leak,” “Bedroom outlet not working,” “AC making noise.”
  - Mix of statuses across New and Resolved.

DaisyUI Usage
- Use standard components: navbar, menu, card, badge, button, input, textarea, select.
- Keep visual design minimal, portal-typical.

Acceptance Tests / Scenarios
1. Login redirects to dashboard.
2. Profile page renders static data.
3. Maintenance list shows seeded requests.
4. New request persists to JSON and appears in list.
5. Cancel sets status to Canceled and remains in list.

Assumptions & Defaults
- File-based JSON storage is acceptable for demo persistence.
- Single-portal name: “HarborGate Property Management” (placeholder).
- No real uploads; image preview uses placeholder/URL.
