import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ===========================================
// Meeting Tables
// ===========================================

export const meetings = pgTable(
  "meetings",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    transcript: text("transcript"),
    summary: text("summary"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("meetings_started_at_idx").on(table.startedAt)]
);

export const actionItems = pgTable(
  "action_items",
  {
    id: serial("id").primaryKey(),
    meetingId: integer("meeting_id").references(() => meetings.id, {
      onDelete: "cascade",
    }),
    assignee: varchar("assignee", { length: 255 }),
    task: text("task").notNull(),
    dueDate: timestamp("due_date"),
    completed: boolean("completed").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("action_items_meeting_id_idx").on(table.meetingId),
    index("action_items_completed_idx").on(table.completed),
  ]
);

// ===========================================
// Settings Table (Admin Configuration)
// ===========================================

export const settings = pgTable("settings", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===========================================
// Documents Table (RAG Metadata)
// ===========================================

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }),
    fileSize: integer("file_size"),
    chromadbCollectionId: varchar("chromadb_collection_id", { length: 255 }),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
    chunkCount: integer("chunk_count"),
  },
  (table) => [index("documents_uploaded_at_idx").on(table.uploadedAt)]
);

// ===========================================
// Type Exports
// ===========================================

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;

export type ActionItem = typeof actionItems.$inferSelect;
export type NewActionItem = typeof actionItems.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
