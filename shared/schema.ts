import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Players table - core user data with Town Level progression
export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  townName: text("town_name").notNull(),
  townLevel: integer("town_level").notNull().default(1),
  coins: integer("coins").notNull().default(1000),
  credits: integer("credits").notNull().default(100),
  townTemplate: text("town_template").notNull().default("starter"), // starter, balanced, creator
  currentDistrict: text("current_district").default("center"),
  tutorialCompleted: boolean("tutorial_completed").notNull().default(false),
  firstDayMissionsCompleted: integer("first_day_missions_completed").notNull().default(0),
  lastActive: timestamp("last_active").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Buildings in player's town
export const buildings = pgTable("buildings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  type: text("type").notNull(), // town_center, shop, arcade, puzzle_hub
  level: integer("level").notNull().default(1),
  district: text("district").notNull(), // center, north, south, east, west
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  upgrading: boolean("upgrading").notNull().default(false),
  upgradeCompletesAt: timestamp("upgrade_completes_at"),
  lastCollectedAt: timestamp("last_collected_at"),
});

// Shop items with dynamic pricing
export const shopItems = pgTable("shop_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // resource, tool, cosmetic, booster
  basePrice: integer("base_price").notNull(),
  currentPrice: integer("current_price").notNull(),
  stock: integer("stock").notNull().default(100),
  priceVolatility: real("price_volatility").notNull().default(0),
  iconUrl: text("icon_url"),
  description: text("description"),
});

// Player inventory
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  itemId: varchar("item_id").notNull(),
  quantity: integer("quantity").notNull().default(0),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
});

