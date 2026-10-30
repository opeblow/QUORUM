import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end against the real stack: web (:3000), room server (:4000), Postgres, real models.
 * Start them first (see SETUP.md); these tests spend real tokens.
 */
export default defineConfig({
	testDir: "./e2e",
	timeout: 120_000,
	expect: { timeout: 45_000 },
	fullyParallel: false,
	// Tests share one real web + room server + database; run them one at a time.
	workers: 1,
	retries: 0,
	reporter: [["list"]],
	use: {
		baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		// Real WebRTC with synthetic camera/microphone devices.
		permissions: ["camera", "microphone"],
		launchOptions: {
			args: [
				"--use-fake-ui-for-media-stream",
				"--use-fake-device-for-media-stream",
				"--auto-select-desktop-capture-source=Entire screen",
				"--auto-accept-this-tab-capture",
			],
		},
	},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
	],
})
