import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Spendigo
 * 
 * Tests run against the local Vite dev server.
 * Start the app first: `npm run dev`
 */
export default defineConfig({
    testDir: './tests/e2e',
    
    /* Maximum time one test can run */
    timeout: 60_000,
    
    /* Expect timeout for assertions */
    expect: {
        timeout: 15_000,
    },

    /* Run tests sequentially in CI for stability */
    fullyParallel: false,

    /* Fail the build on CI if you accidentally left test.only in the source code */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    /* Reporter */
    reporter: process.env.CI ? 'github' : 'html',

    /* Shared settings for all projects */
    use: {
        baseURL: 'https://localhost',
        
        /* Self-signed SSL cert from Vite */
        ignoreHTTPSErrors: true,

        /* Capture screenshot on failure */
        screenshot: 'only-on-failure',

        /* Record video on first retry */
        video: 'on-first-retry',

        /* Collect trace on failure for debugging */
        trace: 'on-first-retry',
    },

    projects: [
        /* Auth setup — runs first and saves storage state */
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },
        /* Main test suite — depends on auth setup */
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                storageState: './tests/e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
    ],

    /* Don't auto-start webServer — user must run `npm run dev` separately */
});
