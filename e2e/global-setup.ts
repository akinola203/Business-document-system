import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Global Setup for Playwright E2E Test Suite
 * Automatically verifies backend build and seeds test tenants, users, and baseline documents.
 */
async function globalSetup() {
  console.log('\n======================================================');
  console.log('🚀 [PLAYWRIGHT GLOBAL SETUP] Initializing Test Database');
  console.log('======================================================');

  const backendDir = path.resolve(__dirname, '../backend');

  // Verify backend dist exists; build if missing
  const mainDistPath = path.join(backendDir, 'dist/src/main.js');
  if (!fs.existsSync(mainDistPath)) {
    console.log('[GLOBAL SETUP] Compiling backend production build for webServer runner...');
    execSync('npm.cmd run build', { cwd: backendDir, stdio: 'inherit' });
  }

  // Populate test tenants, users (Admin, Manager, Staff), and baseline invoices/payments
  console.log('[GLOBAL SETUP] Seeding test database via prisma:seed...');
  try {
    execSync('npm.cmd run prisma:seed', {
      cwd: backendDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });
    console.log('✅ [GLOBAL SETUP] Test database successfully seeded.\n');
  } catch (err) {
    console.error('❌ [GLOBAL SETUP ERROR] Database seeding failed:', err);
    throw err;
  }
}

export default globalSetup;

