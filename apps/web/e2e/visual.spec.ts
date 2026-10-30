import { expect, test } from "@playwright/test"

/** Screenshots for design review across themes and viewports. No model tokens are spent. */
const run = Date.now().toString(36)

for (const scheme of ["dark", "light"] as const) {
	test(`landing renders in ${scheme}`, async ({ browser }) => {
		const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } })
		const page = await ctx.newPage()
		await page.goto("/")
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
		await page.screenshot({ path: `e2e/.artifacts/landing-${scheme}.png` })
		await ctx.close()
	})
}

test("phone: landing and live room", async ({ browser }) => {
	const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
	const page = await ctx.newPage()
	await page.goto("/")
	await page.screenshot({ path: "e2e/.artifacts/phone-landing.png" })

	await page.goto("/sign-up")
	await page.getByLabel("Your name").fill("Mia Mobile")
	await page.getByLabel("Email").fill(`mia+${run}@example.com`)
	await page.getByLabel("Password").fill("correct-horse-battery")
	await page.getByRole("button", { name: "Create account" }).click()
	await expect(page).toHaveURL(/\/dashboard/)
	await page.screenshot({ path: "e2e/.artifacts/phone-dashboard.png" })

	await page.getByLabel("Meeting name").fill("Phone check")
	await page.getByRole("button", { name: /new room/i }).click()
	await expect(page.getByRole("status")).toHaveText(/Live/)
	await page.screenshot({ path: "e2e/.artifacts/phone-room.png" })
	await page.getByRole("button", { name: /^Cards/ }).click()
	await page.screenshot({ path: "e2e/.artifacts/phone-cards.png" })
	await ctx.close()
})

test("desktop room in dark", async ({ browser }) => {
	const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } })
	const page = await ctx.newPage()
	await page.goto("/sign-up")
	await page.getByLabel("Your name").fill("Dee Dark")
	await page.getByLabel("Email").fill(`dee+${run}@example.com`)
	await page.getByLabel("Password").fill("correct-horse-battery")
	await page.getByRole("button", { name: "Create account" }).click()
	await page.getByLabel("Meeting name").fill("Dark check")
	await page.getByRole("button", { name: /new room/i }).click()
	await expect(page.getByRole("status")).toHaveText(/Live/)
	await page.screenshot({ path: "e2e/.artifacts/room-dark.png" })
	await ctx.close()
})
