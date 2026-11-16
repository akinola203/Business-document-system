# Disaster Recovery & Rollback Runbook
**AOA 77 Document Management System**

This runbook outlines the rapid mitigation, data restoration, and version rollback procedures for the AOA 77 Document Management System in the event of a critical production failure, corrupted database migration, or deployment regression.

---

## 1. Incident Assessment & Triage
1. **Identify the Failure Mode:**
   - **Application Crash / Build Regression:** Check Sentry and container logs (`docker-compose logs --tail=100 backend`).
   - **Database / Migration Corruption:** Check failed Prisma migrations or relational integrity errors.
   - **Infrastructure Outage:** Verify PostgreSQL container health and Redis cache persistence.
2. **Record Trace IDs:** Note impacted tenants, timestamps, and request trace headers (`X-Request-Id`).

---

## 2. Zero-Downtime Application Rollback
If a newly deployed container image introduces a regression:
1. **Revert Image Tag:** In `docker-compose.yml`, pin the backend to the last known stable tag:
   ```yaml
   backend:
     image: aoa77-backend:v1.2.0 # Rolled back from v1.3.0
   ```
2. **Redeploy Stable Containers:**
   ```bash
   docker-compose up -d --no-deps --build backend
   ```
3. **Verify Health:**
   ```bash
   curl -I https://api.aoa77.com/health
   ```

---

## 3. Database Point-in-Time Recovery

If a bad migration or data corruption impacts financial ledgers (Invoices, Waybills, Payments):

1. **Stop Active Traffic:**
   ```bash
   docker-compose stop backend
   ```
2. **Locate Latest Verified Backup:** Find the target SQL dump in `/backups/aoa77_YYYY-MM-DD.sql`.
3. **Restore PostgreSQL Database:**
   ```bash
   docker exec -i aoa77-postgres psql -U user -d aoa77_production -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   cat /backups/aoa77_YYYY-MM-DD.sql | docker exec -i aoa77-postgres psql -U user -d aoa77_production
   ```
4. **Re-run Prisma Migrations:**
   ```bash
   npx prisma migrate deploy
   ```

---

## 4. Redis Cache & Exchange Rate Flush

If multi-currency exchange rate caching or session state becomes corrupted:

1. **Flush Redis:**
   ```bash
   docker exec -it aoa77-redis redis-cli FLUSHALL
   ```

---

## 5. Post-Recovery Audit & Verification

1. **Run Security Test Suites:**
   ```bash
   npm run test:security
   ```
2. **Inspect Audit Logs:** Review the `AuditLog` table to verify all incident-window actions and confirm ledger immutability constraints (`onDelete: Restrict`) held firm.

