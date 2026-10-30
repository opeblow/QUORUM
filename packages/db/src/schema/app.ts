import { customType, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const rooms = pgTable(
	"rooms",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		template: text("template").notNull().default("default"),
		status: text("status", { enum: ["open", "ended"] }).notNull().default("open"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		endedAt: timestamp("ended_at", { withTimezone: true }),
	},
	(t) => [index("rooms_owner_created_idx").on(t.ownerId, t.createdAt)],
)

/**
 * Latest full view of a room, written by the room server as the meeting runs and when it ends.
 * Recap pages read this; it is also what a room is rehydrated from after a server restart.
 */
export const roomSnapshots = pgTable("room_snapshots", {
	roomId: text("room_id")
		.primaryKey()
		.references(() => rooms.id, { onDelete: "cascade" }),
	snapshot: jsonb("snapshot").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Room = typeof rooms.$inferSelect
export type NewRoom = typeof rooms.$inferInsert

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" })

/**
 * Files shared in a meeting's chat. Stored in Postgres (≤10 MB each) to keep deployment simple;
 * the web app reads/writes them only through lib/files.ts so moving to object storage is local.
 */
export const roomFiles = pgTable(
	"room_files",
	{
		id: text("id").primaryKey(),
		roomId: text("room_id")
			.notNull()
			.references(() => rooms.id, { onDelete: "cascade" }),
		uploaderId: text("uploader_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		mime: text("mime").notNull(),
		size: integer("size").notNull(),
		data: bytea("data").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("room_files_room_idx").on(t.roomId)],
)
