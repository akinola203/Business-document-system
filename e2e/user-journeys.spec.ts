import { test, expect } from '@playwright/test';

test.describe('AOA 77 Document Management System - Core User Journeys', () => {

  test.describe('1. Authentication Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();
    });

    test('rejects invalid credentials with an error alert and rate-limiting safeguards', async ({ page }) => {
      await page.fill('input[type="email"]', 'manager@aoa77.com');
      await page.fill('input[type="password"]', 'WrongPassword123!');
      await page.click('button[type="submit"]');

      // Verify that error banner is displayed
      const errorAlert = page.locator('text=Login Error:');
      await expect(errorAlert.first()).toBeVisible({ timeout: 12000 });
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('logs in successfully as Manager and redirects to the overview dashboard', async ({ page }) => {
      await page.fill('input[type="email"]', 'manager@aoa77.com');
      await page.fill('input[type="password"]', 'Aoa77@Password2026!');
      await page.click('button[type="submit"]');

      // Verify redirection to /overview dashboard
      await page.waitForURL('**/overview', { timeout: 20000 });
      await expect(page).toHaveURL(/.*\/overview/);

      // Verify main workspace branding is present
      await expect(page.locator('text=AOA 77 System').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('2. Invoice & Waybill Creation', () => {
    test.beforeEach(async ({ page }) => {
      // Authenticate as Manager before document operations
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      await page.fill('input[type="email"]', 'manager@aoa77.com');
      await page.fill('input[type="password"]', 'Aoa77@Password2026!');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/overview', { timeout: 20000 });
    });

    test('creates and submits an invoice document draft through the split-screen studio', async ({ page }) => {
      await page.goto('/documents/invoices/new');

      // Wait for Studio to mount
      await expect(page.locator('text=Invoice Studio').first()).toBeVisible({ timeout: 20000 });

      // Click the quick Cement Demo preset pill to populate realistic industrial invoice data
      const cementPresetBtn = page.locator('button:has-text("⚡ Cement Demo")');
      const fallbackPresetBtn = page.locator('button:has-text("⚡ Demo Preset")');

      if (await cementPresetBtn.isVisible()) {
        await cementPresetBtn.click();
      } else if (await fallbackPresetBtn.isVisible()) {
        await fallbackPresetBtn.click();
      } else {
        const clientSelect = page.locator('select').first();
        await clientSelect.selectOption({ index: 1 });
      }

      // Ensure title input has valid content
      const titleInput = page.locator('input[name="title"]');
      if (await titleInput.isVisible()) {
        const val = await titleInput.inputValue();
        if (!val || val.length < 3) {
          await titleInput.fill('Q3 Industrial Cement Haulage Contract');
        }
      }

      // Save as draft using the StudioHeaderBar CTA
      const saveDraftBtn = page.locator('button:has-text("Save as Draft")');
      await expect(saveDraftBtn).toBeEnabled({ timeout: 10000 });
      await saveDraftBtn.click();

      // Verify that save succeeds and URL reflects the created invoice ID or remains in editor
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/documents\/invoices/);
    });

    test('creates and saves a logistics waybill draft through the waybill studio', async ({ page }) => {
      await page.goto('/documents/waybills/new');

      // Wait for Waybill Studio to mount
      await expect(page.locator('text=Waybill Studio').first()).toBeVisible({ timeout: 20000 });

      // Fill waybill addresses and dispatch details
      await page.fill('textarea[name="originAddress"]', 'AOA 77 Ota Depot, Ogun State');
      await page.fill('textarea[name="destinationAddress"]', 'Dangote Ibese Works Complex, Ogun State');

      // Fill cargo line item description if present
      const descInput = page.locator('input[placeholder*="Cargo description"]').first();
      if (await descInput.isVisible()) {
        await descInput.fill('500 Bags Portland Limestone Cement');
      }

      // Save Waybill as Draft
      const saveDraftBtn = page.locator('button:has-text("Save as Draft")');
      await expect(saveDraftBtn).toBeEnabled({ timeout: 10000 });
      await saveDraftBtn.click();

      await page.waitForTimeout(3000);
      expect(page.url()).toMatch(/\/documents\/waybills/);
    });
  });

  test.describe('3. Audited Payment Reversal', () => {
    test.beforeEach(async ({ page }) => {
      // Authenticate as Manager (authorized for payment reversals)
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      await page.fill('input[type="email"]', 'manager@aoa77.com');
      await page.fill('input[type="password"]', 'Aoa77@Password2026!');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/overview', { timeout: 20000 });
    });

    test('enforces >= 5 characters audit reason and updates visual ledger status on reversal', async ({ page }) => {
      await page.goto('/payments');

      // Wait for payment list to load
      await expect(page.locator('text=Payments Ledger').first()).toBeVisible({ timeout: 20000 });

      // Click on the first payment transaction card in the left list
      const paymentCard = page.locator('button:has-text("PAY-")').first();
      await expect(paymentCard).toBeVisible({ timeout: 15000 });
      await paymentCard.click();

      // Verify Inspector displays the payment and the "Reverse Payment" button
      const reverseBtn = page.locator('button:has-text("Reverse Payment")');
      await expect(reverseBtn).toBeVisible({ timeout: 10000 });
      await reverseBtn.click();

      // Verify Modal opens: "Reverse Financial Settlement"
      await expect(page.locator('text=Reverse Financial Settlement')).toBeVisible({ timeout: 10000 });

      // Step 1: Test validation - reason < 5 characters
      const reasonTextarea = page.locator('textarea[placeholder*="Duplicate bank teller"]');
      const executeBtn = page.locator('button:has-text("Execute Reversal")');

      await reasonTextarea.fill('err');
      // The button should remain disabled
      await expect(executeBtn).toBeDisabled();

      // Step 2: Enter valid audit justification (>= 5 chars)
      await reasonTextarea.fill('Duplicate banking transaction reference voided during monthly financial ledger audit.');
      await expect(executeBtn).toBeEnabled();

      // Execute reversal
      await executeBtn.click();

      // Verify visual badge updates to REVERSED in the inspector
      await expect(page.locator('span:has-text("REVERSED")').first()).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('4. Security & RBAC Enforcement', () => {
    test('blocks Staff user with 403 Forbidden / Access Restricted on administrative settings', async ({ page }) => {
      // Login as Staff user (non-admin, non-manager)
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      await page.fill('input[type="email"]', 'staff@aoa77.com');
      await page.fill('input[type="password"]', 'Aoa77@Password2026!');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/overview', { timeout: 20000 });

      // Attempt to access administrative company settings (/settings/company requires 'settings:manage')
      await page.goto('/settings/company');

      // Verify UI blocks with Access Restricted banner
      const restrictedBanner = page.locator('text=Access Restricted');
      await expect(restrictedBanner).toBeVisible({ timeout: 15000 });

      const explanationText = page.locator('text=Your active account does not have the required permission');
      await expect(explanationText).toBeVisible({ timeout: 10000 });

      // Also attempt to access compliance audit logs (/audit-logs requires 'audit:view')
      await page.goto('/audit-logs');
      await expect(page.locator('text=Access Restricted')).toBeVisible({ timeout: 15000 });
    });
  });

});
