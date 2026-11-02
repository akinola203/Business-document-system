#!/usr/bin/env node
/**
 * Database Safety Guardrail
 *
 * Explicitly blocks destructive Prisma operations (`migrate reset`, `--force-reset`,
 * `--accept-data-loss`) when `DATABASE_URL` points to a production or Neon cloud
 * PostgreSQL host, or when `NODE_ENV === 'production'`.
 */

try {
  require('dotenv').config();
} catch {
  // dotenv is optional if environment variables are already injected by the host
}

const args = process.argv.slice(2);
const dbUrl = (process.env.DATABASE_URL || '').toLowerCase();
const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();

const isProductionHost =
  nodeEnv === 'production' ||
  dbUrl.includes('neon.tech') ||
  dbUrl.includes('aws.neon.tech') ||
  dbUrl.includes('render.com') ||
  dbUrl.includes('supabase.co');

const DESTRUCTIVE_FLAGS = [
  'reset',
  '--reset',
  '--force-reset',
  '--accept-data-loss',
];

const hasDestructiveFlag = args.some((arg) =>
  DESTRUCTIVE_FLAGS.includes(arg.toLowerCase()),
);

if (isProductionHost && hasDestructiveFlag) {
  console.error(
    '\n[DB SAFETY GUARD] CRITICAL ERROR: Destructive database operation blocked!\n' +
      `Refusing to execute [${args.join(' ')}] because DATABASE_URL points to a production/cloud database host or NODE_ENV=production.\n` +
      'Hard resets and --accept-data-loss are strictly prohibited in production to prevent accidental data loss.\n',
  );
  process.exit(1);
}

console.log('[DB SAFETY GUARD] Database safety verification passed.');

