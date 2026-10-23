# Database Migration & Operational Strategy

## 1. Overview
This document outlines the database migration, deployment, and rollback strategy for the Business Document Management Application using Prisma ORM and PostgreSQL 16.

---

## 2. Environment Environments & Workflows

### Development Environment
In local development, schema modifications are tracked incrementally using Prisma Migrate:

```bash
# 1. Format and validate schema
npm run prisma:format
npm run prisma:validate

# 2. Create and apply a new migration based on schema changes
npm run prisma:migrate -- --name <descriptive_migration_name>

# 3. Regenerate Prisma Client types
npm run prisma:generate

# 4. Populate or update seed data
npm run prisma:seed
```

### CI / Staging / Production Environments
In automated CI pipelines, staging, and production environments, migrations must **never** run interactive `prisma migrate dev`. Instead, the deterministic deployment command is executed:

```bash
# Run pending migrations against the target database
npm run prisma:deploy
```

- `prisma migrate deploy` executes only unapplied migration SQL files recorded in `prisma/migrations/`.
- It does not generate new migrations, does not prompt for input, and fails fast if schema drift is detected.

---

## 3. Zero-Downtime Migration Guidelines

To maintain 99.9% uptime during schema changes on active production business systems:

1. **Expand and Contract (Two-Phase Deployments):**
   - **Phase 1 (Expand):** Add new tables, columns, or nullable attributes. Deploy migration and updated backend that can read both old and new formats.
   - **Phase 2 (Contract):** Once all traffic is routed and old data is backfilled, apply a second migration to deprecate old columns or enforce `NOT NULL` constraints.
2. **Never Rename Columns in a Single Step:**
   - A direct column rename (`ALTER TABLE ... RENAME COLUMN ...`) breaks running instances during blue-green or rolling container restarts.
   - Add the new column, dual-write in application services, migrate existing values, and remove the legacy column in a subsequent release.
3. **Non-Blocking Index Creation:**
   - Large tables (such as `documents`, `audit_logs`, and `payments`) should use `CREATE INDEX CONCURRENTLY` in raw SQL migration steps if index creation takes more than a few seconds.

---

## 4. Rollback and Disaster Recovery Procedures

1. **Pre-Migration Snapshot:**
   - Before executing `prisma migrate deploy` in staging or production, an automated PostgreSQL snapshot or Point-in-Time Recovery (PITR) baseline is established.
2. **Down Migrations & Emergency Fixes:**
   - Prisma does not provide automatic down migrations. Every forward migration that introduces destructive changes must have a corresponding tested `down.sql` script prepared in the operations runbook.
   - If a deployment fails, the previous release artifact is re-deployed, and the rollback migration script is applied.
3. **Database Consistency Verification:**
   - Run health checks (`GET /api/v1/health/database`) and verify foreign keys, sequence counters, and balance integrity after any migration event.
