# Business Document Management Application

A secure, enterprise-grade business document management application designed for corporate document lifecycle management, approval hierarchies, transaction-safe numbering, payment tracking, and high-fidelity PDF generation.

Initial Organization Profile: **AOA 77 COMPANY LTD**

---

## Technology Stack

- **Backend:** Node.js, TypeScript, NestJS, Prisma ORM, PostgreSQL 16
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
- **PDF Engine:** Headless Chromium (Puppeteer) with server-side A4 HTML/CSS templating
- **Security:** Argon2id password hashing, rotating refresh tokens with token-family reuse detection, granular RBAC (32 permissions)

---

## Project Structure

```
business-doc-app/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Relational PostgreSQL schema
│   │   └── seed.ts             # Deterministic seed script (AOA 77 profile & RBAC)
│   ├── src/                    # NestJS API application modules
│   ├── .env.example            # Environment configuration template
│   ├── MIGRATIONS.md           # Operational migration & rollback guide
│   ├── package.json
│   └── tsconfig.json
└── frontend/                   # React + Vite client (Phase 8)
```

---

## Quickstart (Backend & Database)

### 1. Prerequisites
- Node.js v20+ / v24+
- PostgreSQL 16

### 2. Configure Environment
Copy `.env.example` to `.env` in `backend/`:
```bash
cd backend
cp .env.example .env
```
Ensure `DATABASE_URL` points to your PostgreSQL database.

### 3. Generate Prisma Client & Migrate
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init_business_doc_schema
```

### 4. Seed Development Database
Populate company profile, bank configuration, system roles, permissions, document sequences, templates, and industrial demo accounts:
```bash
npm run prisma:seed
```

---

## License
Proprietary & Confidential - AOA 77 COMPANY LTD
