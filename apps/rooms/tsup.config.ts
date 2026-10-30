import { defineConfig } from "tsup"

// Workspace packages ship TypeScript source, so they are bundled in; npm dependencies stay external.
export default defineConfig({
	entry: ["src/main.ts"],
	format: ["esm"],
	target: "node24",
	platform: "node",
	clean: true,
	sourcemap: true,
	noExternal: [/^@quorum\//u],
})
