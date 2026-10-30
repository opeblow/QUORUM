import { expect, test, type Page } from "@playwright/test"

/** Team memory across meetings: real mem0, real models. */
test.setTimeout(240_000)
const run = Date.now().toString(36)

async function say(page: Page, text: string) {
	const box = page.getByLabel("Say something")
	await box.fill(text)
	await box.press("Enter")
	await expect(box).toHaveValue("")
}

async function newRoom(page: Page, title: string) {
	await page.goto("/dashboard")
	await page.getByLabel("Meeting name").fill(title)
	await page.getByRole("button", { name: /new room/i }).click()
	await expect(page.getByRole("status")).toHaveText(/Live/)
}

test("a later meeting remembers — and flags — what an earlier one decided", async ({ page }) => {
	await page.goto("/sign-up")
	await page.getByLabel("Your name").fill("Mira Memory")
	await page.getByLabel("Email").fill(`mira+${run}@example.com`)
	await page.getByLabel("Password").fill("correct-horse-battery")
	await page.getByRole("button", { name: "Create account" }).click()
	await expect(page).toHaveURL(/\/dashboard/)

	// Meeting 1: decide on Postgres.
	await newRoom(page, `Analytics DB ${run}`)
	await say(page, "Okay, agreed — let's go with Postgres as the database for the analytics service.")
	const cards = page.getByRole("region", { name: "Agent cards" })
	await expect(cards.getByText("Decision", { exact: true }).first()).toBeVisible({ timeout: 60_000 })
	await page.getByRole("button", { name: "End", exact: true }).click()
	await page.getByRole("button", { name: "Confirm end" }).click()
	await expect(page.getByText("Meeting recap")).toBeVisible()

	// Meeting 2: decide the opposite. The Memory Keeper must surface meeting 1.
	await newRoom(page, `Analytics follow-up ${run}`)
	await say(page, "New plan: let's go with MongoDB as the database for the analytics service instead.")
	const recall = cards.getByText(/Contradicts an earlier decision|From an earlier meeting|Consistent with before/).first()
	await expect(recall).toBeVisible({ timeout: 120_000 })
	await expect(cards.getByText(/postgres/i).first()).toBeVisible()
	await page.screenshot({ path: "e2e/.artifacts/memory.png" })
})