// Microgames created by players
export const microgames = pgTable("microgames", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").notNull(),
  title: text("title").notNull(),
  template: text("template").notNull(), // endless_runner, puzzle, clicker
  config: jsonb("config").notNull(), // game-specific configuration
  quarantined: boolean("quarantined").notNull().default(true),
  plays: integer("plays").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  approved: boolean("approved").notNull().default(false),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Spatial puzzles
export const spatialPuzzles = pgTable("spatial_puzzles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").notNull(),
  title: text("title").notNull(),
  district: text("district").notNull(),
  difficulty: integer("difficulty").notNull().default(1), // 1-5
  pieces: jsonb("pieces").notNull(), // array of puzzle piece positions
  completions: integer("completions").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Puzzle completions
export const puzzleCompletions = pgTable("puzzle_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  puzzleId: varchar("puzzle_id").notNull(),
  playerId: varchar("player_id").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

// Governance - Mayor and Vice Mayors
export const governance = pgTable("governance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mayorId: varchar("mayor_id"),
  viceMayor1Id: varchar("vice_mayor_1_id"),
  viceMayor2Id: varchar("vice_mayor_2_id"),
  viceMayor3Id: varchar("vice_mayor_3_id"),
  currentTerm: integer("current_term").notNull().default(1),
  nextElectionAt: timestamp("next_election_at"),
});

// Policy proposals
export const policies = pgTable("policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposerId: varchar("proposer_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  parameter: text("parameter").notNull(), // tax_rate, resource_decay, etc.
  currentValue: real("current_value").notNull(),
  proposedValue: real("proposed_value").notNull(),
  votesFor: integer("votes_for").notNull().default(0),
  votesAgainst: integer("votes_against").notNull().default(0),
  status: text("status").notNull().default("active"), // active, passed, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// StoryNet daily votes
export const storyNetVotes = pgTable("story_net_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  policyId: varchar("policy_id").notNull(),
  vote: boolean("vote").notNull(), // true = for, false = against
  votedAt: timestamp("voted_at").notNull().defaultNow(),
});

// Governance ledger (public log)
export const governanceLedger = pgTable("governance_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  actorId: varchar("actor_id"),
  details: jsonb("details"),
  impact: text("impact"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Heist missions
export const heists = pgTable("heists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaderId: varchar("leader_id").notNull(),
  partnerId: varchar("partner_id"),
  status: text("status").notNull().default("planning"), // planning, executing, completed, failed
  targetBuilding: text("target_building").notNull(),
  plan: jsonb("plan"), // waypoints, entry times, equipment
  stealthMeter: integer("stealth_meter").notNull().default(100),
  reward: integer("reward").notNull(),
  reputationRisk: integer("reputation_risk").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Shop transactions for telemetry
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  itemId: varchar("item_id").notNull(),
  type: text("type").notNull(), // buy, sell
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(),
  currency: text("currency").notNull(), // coins, credits
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Telemetry events
export const telemetryEvents = pgTable("telemetry_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id"),
  eventType: text("event_type").notNull(), // session_start, tl_upgrade, microgame_play, etc.
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// UGC reports
export const ugcReports = pgTable("ugc_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull(),
  contentType: text("content_type").notNull(), // microgame, puzzle
  contentId: varchar("content_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("pending"), // pending, reviewed, actioned
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Zod schemas for validation
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, createdAt: true, lastActive: true });
export const insertBuildingSchema = createInsertSchema(buildings).omit({ id: true });
export const insertShopItemSchema = createInsertSchema(shopItems).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, acquiredAt: true });
export const insertMicrogameSchema = createInsertSchema(microgames).omit({ id: true, createdAt: true, plays: true, shares: true, quarantined: true, approved: true, flagged: true });
export const insertSpatialPuzzleSchema = createInsertSchema(spatialPuzzles).omit({ id: true, createdAt: true, completions: true });
export const insertPolicySchema = createInsertSchema(policies).omit({ id: true, createdAt: true, votesFor: true, votesAgainst: true });
export const insertHeistSchema = createInsertSchema(heists).omit({ id: true, createdAt: true, status: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, timestamp: true });
export const insertUGCReportSchema = createInsertSchema(ugcReports).omit({ id: true, createdAt: true, status: true });

// TypeScript types
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Building = typeof buildings.$inferSelect;
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type ShopItem = typeof shopItems.$inferSelect;
export type InsertShopItem = z.infer<typeof insertShopItemSchema>;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Microgame = typeof microgames.$inferSelect;
export type InsertMicrogame = z.infer<typeof insertMicrogameSchema>;
export type SpatialPuzzle = typeof spatialPuzzles.$inferSelect;
export type InsertSpatialPuzzle = z.infer<typeof insertSpatialPuzzleSchema>;
export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Governance = typeof governance.$inferSelect;
export type GovernanceLedger = typeof governanceLedger.$inferSelect;
export type Heist = typeof heists.$inferSelect;
export type InsertHeist = z.infer<typeof insertHeistSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TelemetryEvent = typeof telemetryEvents.$inferSelect;
export type UGCReport = typeof ugcReports.$inferSelect;
export type InsertUGCReport = z.infer<typeof insertUGCReportSchema>;
export type PuzzleCompletion = typeof puzzleCompletions.$inferSelect;
export type StoryNetVote = typeof storyNetVotes.$inferSelect;

// Town Level progression constants
export const TOWN_LEVEL_REQUIREMENTS = {
  2: { days: 3, coins: 5000, buildings: 3 },
  3: { days: 5, coins: 10000, buildings: 5 },
  4: { days: 7, coins: 20000, buildings: 7 },
  5: { days: 10, coins: 35000, buildings: 10 },
  6: { days: 14, coins: 50000, buildings: 12 },
  7: { days: 21, coins: 75000, buildings: 15 },
  8: { days: 28, coins: 100000, buildings: 18 },
  9: { days: 35, coins: 150000, buildings: 20 },
  10: { days: 45, coins: 200000, buildings: 22 },
  11: { days: 60, coins: 300000, buildings: 25 },
  12: { days: 90, coins: 500000, buildings: 30 },
};

// District names
export const DISTRICTS = ["center", "north", "south", "east", "west"] as const;
export type District = typeof DISTRICTS[number];

// Building types
export const BUILDING_TYPES = ["town_center", "shop", "arcade", "puzzle_hub"] as const;
export type BuildingType = typeof BUILDING_TYPES[number];

// Microgame templates
export const MICROGAME_TEMPLATES = ["endless_runner", "puzzle", "clicker"] as const;
export type MicrogameTemplate = typeof MICROGAME_TEMPLATES[number];
