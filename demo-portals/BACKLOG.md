# Portal Demo Backlog (Gaps & Extensions)

MVP scope note: single portal only. Multi-portal selector, branding variants, and portal switching are deferred to backlog items below.

---

## Structure & Routing (Deferred)
- Decide if multi-portal is route-based (`/portal/acme`) or state-based switcher on one page.
- Define portal list and names (real vs fictional) for the portal selector view.
- Determine if each portal needs its own URL for sharable demos.
- Set a default landing path (portal selector vs direct portal).

---

## Visual Differentiation (Deferred)
- Define per-portal theming tokens (colors, typography, logo) while reusing shared components.
- Add portal-specific branding assets (logos, favicon, header treatment).
- Confirm if layout density/spacing should vary by portal.

---

## Auth & Access (MVP is dummy)
- Decide on mock credentials or fully blank login form.
- Decide whether a login CTA should transition to dashboard or just be decorative.
- Confirm if “Forgot password” or “Create account” links are needed (can be nonfunctional).

---

## Dashboard & Navigation
- Define a minimal dashboard home (welcome panel, quick actions) or go straight to Maintenance.
- Finalize menu labels per portal (e.g., “Maintenance Requests” vs “Work Orders”).
- Confirm if Profile is read-only or editable.

---

## Maintenance Requests Data Model
- Required fields: description, date filed, status, image attachments.
- Additional fields to choose: priority, category, unit/location, contact preference, preferred entry time.
- Define valid status values (e.g., New, In Progress, Scheduled, Resolved).

---

## Maintenance List Behavior
- Decide default sort (newest first) and whether filters/tabs are needed.
- Decide if list items expand to show details or open a detail panel.
- Define how image previews appear (thumbnail grid, single thumbnail, placeholder).
- Decide on empty state and “no requests” messaging.

---

## New Request Flow (MVP is dummy)
- MVP requirement: “New Request” opens as a dedicated page (traditional portal flow).
- Determine field validation requirements (if any) for MVP.
- Decide whether the submit action just shows a toast or adds a fake item to list.

---

## Dummy Data & Content
- Provide 3–5 seeded requests per portal (names, dates, statuses, descriptions).
- Provide consistent units/locations (e.g., “Unit 3B”) to make lists realistic.
- Decide on placeholder images or branded maintenance icons.

---

## Accessibility & Responsiveness
- Define mobile layout for login and dashboard.
- Decide on keyboard navigation for menus and list items.
- Ensure contrast targets per portal theme.

---

## Future Extensions (Out of MVP)
- Real authentication and session gating.
- Persistence (localStorage or backend API).
- Real image uploads and previews.
- Role-based UI (tenant vs manager) with different views and actions.
- Activity timeline per request.
- Notifications or message thread per request.
