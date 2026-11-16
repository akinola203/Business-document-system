# Disaster Recovery & Rollback Runbook: AOA 77 Document Management System

This runbook outlines the rapid mitigation, data restoration, and version rollback procedures for the **AOA 77 Document Management System** in the event of a critical production failure, corrupted database migration, or deployment regression.

---

## Phase 1: Incident Assessment & Triage

1. **Identify the Failure Mode:**
   - **Application Crash / Build Regression:** Containers failing to start or throwing unhandled exceptions (check Sentry and `docker-compose logs --tail=100 backend`).
   - **Database / Migration Corruption:** Failed Prisma migrations or invalid state affecting ledger immutability and multi-currency foreign key relations.
   - **Infrastructure / Storage Outage:** Volume corruption or Redis cache loss.

2. **Alerting & Communication:**
   - Note the exact error timestamp, request trace ID (`X-Request-Id`), OpenTelemetry `trace_id`, and impacted tenants.

---

## Phase 2: Application Rollback (Zero-Downtime Reversion)

If a newly deployed backend image or frontend bundle introduces a regression:

1. **Revert Docker Image Tag:**
   - Update `docker-compose.yml` or your deployment script to point back to the last known stable image tag or commit hash:
   ```yaml
   backend:
     image: aoa77-backend:v1.2.0 # Rollback from v1.3.0
   ```

2. **Redeploy Stable Containers:**
   - Stop and recreate the affected service without touching data volumes:
   ```bash
   docker-compose up -d --no-deps --build backend
   ```

3. **Verify Health:**
   - Check the health endpoint:
   ```bash
   curl -I https://api.aoa77.com/health
   ```

---

## Phase 3: Database Disaster Recovery & Point-in-Time Restore

If a bad migration or data corruption impacts financial ledgers (`Invoices`, `Waybills`, `Payments`):

1. **Stop Active Traffic & Backend Services:**
   - Prevent ongoing write operations to avoid split-brain ledger states:
   ```bash
   docker-compose stop backend
   ```

2. **Locate the Latest Verified Backup:**
   - Access your automated backup directory (e.g., `/backups/aoa77_YYYY-MM-DD.sql`).

3. **Restore PostgreSQL Database:**
   - Terminate active connections and restore the SQL dump into the container:
   ```bash
   docker exec -i aoa77-postgres psql -U user -d aoa77_production -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   cat /backups/aoa77_YYYY-MM-DD.sql | docker exec -i aoa77-postgres psql -U user -d aoa77_production
   ```

4. **Re-run Prisma Migrations (if rolling forward to a fixed schema):**
   - Ensure the schema matches the restored state:
   ```bash
   npx prisma migrate deploy
   ```

5. **Restart Backend Service:**
   ```bash
   docker-compose start backend
   ```

---

## Phase 4: Redis Cache Flush & Synchronization

If multi-currency exchange rate caching or tenant-scoped lookup state becomes stale or corrupted:

1. **Flush Redis Cache:**
   - Clear all cached exchange rates and tenant session keys safely:
   ```bash
   docker exec -it aoa77-redis redis-cli FLUSHALL
   ```

2. **Verify Cache Re-population:**
   - Trigger a currency conversion (`GET /api/v1/currency/rates`) or invoice fetch to ensure Redis successfully re-fetches live exchange rates from the external API.

---

## Phase 5: Post-Recovery Audit & Verification

1. **Run Smoke Tests & Security Test Suites:**
   - Execute the security and verification suites to confirm integrity:
   ```bash
   npm run test:security
   ```

2. **Review Audit Logs:**
   - Inspect the `AuditLog` table in PostgreSQL to verify that all system actions during the incident window are accounted for and ledger immutability constraints (`onDelete: Restrict`) held firm.

