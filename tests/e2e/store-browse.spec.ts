import { test, expect } from '@playwright/test';

test.describe('Store Browsing', () => {
    test('should load the homepage successfully', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Wait for the page to hydrate — the Spendigo logo/branding should appear
        await expect(page.getByText('Spendigo').first()).toBeVisible({ timeout: 15_000 });
    });

    test('should navigate to a store if links are present', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Give the SPA a moment to render dynamic content
        await page.waitForTimeout(3000);

        // Store links are dynamic (depends on location/auth) — check if any exist
        const storeLinks = page.locator('a[href^="/store/"]');
        const count = await storeLinks.count();

        if (count > 0) {
            await storeLinks.first().click();
            await expect(page).toHaveURL(/\/store\/.+/);
        } else {
            // No stores visible (unauthenticated or no location) — that's OK
            test.skip();
        }
    });

    test('should display the search page', async ({ page }) => {
        await page.goto('/search');

        // Search input should be visible
        const searchInput = page.locator('input[type="text"], input[type="search"]').first();
        await expect(searchInput).toBeVisible({ timeout: 15_000 });
    });
});
