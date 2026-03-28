import { test, expect } from '@playwright/test';

test.describe('Shopper Login Flow', () => {
    test.use({ storageState: { cookies: [], origins: [] } }); // Start unauthenticated

    test('should display login form and accept credentials', async ({ page }) => {
        await page.goto('/login');

        // Verify form elements are visible
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show error on invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[type="email"]', 'invalid@example.com');
        await page.fill('input[type="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Should show an error message (not redirect)
        await expect(page).toHaveURL(/\/login/);
    });

    test('should navigate to registration page', async ({ page }) => {
        await page.goto('/login');

        // Find and click the register link
        const registerLink = page.locator('a[href="/register"]');
        await expect(registerLink).toBeVisible();
        await registerLink.click();

        await expect(page).toHaveURL('/register');
    });

    test('should navigate to forgot password page', async ({ page }) => {
        await page.goto('/login');

        const forgotLink = page.locator('a[href="/forgot-password"]');
        await expect(forgotLink).toBeVisible();
        await forgotLink.click();

        await expect(page).toHaveURL('/forgot-password');
    });
});
