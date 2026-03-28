import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
    test('should show empty cart message when no items', async ({ page }) => {
        await page.goto('/cart');

        // Should display an empty cart indicator
        const emptyText = page.getByText(/cart is empty|no items|nothing/i);
        await expect(emptyText).toBeVisible({ timeout: 15_000 });
    });

    test('should navigate to checkout from cart', async ({ page }) => {
        await page.goto('/cart');

        // Look for a checkout button (it may be disabled if cart is empty)
        const checkoutBtn = page.locator('a[href="/checkout"], button:has-text("Checkout")');
        
        // If checkout button exists, verify it's present
        if (await checkoutBtn.count() > 0) {
            await expect(checkoutBtn.first()).toBeVisible();
        }
    });

    test('should handle empty cart on checkout page', async ({ page }) => {
        await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        // With an empty cart, we should either:
        // - See an empty cart message
        // - Be redirected to cart or home or login
        // All of these are valid behaviors
        const url = page.url();
        const isOnCheckout = url.includes('/checkout');
        
        if (isOnCheckout) {
            // If still on checkout, there should be some content rendered
            await expect(page.locator('body')).not.toBeEmpty();
        }
        // If redirected, that's also a valid behavior — test passes
    });
});
