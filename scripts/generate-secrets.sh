#!/usr/bin/env bash
# Generate all required secrets for .env
# Usage: bash scripts/generate-secrets.sh

set -e

echo "# ─── Generated Secrets — paste into .env ───────────────────────────────"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo "DOCUSEAL_SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '\n')"
echo "DOCUSEAL_WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo "PAPERLESS_SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')"
echo "APPROVAL_TOKEN_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '+/=' | head -c 32)"
echo "PAPERLESS_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '+/=' | head -c 32)"
