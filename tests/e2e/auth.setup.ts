import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Authentication Setup
 * 
 * Logs in as a test shopper and saves the browser state (cookies, localStorage)
 * so subsequent tests start already authenticated.
 * 
 * Set these environment variables before running:
 *   SPENDIGO_TEST_EMAIL=test@example.com
 *   SPENDIGO_TEST_PASSWORD=yourpassword
 */
setup('authenticate as test shopper', async ({ page }) => {
    const email = process.env.SPENDIGO_TEST_EMAIL;
    const password = process.env.SPENDIGO_TEST_PASSWORD;

    if (!email || !password) {
        console.warn(
            '[Auth Setup] SPENDIGO_TEST_EMAIL / SPENDIGO_TEST_PASSWORD not set. ' +
            'Skipping authentication — tests requiring login will fail.'
        );
        // Save empty state so Playwright doesn't crash
        await page.context().storageState({ path: authFile });
        return;
    }

    // Navigate to login page
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

    // Fill in credentials
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for redirect to homepage (stores page) — the user avatar should appear
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // Save authenticated browser state
    await page.context().storageState({ path: authFile });
});
