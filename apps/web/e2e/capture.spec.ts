import { expect, test, type Browser, type Page } from "@playwright/test"

/**
 * Captures the real product screenshot used on the landing page: three real participants hold
 * a meeting against the real agents. Run with: CAPTURE=1 pnpm exec playwright test capture
 */
test.skip(!process.env.CAPTURE, "set CAPTURE=1 to regenerate marketing screenshots")
test.setTimeout(240_000)

const run = Date.now().toString(36)

async function join(browser: Browser, url: string, name: string): Promise<Page> {
	const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
	const page = await ctx.newPage()
	await page.goto(url)
	await page.getByLabel("Your name").fill(name)
	await page.getByRole("button", { name: "Join meeting" }).click()
	await expect(page.getByRole("status")).toHaveText(/Live/)
	return page
}

async function say(page: Page, text: string) {
	const box = page.getByLabel("Say something")
	await box.fill(text)
	await box.press("Enter")
	await page.waitForTimeout(1600)
}

test("capture live room", async ({ browser }) => {
	const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
	const ana = await ctx.newPage()
	await ana.goto("/sign-up")
	await ana.getByLabel("Your name").fill("Ana Petrović")
	await ana.getByLabel("Email").fill(`ana.capture+${run}@example.com`)
	await ana.getByLabel("Password").fill("correct-horse-battery")
	await ana.getByRole("button", { name: "Create account" }).click()
	await ana.getByLabel("Meeting name").fill("Analytics service — DB decision")
	await ana.getByRole("button", { name: /new room/i }).click()
	await expect(ana.getByRole("status")).toHaveText(/Live/)

	const marko = await join(browser, ana.url(), "Marko Ilić")
	const lena = await join(browser, ana.url(), "Lena Novak")

	await say(ana, "Morning everyone. We need to pick the database for the new analytics service.")
	await say(marko, "I'd vote Postgres. It has been around since 1996 and the team already knows it well.")
	await say(lena, "ClickHouse is built for analytics though. It was open-sourced by Yandex in 2016.")
	await say(marko, "Fun fact, the Great Wall of China is visible from the Moon with the naked eye, so scale is relative.")
	await say(lena, "Honestly Postgres sounds good to me.")
	await say(marko, "Agreed.")
	await say(ana, "Yes, makes sense. Let's go with Postgres for the analytics service.")
	await say(lena, "I'll write the migration plan and share it by Friday.")

	const approval = ana.getByRole("alertdialog", { name: "Approval needed" })
	await expect(approval).toBeVisible({ timeout: 60_000 })
	await approval.getByRole("button", { name: "Approve" }).click()
	await expect(ana.getByText(/False/).first()).toBeVisible({ timeout: 60_000 })

	// One more line so a few agents are mid-work (beams visible) when we capture.
	await say(marko, "Great, then Postgres 17 is the fastest database for analytics workloads.")
	await ana.waitForTimeout(1200)
	await ana.screenshot({ path: "public/product/room.png" })
	await ana.waitForTimeout(6000)
	await ana.screenshot({ path: "e2e/.artifacts/room-capture-after.png" })
	for (const p of [ana, marko, lena]) await p.context().close()
})
