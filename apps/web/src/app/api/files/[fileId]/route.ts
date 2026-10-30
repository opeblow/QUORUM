import { NextResponse } from "next/server"
import { loadFile } from "@/lib/files"
import { getSessionUser } from "@/lib/session"

/** Download a shared file. Requires a session; ids are unguessable UUIDs scoped to one room. */
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
	const { fileId } = await params
	if (!(await getSessionUser())) return NextResponse.json({ error: "Sign in to download" }, { status: 401 })
	const file = await loadFile(fileId)
	if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 })
	const inline = file.mime.startsWith("image/") || file.mime === "application/pdf"
	return new NextResponse(new Uint8Array(file.data), {
		headers: {
			"content-type": file.mime,
			"content-length": String(file.size),
			"content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
			"x-content-type-options": "nosniff",
			"content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
			"cache-control": "private, max-age=3600",
		},
	})
}
