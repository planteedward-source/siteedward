import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "production-SEO",
      testMatch: "**/production.spec.js",
      use: {
        baseURL: "http://127.0.0.1:4173",
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "desktop",
      testIgnore: ["**/admin.spec.js", "**/production.spec.js"],
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      testIgnore: ["**/admin.spec.js", "**/production.spec.js"],
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "small-mobile",
      testIgnore: ["**/admin.spec.js", "**/production.spec.js"],
      use: {
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      },
    },
    {
      name: "admin-ui-fixtures",
      testMatch: "**/admin.spec.js",
      use: {
        baseURL: "http://127.0.0.1:5174",
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: [
    {
      command: "npm run preview",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
    {
      command: "npm run dev -- --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: true,
      env: {
        VITE_SUPABASE_URL: "https://fixture.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_for_tests_only",
      },
    },
  ],
});
