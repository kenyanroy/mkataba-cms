# Mkataba — Enterprise Contracts Management System

Self-hosted, enterprise-grade contract lifecycle management with integrated e-signatures (DocuSeal) and automated archival (Paperless-ngx). Fully mobile-responsive.

## Quick Start

### 1. Prerequisites

- Docker 27+ & Docker Compose v2
- `openssl` (for secret generation)

### 2. Generate secrets

```bash
bash scripts/generate-secrets.sh
```

Copy the output into a `.env` file (use `.env.example` as the template).

### 3. Configure `.env`

```bash
cp .env.example .env
# Edit .env and fill all values
```

### 4. Start all services

```bash
docker compose up -d
```

This starts:
| Service | URL |
|---|---|
| Mkataba App | http://localhost:3000 |
| DocuSeal *(setup only)* | Uncomment port 3001 in docker-compose.yml |
| Paperless-ngx *(setup only)* | Uncomment port 8000 in docker-compose.yml |

### 5. Get API tokens from DocuSeal & Paperless-ngx

**DocuSeal:**
1. Temporarily uncomment `ports: - "3001:3000"` in `docker-compose.yml` for `docuseal`
2. `docker compose up -d docuseal`
3. Visit http://localhost:3001 → complete setup → copy API token
4. Set `DOCUSEAL_API_TOKEN=<token>` in `.env`
5. Re-comment the port line

**Paperless-ngx:**
1. Temporarily uncomment `ports: - "8000:8000"` for `paperless-ngx`
2. `docker compose up -d paperless-ngx`
3. Visit http://localhost:8000 → Admin → API Tokens → create token
4. Set `PAPERLESS_API_TOKEN=<token>` in `.env`
5. Re-comment the port line

### 6. Seed demo data (optional)

```bash
docker compose exec mkataba-app npm run db:seed
```

Default credentials:
| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.mkataba.app | Admin@123456 |
| Legal | legal@demo.mkataba.app | Legal@123456 |
| Approver | approver@demo.mkataba.app | Approver@123456 |

## Architecture

See [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md) for the full technical specification.

```
mkataba-app (Next.js 15)
    ↕ internal Docker network
mkataba-db (PostgreSQL 16)
    ↕ internal Docker network
docuseal (E-Signature)
    ↕ internal Docker network
paperless-ngx (OCR + Archival)
    ↕ internal Docker network
paperless-db (PostgreSQL 16)
paperless-redis (Redis 7)
```

## Tech Stack

- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Shadcn/UI, Recharts
- **Backend**: Next.js Server Actions + Route Handlers, Prisma ORM
- **Auth**: Auth.js v5 (email/password, RBAC)
- **E-Signature**: DocuSeal (self-hosted)
- **Archival**: Paperless-ngx (self-hosted, OCR)
- **Database**: PostgreSQL 16

## Roles

| Role | Capabilities |
|---|---|
| Admin | Full access + user management |
| Legal Reviewer | Create/edit any contract, templates, analytics |
| Approver | Approve contracts, send for signing |
| Standard User | Create/edit own contracts, submit for approval |

## Security

- HMAC-verified DocuSeal webhooks
- Single-use HMAC-signed one-tap approval tokens (72h expiry)
- Bcrypt password hashing (cost 12)
- Append-only audit log (PostgreSQL RLS)
- All inter-service traffic on isolated Docker bridge network
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options

## Development

```bash
npm install
cp .env.example .env.local    # configure for local dev
npm run db:generate
npm run db:migrate
npm run dev
```
