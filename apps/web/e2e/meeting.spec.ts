import { expect, test, type Page } from "@playwright/test"

const run = Date.now().toString(36)

const transcript = (page: Page) => page.getByLabel("Live transcript")
const cards = (page: Page) => page.getByRole("region", { name: "Agent cards" })

async function say(page: Page, text: string) {
	const box = page.getByLabel("Say something")
	await box.fill(text)
	await box.press("Enter")
	await expect(box).toHaveValue("")
}

test("host and guest hold a meeting with live agents", async ({ browser }) => {
	// Real models + a remote database: the full meeting takes a few minutes.
	test.setTimeout(240_000)
	// ── Host signs up and opens a room ─────────────────────────────────────
	const hostContext = await browser.newContext({ permissions: ["camera", "microphone"] })
	const host = await hostContext.newPage()
	await host.goto("/sign-up")
	await host.getByLabel("Your name").fill("Ana Host")
	await host.getByLabel("Email").fill(`ana+${run}@example.com`)
	await host.getByLabel("Password").fill("correct-horse-battery")
	await host.getByRole("button", { name: "Create account" }).click()
	await expect(host).toHaveURL(/\/dashboard/)

	await host.getByLabel("Meeting name").fill(`E2E sync ${run}`)
	await host.getByRole("button", { name: /new room/i }).click()
	await expect(host).toHaveURL(/\/r\/[a-z0-9]+$/)
	await expect(host.getByRole("status")).toHaveText(/Live/)
	const roomUrl = host.url()

	// ── Guest joins from the invite link with just a name ──────────────────
	const guestContext = await browser.newContext({ permissions: ["camera", "microphone"] })
	const guest = await guestContext.newPage()
	await guest.goto(roomUrl)
	await guest.getByLabel("Your name").fill("Bo Guest")
	await guest.getByRole("button", { name: "Join meeting" }).click()
	await expect(guest.getByRole("status")).toHaveText(/Live/)

	// ── Video call: both join, each receives the other's live video ───────
	await host.getByTestId("join-call").first().click()
	await guest.getByTestId("join-call").first().click()
	for (const page of [host, guest]) {
		await expect
			.poll(() => page.locator('[data-testid="remote-video"]').evaluateAll((els) => els.some((v) => (v as HTMLVideoElement).videoWidth > 0)), {
				timeout: 30_000,
			})
			.toBe(true)
	}

	// ── Call controls: mute, camera off, screen share, data saver ─────────
	await host.getByRole("button", { name: "Mute microphone" }).click()
	await host.getByRole("button", { name: "Unmute microphone" }).click()
	await host.getByRole("button", { name: "Turn camera off" }).click()
	await host.getByRole("button", { name: "Turn camera on" }).click()
	await host.getByRole("button", { name: "Data saver off" }).click()
	await expect(host.getByRole("button", { name: "Data saver on (360p)" })).toBeVisible()
	await host.getByRole("button", { name: "Share screen" }).click()
	await expect(guest.getByText("Ana Host is presenting")).toBeVisible({ timeout: 15_000 })
	await host.getByRole("button", { name: "Stop presenting" }).click()
	await expect(guest.getByText("Ana Host is presenting")).toHaveCount(0)

	// ── Invite link points at this room ───────────────────────────────────
	await host.getByRole("button", { name: "Invite" }).click()
	await expect(host.getByTestId("invite-url")).toHaveText(roomUrl)
	await host.getByRole("button", { name: "Close" }).click()

	// ── Chat with a file attachment ────────────────────────────────────────
	await guest.getByRole("tab", { name: /Chat/ }).click()
	await guest.getByLabel("Chat message", { exact: true }).fill("Here are the numbers before we decide")
	await guest.getByLabel("Chat message", { exact: true }).press("Enter")
	await guest.getByTestId("chat-file").setInputFiles({ name: "q3-numbers.csv", mimeType: "text/csv", buffer: Buffer.from("month,users;jul,1200;aug,1850") })
	await host.getByRole("tab", { name: /Chat/ }).click()
	await expect(host.getByText("Here are the numbers before we decide")).toBeVisible()
	const fileLink = host.getByRole("link", { name: /q3-numbers\.csv/ })
	await expect(fileLink).toBeVisible()
	const download = await host.request.get((await fileLink.getAttribute("href"))!)
	expect(download.status()).toBe(200)
	expect(await download.text()).toContain("aug,1850")
	await host.getByRole("tab", { name: /Agent work/ }).click()
	await guest.getByRole("tab", { name: /Agent work/ }).click()

	// ── Conversation: both see the shared transcript ───────────────────────
	await say(host, "We need to pick the database for the new analytics service.")
	await say(guest, "Postgres has been around since 1996 and the team already knows it well.")
	await expect(transcript(host).getByText("Postgres has been around since 1996")).toBeVisible()
	await expect(transcript(guest).getByText("We need to pick the database")).toBeVisible()
	// Fact-Checker picks up the claim and resolves it with a verdict
	await expect(cards(host).getByText(/Supported|Disputed|False|Can't verify/).first()).toBeVisible()

	// ── Agents respond (real models) ──────────────────────────────────────
	await say(host, "Okay, agreed, let's go with Postgres for the analytics service.")
	await expect(cards(guest).getByText("Decision", { exact: true }).first()).toBeVisible()

	// ── Approval: action item pauses until a human decides ─────────────────
	await say(guest, "I'll write the migration plan and share it by Friday.")
	const approval = host.getByRole("alertdialog", { name: "Approval needed" })
	await expect(approval).toBeVisible()
	await approval.getByRole("button", { name: "Approve" }).click()
	await expect(cards(host).getByText(/Approved by Ana Host/)).toBeVisible()
	await expect(cards(guest).getByText(/migration plan/i).first()).toBeVisible()

	await host.screenshot({ path: "e2e/.artifacts/host-room.png", fullPage: false })

	// ── Host ends the meeting; everyone lands on the recap ─────────────────
	await expect(guest.getByRole("button", { name: /^End$|Confirm end/ })).toHaveCount(0)
	await host.getByRole("button", { name: "End", exact: true }).click()
	await host.getByRole("button", { name: "Confirm end" }).click()
	for (const page of [host, guest]) {
		await expect(page.getByText("Meeting recap")).toBeVisible()
		await expect(page.getByRole("heading", { name: "Decisions" })).toBeVisible()
		await expect(page.getByText(/migration plan/i).first()).toBeVisible()
	}
	await host.screenshot({ path: "e2e/.artifacts/recap.png", fullPage: true })
	await hostContext.close()
	await guestContext.close()
})
