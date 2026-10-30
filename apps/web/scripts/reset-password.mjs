/**
 * Admin: set a new password for an account (until emailed resets are configured).
 *   pnpm --filter @quorum/web reset-password you@example.com
 * The new password is typed at a hidden prompt — it never appears in the terminal or history.
 */
import { hashPassword } from "better-auth/crypto"
import { createInterface } from "node:readline"
import postgres from "postgres"

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
	console.error("Usage: pnpm --filter @quorum/web reset-password <email>")
	process.exit(1)
}

/** One reader for the whole run, so two prompts never fight over stdin. */
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true })
const lines = rl[Symbol.asyncIterator]()
let muted = false
if (process.stdin.isTTY) rl._writeToOutput = (s) => (muted ? undefined : rl.output.write(s))

async function askHidden(question) {
	process.stdout.write(question)
	muted = true
	const { value } = await lines.next()
	muted = false
	process.stdout.write("\n")
	return (value ?? "").trim()
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
const [user] = await sql.unsafe('select id from "user" where lower(email) = $1', [email])
if (!user) {
	console.error(`No account for ${email} in this database.`)
	rl.close()
	await sql.end()
	process.exit(1)
}
const pw = await askHidden("New password (min 10 characters): ")
const again = await askHidden("Repeat new password: ")
if (pw.length < 10 || pw !== again) {
	console.error(pw !== again ? "Passwords don't match." : "Password must be at least 10 characters.")
	rl.close()
	await sql.end()
	process.exit(1)
}
const result = await sql.unsafe(
	"update account set password = $1, updated_at = now() where user_id = $2 and provider_id = 'credential'",
	[await hashPassword(pw), user.id],
)
// Sign the account out everywhere so the old password can't keep a session alive.
await sql.unsafe('delete from session where user_id = $1', [user.id])
console.log(result.count ? "Password updated. Sign in with the new password." : "That account has no password login.")
rl.close()
await sql.end()
