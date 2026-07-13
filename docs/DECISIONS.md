# DECISIONS ? Resident Hotel Management

> Architecture Decision Records (ADR)
>
> This document stores permanent architectural decisions.
>
> Do NOT read this file during normal implementation.
>
> Read only when:
>
> - changing architecture
> - introducing new infrastructure
> - modifying security model
> - changing database design
> - changing deployment strategy
>
> Do not store work logs here.

---

# ADR-001

## Title

Next.js App Router

## Status

Accepted

## Decision

Use Next.js App Router as the application framework.

## Reason

- Server Components
- Route Handlers
- Better long-term support

---

# ADR-002

## Title

Prisma ORM

## Status

Accepted

## Decision

Use Prisma as the only ORM.

## Reason

- Type safety
- Migration management
- Strong TypeScript support

---

# ADR-003

## Title

Supabase PostgreSQL

## Status

Accepted

## Decision

Use Supabase PostgreSQL during development.

Self-hosted Supabase on VPS will be evaluated after feature completion.

## Reason

- Faster development
- Managed authentication
- Easier migrations

---

# ADR-004

## Title

Relational RBAC

## Status

Accepted

## Decision

Authorization uses relational tables.

Tables:

- roles
- permissions
- role_permissions
- employees.role_id

## Rejected

Prisma/PostgreSQL enum EmployeeRole

## Reason

Need future role expansion.

Need permission mapping.

Need localized display names.

Need active/inactive roles.

---

# ADR-005

## Title

Fail Closed Authorization

## Status

Accepted

## Decision

Unknown role

Missing role

Inactive role

Missing permission

All must deny access.

Never fallback.

---

# ADR-006

## Title

Server Authoritative Security

## Status

Accepted

## Decision

Server is the security boundary.

Client-side permission is UX only.

Server always validates

- permission
- pricing
- payment
- status

---

# ADR-007

## Title

Database Source of Truth

## Status

Accepted

## Decision

Business data must come from database.

Never trust client values.

---

# ADR-008

## Title

Migration Strategy

## Status

Accepted

## Decision

Always use additive migration first.

Destructive migration requires explicit approval.

---

# ADR-009

## Title

Token Optimization Strategy

## Status

Accepted

## Decision

Optimize AI usage.

Rules

- Read minimum files.
- Targeted search.
- One active task.
- One source of truth.
- No repository scan.
- No duplicate documentation.

---

# ADR-010

## Title

Documentation Strategy

## Status

Accepted

## Decision

Documents have dedicated purposes.

AGENTS.md

- AI instructions

CURRENT_TASK.md

- active task only

MASTER_PLAN.md

- long-term roadmap

PROJECT_CONTEXT.md

- stable project overview

REFERENCE_INDEX.md

- routing

DECISIONS.md

- permanent architecture decisions

No duplicated information.

---

# ADR-011

## Title

Task Execution Strategy

## Status

Accepted

## Decision

Only one implementation task may be active.

When CURRENT_TASK finishes:

1. Read MASTER_PLAN.md.
2. Select next phase.
3. Wait for approval.
4. Create next CURRENT_TASK.

Never invent new tasks.

Never reprioritize.

---

# ADR-012

## Title

Verification Policy

## Status

Accepted

## Decision

Verification must match implementation risk.

Never claim success without running verification.

Report UNVERIFIED when commands cannot be executed.

---

# ADR-013

## Title

Production Migration

## Status

Planned

## Decision

Production deployment will use VPS.

Migration will happen only after:

- Feature complete
- Stable database
- Stable RBAC
- Testing completed

Current development remains on Supabase Cloud.

---

# ADR-014

## Title

Product food categories and image upload via Supabase Storage

## Status

Accepted

## Decision

- Food categories are master data in `food_categories`. Staff can add a category inline.
- Product types are master data in `product_types` (defaults: food/drink/clothing/supplies). Staff can add a type inline.
- Minibar is a per-product boolean (`is_minibar`), not a product type.
- Products reference `type_id` and optional `category_id`. Type food requires a food category.
- Product images upload via `POST /api/products/images` (Supabase Storage `product-images`).

## Reason

- Staff need to browse and classify dishes by category.
- Mobile/desktop file pick is more practical than pasting image URLs.
- Supabase is already the project data platform; service-role upload keeps secrets server-side.

---

# ADR-015

## Title

Self-registration and forced password reset

## Status

Accepted

## Decision

- Public self-registration via `POST /api/auth/register` creates Supabase Auth user + Employee with `isActive=false` and no role.
- Access requires admin/manager with `employee.manage` to assign role and activate; activation without role is rejected.
- Password reset by privileged staff sets `employees.must_reset_password=true`. Next login redirects to `/set-password`; after `POST /api/auth/set-password` the flag clears and normal access continues.
- Middleware blocks all other routes while `mustResetPassword` is true (except set-password, logout, me).

## Reason

- Staff can enroll themselves without granting immediate system access.
- Password reset stays under employee.manage control without requiring email delivery infrastructure.

---

# Future ADR

Append new records only.

Never rewrite historical decisions.

