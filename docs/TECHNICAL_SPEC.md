# Mkataba — Enterprise Contracts Management System
## Comprehensive Technical Specification & Implementation Plan

**Version:** 1.0.0  
**Last Updated:** 2026-06-11  
**Status:** Approved for Implementation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Tech Stack](#3-tech-stack)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Module Specifications](#6-module-specifications)
7. [Docker & Infrastructure](#7-docker--infrastructure)
8. [Security & Compliance](#8-security--compliance)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Environment Variables](#10-environment-variables)

---

## 1. System Overview

Mkataba (Swahili for "contract") is a self-hosted, enterprise-grade Contracts Management System built for organizations that require full data sovereignty, e-signature capabilities, and automated archival workflows. It integrates three primary systems within an isolated Docker network:

| System | Role |
|---|---|
| **Mkataba App** (Next.js 15) | Core CLM platform, UI, API, auth, approval workflow |
| **DocuSeal** (Self-hosted) | E-signature engine — creates, sends, and tracks signing |
| **Paperless-ngx** (Self-hosted) | OCR indexing and long-term document archival |
| **PostgreSQL** | Primary relational database for Mkataba |

### Key Design Principles

- **Mobile-first responsive design**: Sidebars collapse to bottom nav on mobile. Tables collapse to swipeable cards. Forms stack vertically. Signing iframe scales to viewport.
- **Zero external SaaS dependency**: All signing, archival, and OCR happen within the private Docker network.
- **Immutable audit trail**: Every action (view, edit, approve, sign) is logged with user ID, IP, timestamp, and diff.
- **Role-based access**: Four roles (Admin, Legal Reviewer, Approver, Standard User) govern every API and UI path.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Docker Network: mkataba_net                       │
│                                                                       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  mkataba-app    │    │    docuseal       │    │ paperless-ngx  │  │
│  │  Next.js 15     │◄──►│  :3000 (int)      │    │  :8000 (int)   │  │
│  │  :3000 (ext)    │    │  E-Signature      │    │  OCR + Archive │  │
│  └────────┬────────┘    └──────────────────┘    └───────┬────────┘  │
│           │                                             │             │
│  ┌────────▼────────┐    ┌──────────────────┐    ┌──────▼─────────┐  │
│  │  mkataba-db     │    │  paperless-redis  │    │  paperless-db  │  │
│  │  PostgreSQL     │    │  Redis 7          │    │  PostgreSQL    │  │
│  │  :5432          │    │                   │    │  :5432         │  │
│  └─────────────────┘    └──────────────────┘    └────────────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
         │ (Only mkataba-app:3000 is exposed to host/internet)
```

### Data Flow: Contract Execution

```
User signs → DocuSeal webhook → /api/webhooks/docuseal
  → Update contract status to EXECUTED
  → Download signed PDF from DocuSeal
  → POST PDF to Paperless-ngx consumption API
  → Store paperless_doc_id on Contract record
  → Emit audit log entry
```

---

## 3. Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components) |
| UI Library | React 19 |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS 3.x + CSS Variables |
| Component System | Shadcn/UI (Radix UI primitives) |
| Charts | Recharts 2.x |
| Forms | React Hook Form + Zod |
| State | Zustand (client), TanStack Query (server cache) |
| Date Handling | date-fns |

### Backend

| Layer | Technology |
|---|---|
| Runtime | Next.js Server Actions + Route Handlers |
| Language | TypeScript 5.x |
| ORM | Prisma 5.x |
| Database | PostgreSQL 16 |
| Auth | Auth.js v5 (NextAuth) |
| File Storage | Local volume (Docker-mounted, encrypted) |
| Job Queue | pg-boss (PostgreSQL-backed, no extra Redis) |
| Email | Nodemailer (SMTP) |

### Infrastructure

| Layer | Technology |
|---|---|
| Containerization | Docker 27 + Docker Compose v2 |
| Reverse Proxy | Nginx (within Compose, optional Traefik) |
| E-Signature | DocuSeal (self-hosted, official image) |
| Archival | Paperless-ngx (self-hosted, official image) |
| Volume Encryption | LUKS dm-crypt (host-level) + Paperless AES-256 |

---

## 4. Database Schema

> Full Prisma schema is in `/prisma/schema.prisma`. This section documents entity relationships and key design decisions.

### Entity Relationship Summary

```
Organization ─┬─< User
               ├─< Contract ─┬─< ContractVersion
               │              ├─< ApprovalWorkflow ─< ApprovalStep
               │              ├─< Attachment
               │              └─< AuditLog
               └─< Template ─< TemplateVariable
```

### Key Design Decisions

**UUIDs everywhere**: All primary keys are UUID v4, generated at the database level via `gen_random_uuid()`. This prevents enumerable IDs in URLs and simplifies multi-tenant sharding.

**Soft deletes**: Contracts and Users use `deletedAt` timestamps instead of hard deletes to preserve audit integrity.

**Contract versioning**: Every save creates a new `ContractVersion` row (content stored as text). The Contract table holds `currentVersionId` for fast reads. Diffs are computed on-demand.

**DocuSeal bridge**: `Contract.docusealSubmissionId` stores the submission ID returned when a contract is sent for signing. `Contract.docusealStatus` tracks the signing state (pending/completed/declined).

**Paperless bridge**: `Contract.paperlessDocumentId` stores the integer ID returned by Paperless-ngx after archival. This enables deep-linking to the Paperless UI.

---

## 5. API Reference

### Authentication (`/api/auth/*`)
Auth.js handles all auth routes automatically.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signin` | Email/password sign-in |
| POST | `/api/auth/signout` | Session termination |
| GET | `/api/auth/session` | Current session data |

### Contracts (`/api/contracts`)

| Method | Path | Role Required | Description |
|---|---|---|---|
| GET | `/api/contracts` | Any | List contracts (paginated, filtered) |
| POST | `/api/contracts` | Standard+ | Create draft contract |
| GET | `/api/contracts/:id` | Any | Get contract + current version |
| PATCH | `/api/contracts/:id` | Author/Legal/Admin | Update draft contract |
| DELETE | `/api/contracts/:id` | Admin | Soft-delete contract |
| POST | `/api/contracts/:id/submit` | Author/Admin | Submit for approval |
| POST | `/api/contracts/:id/send-for-signing` | Approver/Admin | Push to DocuSeal |
| GET | `/api/contracts/:id/versions` | Any | List version history |
| GET | `/api/contracts/:id/audit` | Legal/Admin | Audit log for contract |

### Templates (`/api/templates`)

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/templates` | Any | List available templates |
| POST | `/api/templates` | Legal/Admin | Create template |
| PATCH | `/api/templates/:id` | Legal/Admin | Update template |
| POST | `/api/templates/:id/instantiate` | Standard+ | Create contract from template |

### Approvals (`/api/approvals`)

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/approvals/pending` | Approver | My pending approval steps |
| POST | `/api/approvals/:stepId/approve` | Approver | Approve a step |
| POST | `/api/approvals/:stepId/reject` | Approver | Reject with reason |

### Webhooks

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/webhooks/docuseal` | HMAC Signature | DocuSeal completion event |
| POST | `/api/webhooks/paperless` | API Key | Paperless-ngx confirmation |

### Analytics (`/api/analytics`)

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/analytics/summary` | Admin/Legal | Dashboard KPIs |
| GET | `/api/analytics/expiring` | Admin/Legal | Contracts expiring in N days |
| GET | `/api/analytics/signing-rates` | Admin | Signing completion rates |

---

## 6. Module Specifications

### 6.1 User & Tenant Management

**RBAC Matrix:**

| Permission | Admin | Legal Reviewer | Approver | Standard User |
|---|:---:|:---:|:---:|:---:|
| Create Contract | ✓ | ✓ | ✓ | ✓ |
| Edit Any Contract | ✓ | ✓ | — | Own only |
| Submit for Approval | ✓ | ✓ | ✓ | ✓ |
| Approve/Reject | ✓ | — | ✓ | — |
| Send for Signing | ✓ | — | ✓ | — |
| Create Templates | ✓ | ✓ | — | — |
| View Audit Log | ✓ | ✓ | — | — |
| Manage Users | ✓ | — | — | — |
| View Analytics | ✓ | ✓ | — | — |

**Mobile Profile Page**: Avatar upload, name/email edit, password change, active sessions list, notification preferences — all in a single-column scrollable layout.

### 6.2 Contract Lifecycle Management

**States & Transitions:**

```
DRAFT → UNDER_REVIEW → PENDING_APPROVAL → APPROVED → PENDING_SIGNATURE
  → EXECUTED → ARCHIVED
  
Any state → REJECTED (returns to DRAFT with rejection notes)
Any state → VOID (admin only, logged)
```

**Version Control:**
- Each save of the contract body creates a `ContractVersion` record.
- The version stores the full body text, the editor's user ID, and a timestamp.
- The UI shows a side-by-side diff viewer (word-level) between any two versions.

**Mobile CLM Layout:**
- Contract list → vertical card stack (title, counterparty, status chip, expiry date).
- Contract detail → sticky status header + tabbed sections (Details / Content / Timeline / Signatures).
- Contract content rendered as formatted HTML within a scrollable prose container (not a PDF embed on mobile).

### 6.3 DocuSeal Integration

**Flow:**
1. Approver clicks "Send for Signing" on an `APPROVED` contract.
2. Mkataba backend calls `POST http://docuseal:3000/api/submissions` with:
   - PDF or HTML document body
   - Signatories array (name, email, role in document)
   - `webhook_url: https://mkataba-app/api/webhooks/docuseal`
3. DocuSeal returns `{ submission_id, signing_url }`.
4. `Contract.docusealSubmissionId` is stored; status → `PENDING_SIGNATURE`.
5. Mkataba embeds the DocuSeal signing URL in a responsive iframe/web component for internal signatories.
6. DocuSeal POSTs to the webhook when all parties have signed.
7. Webhook handler downloads the completed PDF and triggers the Paperless archival pipeline.

**Mobile Signing Wrapper:**
```tsx
// Signing view wraps the iframe in a full-screen modal on mobile
// On desktop: displayed inline within the contract detail page
<div className="w-full h-[calc(100vh-4rem)] md:h-[700px]">
  <iframe src={signingUrl} className="w-full h-full border-0 rounded-lg" />
</div>
```

**Webhook Security:**
DocuSeal sends an `X-Docuseal-Signature` HMAC-SHA256 header. The webhook endpoint verifies this against `DOCUSEAL_WEBHOOK_SECRET` before processing.

### 6.4 Paperless-ngx Archival

**Automated Pipeline (triggered on EXECUTED status):**

```typescript
// Pseudocode for the archival job
async function archiveExecutedContract(contractId: string) {
  const pdf = await downloadSignedPDF(contract.docusealSubmissionId);
  
  const formData = new FormData();
  formData.append('document', pdf, `${contract.id}.pdf`);
  formData.append('title', contract.title);
  formData.append('tags', [contract.type, 'executed'].join(','));
  // Custom fields: counterparty, effectiveDate, expirationDate, contractId
  
  const response = await fetch('http://paperless-ngx:8000/api/documents/post_document/', {
    method: 'POST',
    headers: { Authorization: `Token ${PAPERLESS_API_TOKEN}` },
    body: formData,
  });
  
  const { task_id } = await response.json();
  await pollForDocumentId(task_id); // Paperless processes async
  contract.paperlessDocumentId = documentId;
  contract.status = 'ARCHIVED';
}
```

**Metadata Mapping to Paperless:**

| Mkataba Field | Paperless Field |
|---|---|
| `contract.title` | Document Title |
| `contract.type` | Tag |
| `contract.counterpartyName` | Correspondent |
| `contract.effectiveDate` | Created Date |
| `contract.expirationDate` | Custom Field: `expiration_date` |
| `contract.id` | Custom Field: `mkataba_id` |

### 6.5 Dynamic Template Builder

Templates store body content as Handlebars-compatible HTML with variable placeholders (`{{variable_name}}`). The template editor is a rich-text editor (Tiptap) with a variable insertion palette.

**Template Variables** are stored as structured JSON in `TemplateVariable` rows, allowing the UI to render a typed form when instantiating a template:

```json
[
  { "key": "party_name", "label": "Party Name", "type": "text", "required": true },
  { "key": "effective_date", "label": "Effective Date", "type": "date", "required": true },
  { "key": "contract_value", "label": "Contract Value (KES)", "type": "number", "required": false }
]
```

### 6.6 Approval Workflow Engine

**Workflow Types:**
- **Sequential**: Steps execute in order. Step N starts only after Step N-1 is approved.
- **Parallel**: All steps in a group are sent simultaneously. The group completes when ALL approve (or ANY rejects).

**Mobile Approval Quick-Actions:**
Approval request emails include signed one-time-use URLs:
```
GET /api/approvals/:stepId/quick-approve?token=<HMAC_TOKEN>
GET /api/approvals/:stepId/quick-reject?token=<HMAC_TOKEN>&reason=<urlencoded>
```
These URLs expire in 72 hours and are single-use (token stored in DB with `usedAt`).

**In-App Mobile Approval:**
The `/approvals` page shows pending items as swipeable cards with ✓/✗ action buttons.

### 6.7 Analytics Dashboard

**KPI Widgets (responsive grid → stacks to 1-col on mobile):**

| Widget | Data |
|---|---|
| Total Contract Value (TCV) | SUM of `contract.value` where status = EXECUTED |
| Active Contracts | COUNT by status (donut chart) |
| Expiring Soon | Contracts within 30/60/90 days (bar chart) |
| Signing Completion Rate | % submitted → executed (line chart, last 12mo) |
| Average Approval Time | Avg hours DRAFT → APPROVED |
| Overdue Approvals | Pending steps older than SLA threshold |

### 6.8 Audit Trail

Every mutation in the system writes to `AuditLog`:

```
{ contractId, userId, action, metadata, ipAddress, userAgent, createdAt }
```

Actions are typed enums:
`VIEW | CREATED | UPDATED | SUBMITTED | APPROVED | REJECTED | SENT_FOR_SIGNING | SIGNED | EXECUTED | ARCHIVED | VOIDED | DELETED | PERMISSION_CHANGED`

The audit log is **append-only**: no `UPDATE` or `DELETE` is ever issued against this table. Row-level security in PostgreSQL (`GRANT INSERT, SELECT` only) enforces this at the DB layer.

---

## 7. Docker & Infrastructure

> Full `docker-compose.yml` is at the root of this repository.

### Service Summary

| Service | Image | Internal Port | External Port |
|---|---|---|---|
| `mkataba-app` | `./` (custom build) | 3000 | 3000 |
| `mkataba-db` | `postgres:16-alpine` | 5432 | — (internal only) |
| `docuseal` | `docuseal/docuseal:latest` | 3000 | — (internal only) |
| `paperless-ngx` | `ghcr.io/paperless-ngx/paperless-ngx:latest` | 8000 | — (internal only) |
| `paperless-redis` | `redis:7-alpine` | 6379 | — (internal only) |
| `paperless-db` | `postgres:16-alpine` | 5432 | — (internal only) |

### Network Isolation

All services share the `mkataba_internal` bridge network. Only `mkataba-app` maps a host port. `mkataba-db`, DocuSeal, Paperless, and their dependencies are unreachable from outside the Docker host.

For production, place an Nginx or Traefik reverse proxy in front of `mkataba-app:3000` to handle TLS termination.

### Volume Strategy

```
mkataba_db_data        → PostgreSQL data for Mkataba
docuseal_data          → DocuSeal DB + generated PDFs
paperless_data         → Document media files
paperless_consume      → Drop-folder watched by Paperless (shared mount)
paperless_export       → Export directory
paperless_db_data      → Paperless PostgreSQL data
```

**Encryption at Rest:** Mount these volumes on a LUKS-encrypted host partition. For Docker Desktop or cloud VMs, use encrypted block storage (AWS EBS with encryption, GCP Persistent Disk with CMEK, etc.). Paperless-ngx additionally encrypts stored documents via its `PAPERLESS_SECRET_KEY`-derived AES-256 cipher.

---

## 8. Security & Compliance

### Authentication
- Passwords hashed with **bcrypt** (cost factor 12) via Auth.js.
- Sessions stored in the PostgreSQL DB (not JWT) to enable instant revocation.
- CSRF protection via Auth.js built-in tokens.
- Rate limiting on `/api/auth/signin`: 5 attempts per 15 minutes per IP.

### Authorization
- Every Server Action and Route Handler checks the session role before proceeding.
- Database-level Row Level Security (RLS) policies enforce tenant isolation.
- Organization ID is included in all data queries (no cross-tenant data leakage).

### Transport Security
- All inter-service communication stays within the Docker bridge network (no TLS needed internally).
- External traffic must terminate at an Nginx/Traefik reverse proxy with valid TLS cert (Let's Encrypt).
- `HSTS`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy`, and `X-Content-Type-Options` headers set in `next.config.ts`.

### Webhook Security
- DocuSeal webhooks verified via HMAC-SHA256 signature.
- One-tap approval tokens are HMAC-SHA256 signed with `APPROVAL_TOKEN_SECRET`, tied to the stepId, expire in 72 hours, and are single-use.

### Secret Management
- All secrets in `.env` files, never in source code.
- `.env` is in `.gitignore`.
- For production, use Docker Secrets or a vault (HashiCorp Vault / AWS Secrets Manager).

### Input Validation
- All user input validated with **Zod** at the Server Action/Route Handler boundary.
- File uploads validated for MIME type and size (max 50MB, PDF/DOCX only).
- Rich text editor output sanitized with **DOMPurify** before storage.

### Encryption at Rest
```
Host OS → LUKS dm-crypt encrypted partition
  └── Docker volumes mounted on encrypted partition
        ├── mkataba-db: PostgreSQL transparent data encryption (pgcrypto for PII columns)
        ├── docuseal: SQLite DB + PDFs on encrypted volume
        └── paperless-ngx: AES-256 via PAPERLESS_SECRET_KEY + encrypted volume
```

For additional column-level encryption of PII (SSN, bank details in contracts):
```sql
-- Using pgcrypto
UPDATE contracts 
SET sensitive_data = pgp_sym_encrypt(raw_data::text, current_setting('app.encryption_key'));
```

---

## 9. Implementation Roadmap

### Phase 1 — Infrastructure Foundation (Week 1–2)
**Goal:** All containers running, talking to each other, Next.js app boots.

- [ ] Write `docker-compose.yml` with all 6 services
- [ ] Write `Dockerfile` for `mkataba-app`
- [ ] Verify inter-service DNS resolution (`mkataba-app` → `mkataba-db`, `docuseal`, `paperless-ngx`)
- [ ] Write `prisma/schema.prisma` with all models
- [ ] Run `prisma migrate dev` and verify schema in DB
- [ ] Implement Auth.js with PostgreSQL adapter (email/password)
- [ ] Scaffold RBAC middleware (`lib/auth/rbac.ts`)
- [ ] Health-check endpoints for all services
- [ ] `.env.example` documenting all required vars

**Deliverable:** `docker compose up` boots all services. Registration, login, and session work.

### Phase 2 — Core CLM (Week 3–4)
**Goal:** Full contract CRUD with version history and responsive UI.

- [ ] Contract list page (desktop table + mobile card stack)
- [ ] Contract creation form (from scratch + from template)
- [ ] Rich-text contract editor (Tiptap) with autosave
- [ ] Contract versioning (save → new version, diff viewer)
- [ ] Contract detail page (tabbed: Details / Content / Timeline)
- [ ] File attachment upload/download
- [ ] Audit log writer middleware
- [ ] Responsive layout: collapsible sidebar, bottom nav on mobile

**Deliverable:** Full contract lifecycle DRAFT → ARCHIVED works in UI.

### Phase 3 — Approval Workflow (Week 5)
**Goal:** Sequential and parallel approval chains with email notifications.

- [ ] Approval workflow builder UI (drag-and-drop steps)
- [ ] Approval engine (`lib/approvals/engine.ts`)
- [ ] Email notification service (Nodemailer)
- [ ] Quick-approve email links (HMAC-signed one-time URLs)
- [ ] In-app approvals queue page (swipeable cards on mobile)
- [ ] Contract status transitions driven by approval state machine

**Deliverable:** Contracts route through multi-step approvals. Approvers get emails with one-tap links.

### Phase 4 — DocuSeal E-Signature (Week 6)
**Goal:** Approved contracts can be sent for signing via DocuSeal.

- [ ] DocuSeal API client (`lib/docuseal/client.ts`)
- [ ] "Send for Signing" action: create submission, store submission ID
- [ ] Signing iframe wrapper (full-screen mobile, inline desktop)
- [ ] Webhook endpoint (`/api/webhooks/docuseal`) with HMAC verification
- [ ] Download signed PDF from DocuSeal on completion
- [ ] Status update: PENDING_SIGNATURE → EXECUTED
- [ ] Trigger Paperless archival pipeline

**Deliverable:** Contracts execute through DocuSeal. Signed PDFs land in the system automatically.

### Phase 5 — Paperless-ngx Archival (Week 7)
**Goal:** Executed contracts auto-archive into Paperless with full metadata.

- [ ] Paperless API client (`lib/paperless/client.ts`)
- [ ] Archival job: upload PDF + metadata to Paperless-ngx
- [ ] Poll for Paperless document ID and store on contract
- [ ] Deep-link to Paperless document from contract detail page
- [ ] Metadata tag/custom field mapping
- [ ] Error handling and retry logic for failed archival

**Deliverable:** Every executed contract appears in Paperless-ngx with searchable OCR text and metadata.

### Phase 6 — Templates & Analytics (Week 8)
**Goal:** Template builder and analytics dashboard.

- [ ] Template management CRUD (Legal/Admin roles)
- [ ] Tiptap-based template editor with `{{variable}}` syntax highlighting
- [ ] Variable schema editor (key, label, type, required)
- [ ] "New from Template" contract creation flow with variable form
- [ ] Analytics dashboard (`/dashboard`) with Recharts
- [ ] KPI: TCV, status distribution, expiring contracts, signing rates
- [ ] Date-range filters for all charts

**Deliverable:** Templates are reusable. Analytics dashboard is fully functional and responsive.

### Phase 7 — Hardening & Optimization (Week 9–10)
**Goal:** Production-ready security, performance, and observability.

- [ ] Rate limiting (upstash/ratelimit or custom Redis-backed)
- [ ] Input sanitization audit (all Zod schemas reviewed)
- [ ] CSP and security headers audit
- [ ] PostgreSQL indexes audit (add missing indexes on FKs and filter columns)
- [ ] Next.js Image optimization and static asset caching
- [ ] Docker image size optimization (multi-stage builds)
- [ ] Health check endpoints for all containers
- [ ] Log aggregation setup (optional: Loki + Grafana)
- [ ] Backup scripts for all DB volumes
- [ ] Load test with k6 (target: 200 concurrent users)
- [ ] Penetration test checklist (OWASP Top 10)

**Deliverable:** System passes security checklist. Docker images are optimized. Backup/restore is documented and tested.

---

## 10. Environment Variables

See `.env.example` for the complete list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Auth.js session encryption secret |
| `NEXTAUTH_URL` | Public URL of the Mkataba app |
| `DOCUSEAL_API_URL` | Internal Docker URL: `http://docuseal:3000` |
| `DOCUSEAL_API_TOKEN` | DocuSeal API token (set in DocuSeal admin) |
| `DOCUSEAL_WEBHOOK_SECRET` | HMAC secret for webhook verification |
| `PAPERLESS_API_URL` | Internal Docker URL: `http://paperless-ngx:8000` |
| `PAPERLESS_API_TOKEN` | Paperless-ngx API token |
| `SMTP_HOST` | SMTP server for email notifications |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `APPROVAL_TOKEN_SECRET` | HMAC secret for one-tap approval links |
| `ENCRYPTION_KEY` | Key for pgcrypto column encryption |
