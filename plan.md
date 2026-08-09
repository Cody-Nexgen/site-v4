# FocuzNow Enterprise — Product Plan

Turn FocuzNow from a personal focus product into an **org-managed** platform: admins oversee teams, enforce block policies, and review screen-time / focus history per user and group.

## Goals

- Companies, schools, and teams can manage members under one org.
- Admins can view individual and group analytics (screen time, focus/pomodoro, blocks).
- Admins can push blocklists / allowlists to a user, a group, or the whole org.
- Members keep a familiar FocuzNow experience; policy and reporting are additive.
- Security-first: RLS everywhere, least privilege, audit trail for admin actions.

## Non-goals (v1)

- Full MDM / device management outside the browser extension.
- Replacing HRIS / SSO provisioning platforms (support SSO later; manual invite first).
- Billing complexity beyond a simple Enterprise seat SKU.

---

## Roles

| Role | Capabilities |
|------|----------------|
| **Owner** | Billing, delete org, manage admins, all admin powers |
| **Admin** | Invite/remove members, manage groups, block policies, view analytics |
| **Member** | Normal FocuzNow usage; org policies applied on top of personal settings |
| **Viewer** (optional) | Read-only analytics, no policy changes |

---

## Data model (Supabase)

### Core tables

- `organizations` — id, name, slug, plan, settings jsonb, created_at
- `org_memberships` — org_id, user_id, role, status (`invited` \| `active` \| `suspended`), joined_at
- `org_invites` — email, role, token, expires_at, invited_by
- `org_groups` — org_id, name, description
- `org_group_members` — group_id, user_id

### Policy

- `org_policies` — org_id, scope (`org` \| `group` \| `user`), target_id, payload jsonb  
  Payload examples:
  - `blocklist: string[]`
  - `allowlist: string[]`
  - `nuclear_lockdown: boolean`
  - `schedule: { days, hours }`
  - `force_focus_mode: boolean`
- `org_policy_revisions` — immutable history of policy changes (who/when/diff)

### Analytics (aggregated, privacy-aware)

Prefer **daily aggregates** over raw URL streams for org dashboards:

- `org_user_day_stats` — user_id, org_id, date, screen_ms, focus_ms, blocked_count, top_domains jsonb (capped)
- Optional later: `org_focus_sessions` for pomodoro segments

### Audit

- `org_audit_log` — actor_id, action, target, metadata, created_at  
  (invite, role change, policy publish, member remove, export)

### RLS principles

- Members read only their own detailed stats.
- Admins/Owners read aggregates for users in their org.
- Policy writes restricted to Admin/Owner; members receive applied policy via RPC/edge function.
- Never expose other members’ raw browsing history to non-admins.

---

## Product surfaces

### 1. Admin console (web)

New area under `/app` or `/admin`:

1. **Org overview** — seats used, active today, focus hours, top blocked domains  
2. **People** — invite, role, group assignment, suspend  
3. **Groups** — create teams/classes; assign policies  
4. **Policies** — block/allow lists with scope picker (org / group / user)  
5. **User detail** — 7/30-day screen + focus charts, recent blocks, applied policies  
6. **Audit log** — searchable admin actions  
7. **Billing** — Enterprise seats (Stripe)

### 2. Extension / member app

- On sync: fetch **effective policy** = merge(org → group → user) over personal settings.
- Clear UI badge: “Managed by {Org}” when org policies apply.
- Member cannot remove org-forced blocks (personal blocks still editable).
- Heartbeat / daily rollup upload for org analytics (with consent / org terms).

### 3. Invite & onboarding

1. Admin invites email → magic link / Google SSO  
2. User installs extension (or already has it)  
3. Membership activates → policy sync starts  
4. Optional domain join: `@company.com` auto-suggest org

---

## Policy merge rules

Order of precedence (highest wins for *blocks*):

1. User-scoped org policy  
2. Group-scoped org policy (union of all groups)  
3. Org-wide policy  
4. Member personal blocklist  

Allowlists: org allowlist can override blocks only if Admin marks `allow_override: true`.

