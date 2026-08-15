import { sql } from 'drizzle-orm';
import {
  check,
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
  uniqueIndex,
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
  passwordHash: text("password_hash"),
  authProvider: varchar("auth_provider"),
  emailVerifiedAt: timestamp("email_verified_at"),
  lastLoginAt: timestamp("last_login_at"),
  loginEnabled: boolean("login_enabled"),
  credentialStatus: varchar("credential_status", {
    enum: ["active", "revoked"],
  }),
  recoveryProvenance: varchar("recovery_provenance"),
  companyName: varchar("company_name"),
  role: varchar("role").default("trader"),
  financialRating: decimal("financial_rating", { precision: 3, scale: 1 }).default("0"),
  creditRating: varchar("credit_rating").default("unrated"),
  verified: boolean("verified").default(false),
  
  // KYB fields
  kybStatus: varchar("kyb_status", { enum: ['pending', 'in_review', 'verified', 'enhanced', 'rejected'] }).default('pending'),
  verificationLevel: varchar("verification_level", { enum: ['unverified', 'basic', 'enhanced'] }).default('unverified'),
  businessRegistrationStatus: varchar("business_registration_status", { enum: ['pending', 'uploaded', 'verified', 'rejected'] }).default('pending'),
  taxCertificateStatus: varchar("tax_certificate_status", { enum: ['pending', 'uploaded', 'verified', 'rejected'] }).default('pending'),
  bankStatementStatus: varchar("bank_statement_status", { enum: ['pending', 'uploaded', 'verified', 'rejected'] }).default('pending'),
  identityVerificationStatus: varchar("identity_verification_status", { enum: ['pending', 'uploaded', 'verified', 'rejected'] }).default('pending'),
  
  // Admin Role (for admin access)
  adminRole: varchar("admin_role", { enum: ['admin', 'compliance', 'ops', 'support', 'auditor'] }),
  is2FAEnabled: boolean("is_2fa_enabled").default(false),
  
  // Plan and subscription
  currentPlan: varchar("current_plan", { enum: ['freemium', 'professional', 'enterprise'] }).default('freemium'),
  planStatus: varchar("plan_status", { enum: ['active', 'cancelled', 'past_due', 'suspended'] }).default('active'),
  subscriptionId: varchar("subscription_id"),
  billingCycle: varchar("billing_cycle", { enum: ['monthly', 'annual'] }).default('monthly'),
  nextBillingDate: timestamp("next_billing_date"),
  
  // Usage tracking
  contractsThisMonth: integer("contracts_this_month").default(0),
  documentsUploaded: integer("documents_uploaded").default(0),
  partnersConnected: integer("partners_connected").default(0),
  
  // User preferences (stored in HttpOnly cookies, not localStorage)
  language: varchar("language").default('en'),
  timezone: varchar("timezone").default('UTC'),
  currency: varchar("currency").default('USD'),
  notifications: jsonb("notifications").default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_verification_tokens_digest_unique").on(
      table.tokenDigest,
    ),
    index("email_verification_tokens_user_idx").on(table.userId),
    check(
      "email_verification_tokens_digest_check",
      sql`${table.tokenDigest} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

export const commodityTypeEnum = pgEnum("commodity_type", [
  "fuel_hydrocarbons",
  "metals_precious",
  "agricultural"
]);

export const offerTypeEnum = pgEnum("offer_type", ["buy", "sell"]);
export const offerStatusEnum = pgEnum("offer_status", ["active", "pending", "closed", "cancelled", "draft", "submitted", "verified", "hidden", "archived"]);

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
  verified: boolean("verified").default(false),
  validUntil: timestamp("valid_until"),
  // REQUIRED: Min Order Quantity - must be > 0 and <= quantity
  minOrderQty: decimal("min_quantity", { precision: 15, scale: 2 }),
  deliveryTerms: text("delivery_terms"),
  paymentTerms: text("payment_terms"),
  specifications: text("specifications"),
  deliveryOptions: text("delivery_options"),
  // Seller Organization Info - REQUIRED for B2B
  sellerOrgId: varchar("seller_org_id", { length: 255 }),
  sellerOrgName: varchar("seller_org_name", { length: 255 }),
  sellerOrgVerified: boolean("seller_org_verified").default(false),
  sellerOrgRating: decimal("seller_org_rating", { precision: 3, scale: 2 }),
  // Delegate (user who posted) Info - REQUIRED 
  delegateId: varchar("delegate_id", { length: 255 }),
  delegateFullName: varchar("delegate_full_name", { length: 255 }),
  delegateRoleTitle: varchar("delegate_role_title", { length: 255 }),
  delegateIsAuthorized: boolean("delegate_is_authorized").notNull().default(true),
  // Bar Specification for Metals - Optional
  barSpec: jsonb("bar_spec"),
  // Packaging Specification for Agricultural - Optional
  packaging: jsonb("packaging"),
  // Admin moderation fields
  moderationStatus: varchar("moderation_status", { enum: ['active', 'hidden', 'archived'] }).default('active'),
  moderationReason: text("moderation_reason"),
  moderatedBy: varchar("moderated_by"),
  moderatedAt: timestamp("moderated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const offerVerifications = pgTable("offer_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  offerId: varchar("offer_id").notNull().references(() => offers.id),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  documents: text("documents").notNull(),
  notes: text("notes"),
  status: varchar("status", { enum: ["pending"] }).notNull().default("pending"),
  submittedAt: timestamp("submitted_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("offer_verifications_offer_idx").on(table.offerId),
  index("offer_verifications_submitter_idx").on(table.submittedBy),
]);

// Audit Log Table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  userRole: varchar("user_role"),
  action: varchar("action").notNull(),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  reason: text("reason"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("audit_user_idx").on(table.userId),
  index("audit_entity_idx").on(table.entityType, table.entityId),
  index("audit_timestamp_idx").on(table.timestamp),
]);

// Temporary Document Links Table  
export const temporaryDocumentLinks = pgTable("temp_doc_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(),
  createdBy: varchar("created_by").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  accessCount: integer("access_count").default(0),
  maxAccess: integer("max_access").default(1),
  ipWhitelist: text("ip_whitelist"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("temp_doc_token_idx").on(table.token),
  index("temp_doc_expires_idx").on(table.expiresAt),
]);

// Continue with the rest of the existing schema...
export const contractStatusEnum = pgEnum("contract_status", ["draft", "pending", "active", "completed", "cancelled"]);

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  offerId: varchar("offer_id").notNull().references(() => offers.id),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  status: contractStatusEnum("status").default("draft"),
  smartContractAddress: varchar("smart_contract_address"),
  smartContractStatus: varchar("smart_contract_status"),
  escrowAddress: varchar("escrow_address"),
  deliveryDate: timestamp("delivery_date"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  specifications: text("specifications"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentTypeEnum = pgEnum("document_type", [
  "business_registration",
  "tax_certificate", 
  "bank_statement",
  "identity_verification",
  "commodity_certificate",
  "quality_report",
  "shipping_document",
  "insurance_policy",
  "other"
]);

export const verificationDocuments = pgTable("verification_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  documentType: documentTypeEnum("document_type").notNull(),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  s3Key: varchar("s3_key").notNull(),
  s3Bucket: varchar("s3_bucket").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verificationStatus: varchar("verification_status", { enum: ['pending', 'verified', 'rejected'] }).default('pending'),
  verifiedBy: varchar("verified_by"),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  metadata: jsonb("metadata"),
});

export const interestedOffers = pgTable("interested_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  offerId: varchar("offer_id").notNull().references(() => offers.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message"),
  proposedQuantity: decimal("proposed_quantity", { precision: 15, scale: 2 }),
  proposedPrice: decimal("proposed_price", { precision: 15, scale: 2 }),
  status: varchar("status", { enum: ['pending', 'accepted', 'rejected'] }).default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const partnerRelations = pgTable("partner_relations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  partnerId: varchar("partner_id").notNull().references(() => users.id),
  status: varchar("status", {
    enum: ["pending", "approved", "rejected"],
  }).notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("partner_relations_requester_idx").on(table.requesterId),
  index("partner_relations_partner_idx").on(table.partnerId),
  check("partner_relations_no_self", sql`${table.requesterId} <> ${table.partnerId}`),
  uniqueIndex("partner_relations_active_pair_unique")
    .on(
      sql`LEAST(${table.requesterId}, ${table.partnerId})`,
      sql`GREATEST(${table.requesterId}, ${table.partnerId})`,
    )
    .where(sql`${table.status} IN ('pending', 'approved')`),
]);

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  buyerId: varchar("buyer_id").notNull().references(() => users.id),
  sellerId: varchar("seller_id").notNull().references(() => users.id),
  commodity: varchar("commodity").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  unit: varchar("unit").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  status: varchar("status", { 
    enum: ['created', 'payment_pending', 'paid', 'in_transit', 'delivered', 'completed', 'cancelled', 'disputed'] 
  }).default('created'),
  paymentStatus: varchar("payment_status", { 
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'] 
  }).default('pending'),
  paymentIntentId: varchar("payment_intent_id"),
  escrowStatus: varchar("escrow_status", { 
    enum: ['pending', 'funded', 'released', 'disputed'] 
  }).default('pending'),
  trackingNumber: varchar("tracking_number"),
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export interface PerformanceInsightSummary {
  totalTrades: number;
  totalVolume: string;
  successRate: number;
  riskScore: number;
}

export interface PerformanceInsightItem {
  id: string;
  type: "trend" | "opportunity" | "risk" | "recommendation";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  confidence: number;
  category: string;
  actionable: boolean;
  metric?: {
    value: string | number;
    change?: number;
    unit?: string;
  };
}

export const performanceInsightsReports = pgTable("performance_insights_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  summary: jsonb("summary").$type<PerformanceInsightSummary>().notNull(),
  insights: jsonb("insights").$type<PerformanceInsightItem[]>().notNull(),
  recommendations: jsonb("recommendations").$type<string[]>().notNull(),
  riskFactors: jsonb("risk_factors").$type<string[]>().notNull(),
  opportunities: jsonb("opportunities").$type<string[]>().notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
}, (table) => [
  index("performance_insights_user_generated_idx").on(table.userId, table.generatedAt),
]);

export const organizationVerificationPersistenceStreams = pgTable(
  "organization_verification_persistence_streams",
  {
    streamIdentityFingerprint: varchar("stream_identity_fingerprint").primaryKey(),
    workflowExecutionId: varchar("workflow_execution_id").notNull(),
    organizationId: varchar("organization_id").notNull(),
    recordId: varchar("record_id").notNull(),
    revisionId: varchar("revision_id").notNull(),
    attemptId: varchar("attempt_id").notNull(),
    currentStreamVersion: integer("current_stream_version").notNull().default(0),
    headEvidenceEntryId: varchar("head_evidence_entry_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    creationFingerprint: varchar("creation_fingerprint").notNull(),
  },
  (table) => [
    uniqueIndex("organization_verification_stream_workflow_unique").on(
      table.workflowExecutionId,
    ),
    check(
      "organization_verification_stream_version_check",
      sql`${table.currentStreamVersion} >= 0`,
    ),
    check(
      "organization_verification_stream_head_check",
      sql`(${table.currentStreamVersion} = 0 AND ${table.headEvidenceEntryId} IS NULL) OR (${table.currentStreamVersion} > 0 AND ${table.headEvidenceEntryId} IS NOT NULL)`,
    ),
    check(
      "organization_verification_stream_fingerprint_check",
      sql`${table.streamIdentityFingerprint} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
    check(
      "organization_verification_stream_creation_fingerprint_check",
      sql`${table.creationFingerprint} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
  ],
);

export const organizationVerificationPersistenceAppends = pgTable(
  "organization_verification_persistence_appends",
  {
    appendId: varchar("append_id").primaryKey(),
    streamIdentityFingerprint: varchar("stream_identity_fingerprint")
      .notNull()
      .references(
        () => organizationVerificationPersistenceStreams.streamIdentityFingerprint,
        { onDelete: "restrict" },
      ),
    appendBatchFingerprint: varchar("append_batch_fingerprint").notNull(),
    expectedStreamVersion: integer("expected_stream_version").notNull(),
    resultingStreamVersion: integer("resulting_stream_version").notNull(),
    expectedHeadEvidenceEntryId: varchar("expected_head_evidence_entry_id"),
    resultingHeadEvidenceEntryId: varchar("resulting_head_evidence_entry_id").notNull(),
    appendedAt: timestamp("appended_at", { withTimezone: true, mode: "string" }).notNull(),
    appendedAtValue: text("appended_at_value").notNull(),
    provenanceReferences: jsonb("provenance_references").$type<string[]>().notNull(),
    integrityReferences: jsonb("integrity_references").$type<string[]>().notNull(),
    appendReceiptFingerprint: varchar("append_receipt_fingerprint").notNull(),
  },
  (table) => [
    uniqueIndex("organization_verification_append_stream_version_unique").on(
      table.streamIdentityFingerprint,
      table.resultingStreamVersion,
    ),
    index("organization_verification_appends_stream_idx").on(
      table.streamIdentityFingerprint,
      table.resultingStreamVersion,
    ),
    check(
      "organization_verification_append_versions_check",
      sql`${table.expectedStreamVersion} >= 0 AND ${table.resultingStreamVersion} > ${table.expectedStreamVersion}`,
    ),
    check(
      "organization_verification_append_expected_head_check",
      sql`(${table.expectedStreamVersion} = 0 AND ${table.expectedHeadEvidenceEntryId} IS NULL) OR (${table.expectedStreamVersion} > 0 AND ${table.expectedHeadEvidenceEntryId} IS NOT NULL)`,
    ),
    check(
      "organization_verification_append_batch_fingerprint_check",
      sql`${table.appendBatchFingerprint} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
    check(
      "organization_verification_append_timestamp_value_check",
      sql`length(${table.appendedAtValue}) > 0`,
    ),
    check(
      "organization_verification_append_receipt_fingerprint_check",
      sql`${table.appendReceiptFingerprint} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
  ],
);

export const organizationVerificationDurableEvidence = pgTable(
  "organization_verification_durable_evidence",
  {
    evidenceEntryId: varchar("evidence_entry_id").primaryKey(),
    streamIdentityFingerprint: varchar("stream_identity_fingerprint")
      .notNull()
      .references(
        () => organizationVerificationPersistenceStreams.streamIdentityFingerprint,
        { onDelete: "restrict" },
      ),
    streamPosition: integer("stream_position").notNull(),
    predecessorEvidenceEntryId: varchar("predecessor_evidence_entry_id"),
    appendId: varchar("append_id")
      .notNull()
      .references(() => organizationVerificationPersistenceAppends.appendId, {
        onDelete: "restrict",
      }),
    evidenceKind: varchar("evidence_kind").notNull(),
    semanticArtifactIdentity: varchar("semantic_artifact_identity").notNull(),
    artifactVersionKind: varchar("artifact_version_kind", {
      enum: ["number", "string"],
    }).notNull(),
    artifactVersionOrSequence: varchar("artifact_version_or_sequence").notNull(),
    artifactFingerprint: varchar("artifact_fingerprint").notNull(),
    artifactOccurredAt: timestamp("artifact_occurred_at", { withTimezone: true, mode: "string" }).notNull(),
    appendedAt: timestamp("appended_at", { withTimezone: true, mode: "string" }).notNull(),
    provenanceReferences: jsonb("provenance_references").$type<string[]>().notNull(),
    integrityReferences: jsonb("integrity_references").$type<string[]>().notNull(),
    storedEvidenceFingerprint: varchar("stored_evidence_fingerprint").notNull(),
    durableContractVersion: varchar("durable_contract_version").notNull(),
    durablePayloadFingerprint: varchar("durable_payload_fingerprint").notNull(),
    canonicalDurableEnvelope: text("canonical_durable_envelope").notNull(),
  },
  (table) => [
    uniqueIndex("organization_verification_evidence_stream_position_unique").on(
      table.streamIdentityFingerprint,
      table.streamPosition,
    ),
    uniqueIndex("organization_verification_evidence_semantic_unique").on(
      table.streamIdentityFingerprint,
      table.evidenceKind,
      table.semanticArtifactIdentity,
      table.artifactVersionKind,
      table.artifactVersionOrSequence,
    ),
    index("organization_verification_evidence_stream_order_idx").on(
      table.streamIdentityFingerprint,
      table.streamPosition,
    ),
    index("organization_verification_evidence_append_idx").on(table.appendId),
    check(
      "organization_verification_evidence_position_check",
      sql`${table.streamPosition} > 0`,
    ),
    check(
      "organization_verification_evidence_predecessor_check",
      sql`(${table.streamPosition} = 1 AND ${table.predecessorEvidenceEntryId} IS NULL) OR (${table.streamPosition} > 1 AND ${table.predecessorEvidenceEntryId} IS NOT NULL)`,
    ),
    check(
      "organization_verification_evidence_kind_check",
      sql`${table.evidenceKind} IN ('workflow_genesis', 'attempt_lifecycle_execution', 'evidence_snapshot', 'evaluation_projection', 'policy_evaluation_input', 'policy_runtime_execution', 'decision_trust_integration_execution', 'workflow_step_record')`,
    ),
    check(
      "organization_verification_evidence_version_kind_check",
      sql`${table.artifactVersionKind} IN ('number', 'string')`,
    ),
    check(
      "organization_verification_evidence_contract_check",
      sql`${table.durableContractVersion} = 'organization-verification-durable-evidence/v1'`,
    ),
    check(
      "organization_verification_evidence_artifact_fingerprint_check",
      sql`${table.artifactFingerprint} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
    check(
      "organization_verification_evidence_stored_fingerprint_check",
      sql`${table.storedEvidenceFingerprint} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
    check(
      "organization_verification_evidence_payload_fingerprint_check",
      sql`${table.durablePayloadFingerprint} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
  ],
);

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerificationDocumentSchema = createInsertSchema(verificationDocuments).omit({
  id: true,
  uploadedAt: true,
});

export const insertCommoditySchema = createInsertSchema(commodities).omit({
  id: true,
  createdAt: true,
});

export const insertInterestedOfferSchema = createInsertSchema(interestedOffers).omit({
  id: true,
  createdAt: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = z.infer<typeof insertUserSchema>;
export type Offer = typeof offers.$inferSelect;
export type NewOffer = z.infer<typeof insertOfferSchema>;
export type OfferVerification = typeof offerVerifications.$inferSelect;
export type NewOfferVerification = typeof offerVerifications.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = z.infer<typeof insertContractSchema>;
export type VerificationDocument = typeof verificationDocuments.$inferSelect;
export type NewVerificationDocument = z.infer<typeof insertVerificationDocumentSchema>;
export type Commodity = typeof commodities.$inferSelect;
export type NewCommodity = z.infer<typeof insertCommoditySchema>;
export type InterestedOffer = typeof interestedOffers.$inferSelect;
export type NewInterestedOffer = z.infer<typeof insertInterestedOfferSchema>;
export type PartnerRelation = typeof partnerRelations.$inferSelect;
export type NewPartnerRelation = typeof partnerRelations.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type PerformanceInsightsReport = typeof performanceInsightsReports.$inferSelect;
export type NewPerformanceInsightsReport = typeof performanceInsightsReports.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ActivityLog = typeof auditLogs.$inferSelect; // Use audit logs as activity logs
export type TemporaryDocumentLink = typeof temporaryDocumentLinks.$inferSelect;
