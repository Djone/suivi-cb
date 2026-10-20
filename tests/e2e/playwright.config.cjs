const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "*.spec.cjs",
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  expect: { timeout: 15000 },
  retries: 0,
  reporter: [[require.resolve("./reporter.cjs")]],
  outputDir: process.env.E2E_OUTPUT + "/browser",
  use: {
    baseURL: process.env.E2E_WEB,
    browserName: "chromium",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
