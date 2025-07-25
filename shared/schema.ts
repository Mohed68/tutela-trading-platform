import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  companyName: varchar("company_name"),
  role: varchar("role").default("trader"),
  financialRating: decimal("financial_rating", { precision: 3, scale: 1 }).default("0"),
  creditRating: varchar("credit_rating").default("unrated"),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const commodityTypeEnum = pgEnum("commodity_type", [
  "fuel_hydrocarbons",
  "metals_precious",
  "agricultural"
]);

export const offerTypeEnum = pgEnum("offer_type", ["buy", "sell"]);
export const offerStatusEnum = pgEnum("offer_status", ["active", "pending", "closed", "cancelled"]);

export const commodities = pgTable("commodities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: commodityTypeEnum("type").notNull(),
  description: text("description"),
  specifications: jsonb("specifications"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const offers = pgTable("offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  commodityId: varchar("commodity_id").notNull().references(() => commodities.id),
  type: offerTypeEnum("type").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  unit: varchar("unit").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  location: varchar("location").notNull(),
  status: offerStatusEnum("status").default("active"),
  validUntil: timestamp("valid_until"),
  minQuantity: decimal("min_quantity", { precision: 15, scale: 2 }),
  deliveryTerms: text("delivery_terms"),
  paymentTerms: text("payment_terms"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "pending_approval",
  "active",
  "completed",
  "cancelled"
]);

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  offerId: varchar("offer_id").notNull().references(() => offers.id),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  status: contractStatusEnum("status").default("draft"),
  terms: jsonb("terms"),
  blockchainTxHash: varchar("blockchain_tx_hash"),
  signedAt: timestamp("signed_at"),
  deliveryDate: timestamp("delivery_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "requires_additional_docs"
]);

export const verificationDocuments = pgTable("verification_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  documentType: varchar("document_type").notNull(),
  fileName: varchar("file_name").notNull(),
  filePath: varchar("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  status: verificationStatusEnum("status").default("pending"),
  aiValidationResult: jsonb("ai_validation_result"),
  reviewNotes: text("review_notes"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const partnerRelations = pgTable("partner_relations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  partnerId: varchar("partner_id").notNull().references(() => users.id),
  status: varchar("status").default("pending"), // pending, approved, rejected
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: varchar("action").notNull(),
  entityType: varchar("entity_type"),
  entityId: varchar("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  companyName: true,
  role: true,
});

// Upsert schema for Replit Auth (includes id)
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  companyName: true,
  role: true,
});

export const insertCommoditySchema = createInsertSchema(commodities).pick({
  name: true,
  type: true,
  description: true,
  specifications: true,
});

export const insertOfferSchema = createInsertSchema(offers).pick({
  commodityId: true,
  type: true,
  quantity: true,
  unit: true,
  pricePerUnit: true,
  currency: true,
  location: true,
  validUntil: true,
  minQuantity: true,
  deliveryTerms: true,
  paymentTerms: true,
});

export const insertContractSchema = createInsertSchema(contracts).pick({
  offerId: true,
  buyerId: true,
  sellerId: true,
  quantity: true,
  totalPrice: true,
  terms: true,
  deliveryDate: true,
});

export const insertVerificationDocumentSchema = createInsertSchema(verificationDocuments).pick({
  documentType: true,
  fileName: true,
  filePath: true,
  fileSize: true,
  mimeType: true,
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Commodity = typeof commodities.$inferSelect;
export type InsertCommodity = z.infer<typeof insertCommoditySchema>;

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

export type VerificationDocument = typeof verificationDocuments.$inferSelect;
export type InsertVerificationDocument = z.infer<typeof insertVerificationDocumentSchema>;

export type PartnerRelation = typeof partnerRelations.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
