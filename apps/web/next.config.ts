import { loadEnvConfig } from "@next/env"
import type { NextConfig } from "next"
import path from "node:path"

// One .env.local at the repo root serves the engine, the room server and this app.
// forceReload: Next has already loaded (and cached) this app's own folder before reading config.
loadEnvConfig(path.resolve(import.meta.dirname, "../.."), process.env.NODE_ENV !== "production", undefined, true)

const securityHeaders = [
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Frame-Options", value: "DENY" },
	// Calls need camera and microphone; everything else stays off.
	{ key: "Permissions-Policy", value: "microphone=(self), camera=(self), display-capture=(self), geolocation=()" },
]

const nextConfig: NextConfig = {
	cacheComponents: true,
	partialPrefetching: true,
	transpilePackages: ["@quorum/protocol", "@quorum/db"],
	turbopack: {
		rules: {
			"*.css": {
				loaders: ["@tailwindcss/turbopack"],
				as: "*.css",
			},
		},
	},
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }]
	},
}

export default nextConfig