Schedule / lockdown: most restrictive wins.

Ship a single RPC: `get_effective_org_policy(user_id)` returning the merged payload + revision hash so the extension can skip no-op syncs.

---

## Analytics pipeline

### Client → cloud

- Extension already tracks `screenTime_*` and (new) `focusTime_*`.
- Daily (or on idle): call `upsert_org_day_stats` with aggregates only.
- Cap `top_domains` (e.g. top 20) to limit PII surface.

### Admin queries

- Org rollups via materialized views or SQL aggregates on `org_user_day_stats`.
- User drill-down: same table filtered by user_id (admin RLS).

### Privacy controls

- Org setting: `share_domain_detail` on/off (off = totals only).
- Retention: configurable 30/90/365 days; purge job.
- Export: CSV for admins; logged in audit.

---

## Billing

- Stripe product: **FocuzNow Enterprise** — per active seat / month.
- Seat = `org_memberships.status = active`.
- Owner portal: update seats, invoices, cancel.
- Soft enforcement: warn at seat limit; block new invites when over.

---

## Phased delivery

### Phase 0 — Foundations (1–2 weeks)

- [ ] Migrations: orgs, memberships, invites, RLS  
- [ ] Invite accept flow on web  
- [ ] “Managed org” badge stub in extension  
- [ ] Feature flag `enterprise_enabled`

### Phase 1 — Admin MVP (2–3 weeks)

- [ ] Admin console: People + Groups  
- [ ] Org-wide blocklist policy + extension apply  
- [ ] Effective policy RPC + revision sync  
- [ ] Basic org overview metrics (active users, blocks)

### Phase 2 — Visibility (2 weeks)

- [ ] Daily stats upload (`screen_ms`, `focus_ms`, `blocked_count`)  
- [ ] User detail page (charts)  
- [ ] Group-scoped policies  
- [ ] Audit log for policy + membership changes

### Phase 3 — Hardening (2 weeks)

- [ ] Per-user policies  
- [ ] Domain retention / privacy toggles  
- [ ] Stripe Enterprise seats  
- [ ] CSV export  
- [ ] Admin Viewer role

### Phase 4 — Scale (later)

- [ ] SSO / SAML / Google Workspace  
- [ ] SCIM provisioning  
- [ ] Scheduled reports (email)  
- [ ] Classroom / school templates  
- [ ] Webhooks for policy events

---

## Engineering notes (this repo)

| Area | Approach |
|------|----------|
| Auth | Existing Supabase Auth; org claims via memberships (not JWT custom claims unless needed) |
| Extension sync | Extend workspace sync / heartbeat with `effective_policy_revision` |
| Web admin | New tabs in OptionsApp or dedicated `/admin` route in `website/` |
| Stats | Reuse `focusTime_*` + `screenTime_*`; roll up server-side |
| Security | Supabase RLS + Edge Functions for invites and policy publish |

### Suggested RPCs

- `create_organization(name)`  
- `invite_to_org(org_id, email, role)`  
- `accept_org_invite(token)`  
- `publish_org_policy(...)`  
- `get_effective_org_policy()`  
- `upsert_org_day_stats(...)`  
- `list_org_member_stats(org_id, from, to)`

---

## Success metrics

- Time-to-first-policy &lt; 10 minutes after org create  
- Policy sync latency &lt; 60s after publish (extension online)  
- Admin can answer: “Who focused least this week?” without exporting CSV  
- Zero cross-org data leaks in RLS tests

---

## Open decisions

1. Can members opt out of domain-level sharing while staying in the org?  
2. Do personal blocklists merge with org policy or get fully overridden? (Plan assumes merge + most restrictive.)  
3. School vs company UX — separate templates or one flexible model?  
4. Minimum seat count / annual contracts for Enterprise sales?

---

## Immediate next build slice

Smallest useful ship:

1. `organizations` + `org_memberships` + invite  
2. Org-wide blocklist policy  
3. Extension applies forced blocks + “Managed by …”  
4. Admin page listing members and editing that one policy  

Everything else layers on top of that spine.
