import { test, expect } from '@playwright/test';

test.describe('Legal Pages', () => {
    test.use({ storageState: { cookies: [], origins: [] } }); // No auth needed

    test('should render the Privacy Policy page', async ({ page }) => {
        await page.goto('/privacy');

        await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Information We Collect')).toBeVisible();
        await expect(page.getByText('Data Subject Access Requests')).toBeVisible();
    });

    test('should render the Terms of Service page', async ({ page }) => {
        await page.goto('/terms');

        await expect(page.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Platform Role')).toBeVisible();
        await expect(page.getByText('User Conduct')).toBeVisible();
    });

    test('should navigate between Privacy and Terms', async ({ page }) => {
        await page.goto('/privacy');

        // Click the cross-link to Terms
        const termsLink = page.getByText('Read our Terms of Service');
        await expect(termsLink).toBeVisible();
        await termsLink.click();

        await expect(page).toHaveURL('/terms');
        await expect(page.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeVisible();
    });

    test('should have footer links on homepage', async ({ page }) => {
        await page.goto('/');

        // Scroll to footer area
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        const privacyLink = page.locator('footer a[href="/privacy"]');
        const termsLink = page.locator('footer a[href="/terms"]');

        await expect(privacyLink).toBeVisible({ timeout: 5_000 });
        await expect(termsLink).toBeVisible();
    });
});
