# Production Deployment Runbook: AOA 77 Document Management System

This runbook outlines the step-by-step procedures to securely provision, deploy, and verify the production release of the **AOA 77 Document Management System** across your infrastructure (Docker orchestration, PostgreSQL database, Redis caching layer, NestJS backend, and Vite/React frontend).

---

## Phase 1: Environment & Infrastructure Provisioning

1. **Server Provisioning:**
   - Procure a Linux VPS (Ubuntu 22.04 LTS or newer) with at least 2 vCPUs, 4GB RAM, and SSD storage.
   - Install **Docker** (v24+) and **Docker Compose** (v2.20+).
   - Configure a static public IP and point your production domain/subdomain (e.g., `api.aoa77.com`) to the server.

2. **Environment Variable Configuration:**
   - Create a production `.env` file on the server (never commit secrets to version control) with the following required production parameters:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL="postgresql://user:secure_password@postgres:5432/aoa77_production?schema=public&connection_limit=20&pool_timeout=30"
   DATABASE_READ_REPLICA_URL="postgresql://user:secure_password@postgres-replica:5432/aoa77_production?schema=public&connection_limit=30&pool_timeout=30"
   REDIS_URL="redis://:redis_password@redis:6379"
   JWT_SECRET="your_ultra_secure_jwt_secret_key"
   JWT_ACCESS_SECRET="your_ultra_secure_jwt_access_secret_key"
   JWT_REFRESH_SECRET="your_ultra_secure_jwt_refresh_secret_key"
   SENTRY_DSN="https://your-sentry-dsn@sentry.io/project"
   EXCHANGE_RATE_API_KEY="your_currency_api_key"
   ```

---

## Phase 2: Database Migration & Schema Verification

1. **Run Database Migrations:**
   - Execute Prisma migrations against the production PostgreSQL instance to apply all composite indexes, multi-currency columns, and relational constraints:
   ```bash
   npx prisma migrate deploy
   ```

2. **Verify Database Health:**
   - Ensure the database connection pool is active and composite indexes (`@@index([companyId, documentType, createdAt])`, `@@index([companyId, currency])`) are correctly built.

---

## Phase 3: Container Build & Orchestration

1. **Build and Start Services:**
   - Bring up the production stack using Docker Compose with volume persistence enabled for PostgreSQL, Redis, and secure file uploads:
   ```bash
   docker-compose up --build -d
   ```

2. **Container Health Checks:**
   - Verify that all containers are running and healthy:
   ```bash
   docker-compose ps
   ```
   - Check container logs for any startup errors or missing environment variables:
   ```bash
   docker-compose logs -f backend
   ```

---

## Phase 4: Post-Deployment Smoke Testing

1. **API Health & Metrics Probes:**
   - Verify that the backend health endpoint returns `200 OK` and Prometheus metrics are accessible:
   ```bash
   curl -I https://api.aoa77.com/health
   curl -I https://api.aoa77.com/metrics
   ```

2. **Security & Authentication Verification:**
   - Confirm that the deny-by-default global auth guard correctly rejects unauthenticated requests (`401 Unauthorized`) and public endpoints (such as `/api/v1/auth/login`) succeed.

3. **Multi-Currency & Conversion Check:**
   - Test generating an invoice in `USD` or `JPY` to verify live exchange rate fetching, Redis caching, and `NGN` base ledger snapshotting (`exchangeRate`, `baseSubtotal`, `baseTaxAmount`, `baseTotalAmount`).

4. **Bidirectional Document Conversion Test:**
   - Test converting a sample invoice to a waybill (`POST /api/v1/documents/:id/convert-to-waybill`) and vice versa (`POST /api/v1/documents/:id/convert-to-invoice`) to ensure transactional integrity and unique tracking code generation.

---

## Phase 5: Monitoring & Ongoing Maintenance

1. **Error Tracking & Logging:**
   - Monitor live exceptions and performance traces via your **Sentry** dashboard and **OpenTelemetry / Jaeger** collector.
   - Inspect structured JSON logs (with `trace_id`, `span_id`, and `X-Request-Id`) using Docker logs or your log forwarder:
   ```bash
   docker-compose logs -f --tail=100 backend
   ```

2. **Automated Backups:**
   - Set up a cron job on the host machine to back up the PostgreSQL database daily:
   ```bash
   0 2 * * * docker exec aoa77-postgres pg_dump -U user aoa77_production > /backups/aoa77_$(date +\%F).sql
   ```

