import { expect, test } from "@playwright/test"

/** Picking a language changes the whole room UI (and right-to-left layout for Arabic). */
test("the room speaks the language you pick", async ({ page }) => {
	const run = Date.now().toString(36)
	await page.goto("/sign-up")
	await page.getByLabel("Your name").fill("Lia Lugha")
	await page.getByLabel("Email").fill(`lia+${run}@example.com`)
	await page.getByLabel("Password").fill("correct-horse-battery")
	await page.getByRole("button", { name: "Create account" }).click()
	await page.getByLabel("Meeting name").fill("Lugha")
	await page.getByRole("button", { name: /new room/i }).click()
	await expect(page.getByRole("status")).toHaveText(/Live/)

	await page.getByLabel("Language").selectOption("sw-KE")
	await expect(page.getByRole("heading", { name: "Nakala" })).toBeVisible()
	await expect(page.getByRole("button", { name: "Jiunge kwa kamera" })).toBeVisible()
	await expect(page.getByRole("tab", { name: /Kazi ya mawakala/ })).toBeVisible()
	await expect(page.getByText("Mhakiki wa Ukweli").first()).toBeVisible()
	await expect(page.getByRole("status")).toHaveText(/Moja kwa moja/)
	await page.screenshot({ path: "e2e/.artifacts/room-swahili.png" })

	await page.getByLabel("Lugha").selectOption("ar-EG")
	await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
	await expect(page.getByRole("button", { name: "انضم بالكاميرا" })).toBeVisible()
	await page.screenshot({ path: "e2e/.artifacts/room-arabic.png" })

	// The choice sticks across reloads.
	await page.reload()
	await expect(page.locator("html")).toHaveAttribute("dir", "rtl")

	await page.getByLabel("اللغة").selectOption("en-NG")
	await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible()
	await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
})
