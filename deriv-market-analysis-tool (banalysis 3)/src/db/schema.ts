import {
  pgTable,
  serial,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * Persisted trading signals produced by the analysis engine.
 * A row is written every time a market reaches a full ENTER condition
 * (or a STOP/WARNING event) so the history can be reviewed later.
 */
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  symbolName: text("symbol_name").notNull(),
  // "EVEN" | "ODD"
  direction: text("direction").notNull(),
  // "ENTER" | "WARNING" | "STOP" | "SETUP"
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  // the digit that fired the trigger (nullable for setup/warning)
  triggerDigit: integer("trigger_digit"),
  // full frequency snapshot at the moment of the event
  frequencies: jsonb("frequencies").$type<number[]>(),
  colors: jsonb("colors").$type<Record<string, number>>(),
  runIndex: integer("run_index").default(0),
  confirmed: boolean("confirmed").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Periodic snapshots of each market's frequency distribution.
 * Used for historical pattern analysis.
 */
export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  lastDigit: integer("last_digit").notNull(),
  evenPct: real("even_pct").notNull(),
  oddPct: real("odd_pct").notNull(),
  frequencies: jsonb("frequencies").$type<number[]>(),
  dominant: text("dominant"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;
export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
