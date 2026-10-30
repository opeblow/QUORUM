# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's **private vulnerability reporting** on this repository ("Security" → "Report a vulnerability").

Include what you found, how to reproduce it, and the impact you believe it has. We aim to acknowledge reports within **48 hours** and to ship a fix or mitigation for confirmed high-severity issues within **7 days**. We credit reporters who wish to be named.

Good-faith research that respects users' privacy, avoids service disruption and gives us time to fix issues before disclosure will not be pursued legally.

## Supported versions

Only the latest `main` is supported.

## Security model (summary)

| Area | Control |
|---|---|
| Accounts | Better Auth; passwords hashed; sessions in Postgres with a signed cookie cache; built-in auth rate limiting |
| Guests | Anonymous accounts created only when joining a room by link |
| Room access | Unguessable room ids; short-lived (10 min) HS256 **room tickets** minted per connection; origin allow-list on the room server |
| Real-time input | Every WebSocket message validated with zod; per-connection token-bucket rate limits; message size caps; slow-consumer disconnect; heartbeats |
| Agents & prompt injection | Transcript text is wrapped and labelled as untrusted data; tools are allow-listed; consequential tools **pause for human approval**; approval stamps carry a per-room secret so a model cannot forge them; output is schema-validated |
| Secrets | Environment variables only; provider error messages are redacted before reaching logs or browsers; Mozaik Cloud redaction supported |
| Files | Type allow-list, 10 MB cap, membership-checked downloads, `nosniff`, sandboxed CSP on responses |
| Browser | `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, Permissions-Policy limited to camera/microphone/screen for this origin |
| Media | WebRTC is end-to-end encrypted in transit (DTLS-SRTP) between participants; media does not pass through our servers |
| Resilience | Provider failures are contained per agent; the room server never crashes on one room's error |

## Known limitations

- Rate limits of the auth layer are per web instance until backed by Redis.
- Room links are bearer invitations: anyone with the link can join. Host-controlled admission (waiting room) is on the roadmap.
