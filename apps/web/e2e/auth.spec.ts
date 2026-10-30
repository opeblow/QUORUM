import { expect, test } from "@playwright/test"

/** A returning user can sign out and sign back in; a wrong password is refused clearly. */
test("returning user signs back in", async ({ page }) => {
	const email = `returning+${Date.now().toString(36)}@example.com`
	const password = "correct-horse-battery"

	await page.goto("/sign-up")
	await page.getByLabel("Your name").fill("Rita Returning")
	await page.getByLabel("Email").fill(email)
	await page.getByLabel("Password").fill(password)
	await page.getByRole("button", { name: "Create account" }).click()
	await expect(page).toHaveURL(/\/dashboard/)

	await page.getByRole("button", { name: "Sign out" }).click()
	await expect(page).toHaveURL(/\/$/)

	await page.goto("/sign-in")
	await page.getByLabel("Email").fill(email)
	await page.getByLabel("Password").fill("wrong-password-123")
	await page.getByRole("button", { name: "Sign in" }).click()
	await expect(page.getByRole("alert")).toBeVisible()

	await page.getByLabel("Password").fill(password)
	await page.getByRole("button", { name: "Sign in" }).click()
	await expect(page).toHaveURL(/\/dashboard/)
	await expect(page.getByRole("heading", { name: /Hi Rita/ })).toBeVisible()
})
