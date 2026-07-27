import {
  users,
  commodities,
  offers,
  offerVerifications,
  orders,
  contracts,
  verificationDocuments,
  interestedOffers,
  partnerRelations,
  performanceInsightsReports,
  auditLogs,
  temporaryDocumentLinks,
  type User,
  type NewUser,
  type Commodity,
  type NewCommodity,
  type Offer,
  type NewOffer,
  type OfferVerification,
  type NewOfferVerification,
  type Order,
  type Contract,
  type NewContract,
  type VerificationDocument,
  type NewVerificationDocument,
  type InterestedOffer,
  type NewInterestedOffer,
  type PartnerRelation,
  type PerformanceInsightsReport,
  type NewPerformanceInsightsReport,
  type AuditLog,
  type ActivityLog,
  type TemporaryDocumentLink,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import type { AuthenticationIdentity } from "@shared/auth";

type UpsertUser = Partial<NewUser> & { id: string };
type InsertOrder = typeof orders.$inferInsert;
type PartnerRelationStatus = NonNullable<PartnerRelation["status"]>;

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAuthenticationUser(id: string): Promise<AuthenticationIdentity | undefined>;
  getAuthenticationUserByEmail(email: string): Promise<AuthenticationIdentity | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateLastLogin(userId: string): Promise<void>;
  updateUserPreferences(userId: string, preferences: {
    language?: string;
    timezone?: string;
    notifications?: any;
    currency?: string;
  }): Promise<User>;
  
  // Commodity operations
  getCommodities(): Promise<Commodity[]>;
  getCommodityById(id: string): Promise<Commodity | undefined>;
  createCommodity(commodity: NewCommodity): Promise<Commodity>;
  
  // Offer operations
  getOffers(userId?: string, includeHidden?: boolean): Promise<(Offer & { commodity: Commodity; user: User })[]>;
  getOfferById(id: string): Promise<(Offer & { commodity: Commodity; user: User }) | undefined>;
  createOffer(userId: string, offer: NewOffer): Promise<Offer>;
  updateOfferStatus(id: string, status: string): Promise<void>;
  searchOffers(query: string, category?: string): Promise<(Offer & { commodity: Commodity; user: User })[]>;
  
  // Order operations
  getOrders(userId?: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<void>;
  
  // Contract operations
  getContracts(userId?: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User })[]>;
  getContractById(id: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User }) | undefined>;
  createContract(contract: NewContract): Promise<Contract>;
  updateContractStatus(id: string, status: string): Promise<void>;
  updateContractSmartContract(
    id: string,
    smartContractAddress: Contract["smartContractAddress"],
    smartContractStatus: Contract["smartContractStatus"],
  ): Promise<void>;
  
  // Verification operations
  getVerificationDocuments(userId: string): Promise<VerificationDocument[]>;
  createVerificationDocument(userId: string, document: NewVerificationDocument): Promise<VerificationDocument>;
  updateVerificationStatus(id: string, status: string, aiResult?: any, notes?: string): Promise<void>;
  getPendingVerifications(): Promise<(VerificationDocument & { user: User })[]>;
  
  // Partner operations
  getPartnerRelations(userId: string): Promise<(PartnerRelation & { requester: User; partner: User })[]>;
  createPartnerRelation(requesterId: string, partnerId: string, notes?: string): Promise<PartnerRelation>;
  updatePartnerRelationStatus(id: string, status: PartnerRelationStatus): Promise<void>;
  
  // Activity operations
  getRecentActivity(userId: string, limit?: number): Promise<ActivityLog[]>;
  logActivity(userId: string, action: string, entityType?: string, entityId?: string, details?: any): Promise<void>;
  
  // Interested offers operations
  getUserInterestedOffers(userId: string): Promise<(InterestedOffer & { offer: Offer & { commodity: Commodity; user: User } })[]>;
  addInterestedOffer(userId: string, offerId: string): Promise<InterestedOffer>;
  removeInterestedOffer(userId: string, offerId: string): Promise<void>;
  isOfferInterested(userId: string, offerId: string): Promise<boolean>;

  // Offer verification operations
  createOfferVerification(verification: {
    offerId: NewOfferVerification["offerId"];
    submittedBy: NewOfferVerification["submittedBy"];
    documents: NewOfferVerification["documents"];
    notes: NewOfferVerification["notes"];
    status: NewOfferVerification["status"];
    submittedAt: NewOfferVerification["submittedAt"];
  }): Promise<OfferVerification>;
  
  // Dashboard metrics
  getDashboardMetrics(userId: string): Promise<{
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  }>;
  
  // Performance Insights operations
  getLatestInsightsReport(userId: string): Promise<PerformanceInsightsReport | undefined>;
  createInsightsReport(report: Pick<
    NewPerformanceInsightsReport,
    "userId" | "summary" | "insights" | "recommendations" | "riskFactors" | "opportunities" | "generatedAt"
  >): Promise<PerformanceInsightsReport>;
}

// MemStorage was inactive and is preserved in archive/legacy/server-mem-storage.ts.disabled.

// export const storage = new MemStorage(); // Using DatabaseStorage instead

export class DatabaseStorage implements IStorage {
  // Order operations
  async getOrders(userId?: string): Promise<Order[]> {
    if (userId) {
      return await db
        .select()
        .from(orders)
        .where(or(eq(orders.buyerId, userId), eq(orders.sellerId, userId)));
    }
    return await db.select().from(orders);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    await db.update(orders).set({ status: status as any, updatedAt: new Date() }).where(eq(orders.id, id));
  }
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    return user;
  }

  private authenticationProjection() {
    return {
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      authProvider: users.authProvider,
      lastLoginAt: users.lastLoginAt,
      loginEnabled: users.loginEnabled,
      credentialStatus: users.credentialStatus,
      recoveryProvenance: users.recoveryProvenance,
      role: users.role,
    };
  }

  async getAuthenticationUser(
    id: string,
  ): Promise<AuthenticationIdentity | undefined> {
    const [user] = await db
      .select(this.authenticationProjection())
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async getAuthenticationUserByEmail(
    email: string,
  ): Promise<AuthenticationIdentity | undefined> {
    const [user] = await db
      .select(this.authenticationProjection())
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()));
    return user;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPreferences(userId: string, preferences: {
    language?: string;
    timezone?: string;
    notifications?: any;
    currency?: string;
  }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Commodity operations
  async getCommodities(): Promise<Commodity[]> {
    return await db.select().from(commodities).orderBy(commodities.name);
  }

  async getCommodityById(id: string): Promise<Commodity | undefined> {
    const [commodity] = await db.select().from(commodities).where(eq(commodities.id, id));
    return commodity;
  }

  async createCommodity(commodity: NewCommodity): Promise<Commodity> {
    const [created] = await db.insert(commodities).values(commodity).returning();
    return created;
  }

  // Offer operations
  async getOffers(userId?: string, _includeHidden?: boolean): Promise<(Offer & { commodity: Commodity; user: User })[]> {
    const baseQuery = db
      .select()
      .from(offers)
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .leftJoin(users, eq(offers.userId, users.id))
      .orderBy(desc(offers.createdAt));

    const results = userId 
      ? await baseQuery.where(eq(offers.userId, userId))
      : await baseQuery;
    
    return results.map(row => ({
      ...row.offers,
      commodity: row.commodities!,
      user: row.users!,
    }));
  }

  async getOfferById(id: string): Promise<(Offer & { commodity: Commodity; user: User }) | undefined> {
    const [result] = await db
      .select()
      .from(offers)
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .leftJoin(users, eq(offers.userId, users.id))
      .where(eq(offers.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.offers,
      commodity: result.commodities!,
      user: result.users!,
    };
  }

  async createOffer(userId: string, offer: NewOffer): Promise<Offer> {
    const [created] = await db.insert(offers).values({ ...offer, userId }).returning();
    
    await this.logActivity(userId, "create_offer", "offer", created.id);
    
    return created;
  }

  async updateOfferStatus(id: string, status: any): Promise<void> {
    await db.update(offers).set({ status, updatedAt: new Date() }).where(eq(offers.id, id));
  }

  async createOfferVerification(
    verification: Pick<
      NewOfferVerification,
      "offerId" | "submittedBy" | "documents" | "notes" | "status" | "submittedAt"
    >,
  ): Promise<OfferVerification> {
    const [created] = await db
      .insert(offerVerifications)
      .values(verification)
      .returning();

    return created;
  }

  async searchOffers(query: string, category?: string): Promise<(Offer & { commodity: Commodity; user: User })[]> {
    let whereConditions = [like(commodities.name, `%${query}%`)];
    
    if (category && category !== "all") {
      whereConditions.push(eq(commodities.type, category as any));
    }
    
    const whereCondition = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    const results = await db
      .select()
      .from(offers)
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .leftJoin(users, eq(offers.userId, users.id))
      .where(whereCondition)
      .orderBy(desc(offers.createdAt));
      
    return results.map(row => ({
      ...row.offers,
      commodity: row.commodities!,
      user: row.users!,
    }));
  }

  // Contract operations
  async getContracts(userId?: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User })[]> {
    // For simplicity, let's fetch contracts and then enrich them with related data
    const baseQuery = db.select().from(contracts).orderBy(desc(contracts.createdAt));
    
    const contractResults = userId
      ? await baseQuery.where(or(eq(contracts.buyerId, userId), eq(contracts.sellerId, userId)))
      : await baseQuery;
    
    // Enrich with related data
    const enrichedContracts = await Promise.all(
      contractResults.map(async (contract) => {
        const [offerResult] = await db.select().from(offers)
          .leftJoin(commodities, eq(offers.commodityId, commodities.id))
          .where(eq(offers.id, contract.offerId));
          
        const [buyer] = await db.select().from(users).where(eq(users.id, contract.buyerId));
        const [seller] = await db.select().from(users).where(eq(users.id, contract.sellerId));
        
        return {
          ...contract,
          offer: {
            ...offerResult?.offers!,
            commodity: offerResult?.commodities!,
          },
          buyer: buyer!,
          seller: seller!,
        };
      })
    );
    
    return enrichedContracts;
  }

  async getContractById(id: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User }) | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    
    if (!contract) return undefined;
    
    const [offerResult] = await db.select().from(offers)
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .where(eq(offers.id, contract.offerId));
      
    const [buyer] = await db.select().from(users).where(eq(users.id, contract.buyerId));
    const [seller] = await db.select().from(users).where(eq(users.id, contract.sellerId));
    
    return {
      ...contract,
      offer: {
        ...offerResult?.offers!,
        commodity: offerResult?.commodities!,
      },
      buyer: buyer!,
      seller: seller!,
    };
  }

  async createContract(contract: NewContract): Promise<Contract> {
    const [created] = await db.insert(contracts).values(contract).returning();
    
    await this.logActivity(contract.buyerId, "create_contract", "contract", created.id);
    
    return created;
  }

  async updateContractStatus(id: string, status: any): Promise<void> {
    await db.update(contracts).set({ status, updatedAt: new Date() }).where(eq(contracts.id, id));
  }

  async updateContractSmartContract(
    id: string,
    smartContractAddress: Contract["smartContractAddress"],
    smartContractStatus: Contract["smartContractStatus"],
  ): Promise<void> {
    await db
      .update(contracts)
      .set({ smartContractAddress, smartContractStatus, updatedAt: new Date() })
      .where(eq(contracts.id, id));
  }

  // Verification operations
  async getVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    return await db
      .select()
      .from(verificationDocuments)
      .where(eq(verificationDocuments.userId, userId))
      .orderBy(desc(verificationDocuments.uploadedAt));
  }

  async createVerificationDocument(userId: string, document: NewVerificationDocument): Promise<VerificationDocument> {
    const [created] = await db
      .insert(verificationDocuments)
      .values({ ...document, userId })
      .returning();
    
    await this.logActivity(userId, "upload_document", "verification_document", created.id);
    
    return created;
  }

  async updateVerificationStatus(id: string, status: string, aiResult?: any, notes?: string): Promise<void> {
    const updateData: any = { status, reviewedAt: new Date() };
    
    if (aiResult) updateData.aiValidationResult = aiResult;
    if (notes) updateData.reviewNotes = notes;
    
    await db.update(verificationDocuments).set(updateData).where(eq(verificationDocuments.id, id));
  }

  async getPendingVerifications(): Promise<(VerificationDocument & { user: User })[]> {
    const results = await db
      .select()
      .from(verificationDocuments)
      .leftJoin(users, eq(verificationDocuments.userId, users.id))
      .where(eq(verificationDocuments.verificationStatus, "pending"))
      .orderBy(verificationDocuments.uploadedAt);
      
    return results.map(row => ({
      ...row.verification_documents,
      user: row.users!,
    }));
  }

  // Partner operations
  async getPartnerRelations(userId: string): Promise<(PartnerRelation & { requester: User; partner: User })[]> {
    const relations = await db
      .select()
      .from(partnerRelations)
      .where(or(eq(partnerRelations.requesterId, userId), eq(partnerRelations.partnerId, userId)))
      .orderBy(desc(partnerRelations.createdAt));
      
    const enrichedRelations = await Promise.all(
      relations.map(async (relation) => {
        const [requester] = await db.select().from(users).where(eq(users.id, relation.requesterId));
        const [partner] = await db.select().from(users).where(eq(users.id, relation.partnerId));
        
        return {
          ...relation,
          requester: requester!,
          partner: partner!,
        };
      })
    );
    
    return enrichedRelations;
  }

  async createPartnerRelation(requesterId: string, partnerId: string, notes?: string): Promise<PartnerRelation> {
    const [created] = await db
      .insert(partnerRelations)
      .values({ requesterId, partnerId, notes })
      .returning();
    
    await this.logActivity(requesterId, "request_partnership", "partner_relation", created.id);
    
    return created;
  }

  async updatePartnerRelationStatus(id: string, status: PartnerRelationStatus): Promise<void> {
    await db.update(partnerRelations).set({ status, updatedAt: new Date() }).where(eq(partnerRelations.id, id));
  }

  // Activity operations
  async getRecentActivity(userId: string, limit = 10): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  async logActivity(userId: string, action: string, entityType?: string, entityId?: string, details?: any): Promise<void> {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType: entityType || 'activity',
      entityId: entityId || userId,
      afterValue: details,
    });
  }

  // Interested offers operations
  async getUserInterestedOffers(userId: string): Promise<(InterestedOffer & { offer: Offer & { commodity: Commodity; user: User } })[]> {
    const results = await db
      .select()
      .from(interestedOffers)
      .leftJoin(offers, eq(interestedOffers.offerId, offers.id))
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .leftJoin(users, eq(offers.userId, users.id))
      .where(eq(interestedOffers.userId, userId))
      .orderBy(desc(interestedOffers.createdAt));
    
    return results.map(row => ({
      ...row.interested_offers,
      offer: {
        ...row.offers!,
        commodity: row.commodities!,
        user: row.users!,
      }
    }));
  }

  async addInterestedOffer(userId: string, offerId: string): Promise<InterestedOffer> {
    const [created] = await db
      .insert(interestedOffers)
      .values({ userId, offerId })
      .returning();
    return created;
  }

  async removeInterestedOffer(userId: string, offerId: string): Promise<void> {
    await db
      .delete(interestedOffers)
      .where(and(
        eq(interestedOffers.userId, userId),
        eq(interestedOffers.offerId, offerId)
      ));
  }

  async isOfferInterested(userId: string, offerId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(interestedOffers)
      .where(and(
        eq(interestedOffers.userId, userId),
        eq(interestedOffers.offerId, offerId)
      ));
    return !!result;
  }

  // Dashboard metrics
  async getDashboardMetrics(userId: string): Promise<{
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  }> {
    // Query 1: Active offers count
    const [activeOffersResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(offers)
      .where(and(eq(offers.userId, userId), eq(offers.status, "active")));

    // Query 2: Pending contracts count
    const [pendingContractsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contracts)
      .where(and(
        or(eq(contracts.buyerId, userId), eq(contracts.sellerId, userId)),
        eq(contracts.status, "draft")
      ));

    // Query 3: Verification queue count
    const [verificationQueueResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(verificationDocuments)
      .where(and(eq(verificationDocuments.userId, userId), eq(verificationDocuments.verificationStatus, "pending")));

    // Query 4: Total volume calculation
    const [totalVolumeResult] = await db
      .select({ 
        total: sql<string>`coalesce(sum((${contracts.quantity})::numeric * (${contracts.pricePerUnit})::numeric), 0)::text` 
      })
      .from(contracts)
      .where(and(
        or(eq(contracts.buyerId, userId), eq(contracts.sellerId, userId)),
        eq(contracts.status, "active")
      ));

    return {
      activeOffers: activeOffersResult?.count || 0,
      pendingContracts: pendingContractsResult?.count || 0,
      verificationQueue: verificationQueueResult?.count || 0,
      totalVolume: totalVolumeResult?.total || "0",
    };
  }

  async getLatestInsightsReport(userId: string): Promise<PerformanceInsightsReport | undefined> {
    const [report] = await db
      .select()
      .from(performanceInsightsReports)
      .where(eq(performanceInsightsReports.userId, userId))
      .orderBy(desc(performanceInsightsReports.generatedAt))
      .limit(1);

    return report;
  }

  async createInsightsReport(
    report: Pick<
      NewPerformanceInsightsReport,
      "userId" | "summary" | "insights" | "recommendations" | "riskFactors" | "opportunities" | "generatedAt"
    >,
  ): Promise<PerformanceInsightsReport> {
    const [created] = await db
      .insert(performanceInsightsReports)
      .values(report)
      .returning();

    return created;
  }

  // Admin methods
  async getAllUsers(filters?: { adminRole?: string; kybStatus?: string }): Promise<User[]> {
    let query = db.select().from(users).$dynamic();
    const conditions = [];
    
    if (filters?.adminRole) {
      conditions.push(sql`${users.adminRole} = ${filters.adminRole}`);
    }
    if (filters?.kybStatus) {
      conditions.push(sql`${users.kybStatus} = ${filters.kybStatus}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query.orderBy(desc(users.createdAt));
  }

  async updateUserAdminRole(userId: string, adminRole: User["adminRole"]): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ adminRole })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async toggleUserStatus(userId: string, enabled: boolean): Promise<User> {
    // For now, we'll use a mock field since we don't have an enabled field
    // In a real implementation, you'd add an 'enabled' or 'active' column
    const [updatedUser] = await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async resetUser2FA(userId: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ is2FAEnabled: false })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async updateKYBStatus(userId: string, kybStatus: string, verificationLevel?: string): Promise<User> {
    const updateData: any = { kybStatus, updatedAt: new Date() };
    if (verificationLevel) {
      updateData.verificationLevel = verificationLevel;
    }
    
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async moderateOffer(
    offerId: string,
    moderationStatus: NonNullable<Offer["moderationStatus"]>,
    reason?: string,
    moderatedBy?: string,
  ): Promise<Offer> {
    const [updatedOffer] = await db
      .update(offers)
      .set({
        moderationStatus,
        moderationReason: reason,
        moderatedBy,
        moderatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(offers.id, offerId))
      .returning();
    return updatedOffer;
  }

  async getMarketInsights(): Promise<{
    activeOffers: number;
    totalValue: string;
    avgPrice: string;
    topCommodities: any[];
  }> {
    const activeOffersList = await db
      .select()
      .from(offers)
      .where(and(
        eq(offers.status, 'active'),
        or(eq(offers.moderationStatus, 'active'), sql`moderation_status IS NULL`)
      ));

    const activeOffers = activeOffersList.length;
    
    // Calculate total value and average price
    let totalValue = 0;
    let totalQuantity = 0;
    for (const offer of activeOffersList) {
      const quantity = parseFloat(offer.quantity);
      const price = parseFloat(offer.pricePerUnit);
      totalValue += quantity * price;
      totalQuantity += quantity;
    }
    
    const avgPrice = totalQuantity > 0 ? (totalValue / totalQuantity).toFixed(2) : '0';
    
    // Get top commodities
    const commodityCount: Record<string, number> = {};
    for (const offer of activeOffersList) {
      commodityCount[offer.commodityId] = (commodityCount[offer.commodityId] || 0) + 1;
    }
    
    const topCommodities = Object.entries(commodityCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([commodityId, count]) => ({ name: commodityId, count }));

    return {
      activeOffers,
      totalValue: totalValue.toFixed(2),
      avgPrice,
      topCommodities
    };
  }

  async getComplianceInsights(): Promise<{
    kybPending: number;
    kybApproved: number;
    kybRejected: number;
    avgProcessingTime: number;
  }> {
    const allUsers = await db.select().from(users);
    
    const kybPending = allUsers.filter(user => user.kybStatus === 'pending' || user.kybStatus === 'in_review').length;
    const kybApproved = allUsers.filter(user => user.kybStatus === 'verified' || user.kybStatus === 'enhanced').length;
    const kybRejected = allUsers.filter(user => user.kybStatus === 'rejected').length;
    
    // Mock average processing time (in practice, you'd calculate from timestamps)
    const avgProcessingTime = 48; // hours
    
    return {
      kybPending,
      kybApproved, 
      kybRejected,
      avgProcessingTime
    };
  }

  async createAuditLog(auditLog: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const [newAuditLog] = await db
      .insert(auditLogs)
      .values({
        id: sql`gen_random_uuid()`,
        userId: auditLog.userId,
        userRole: auditLog.userRole,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        beforeValue: auditLog.beforeValue,
        afterValue: auditLog.afterValue,
        reason: auditLog.reason,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        timestamp: sql`NOW()`
      })
      .returning();
    return newAuditLog;
  }

  async getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs).$dynamic();
    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    if (filters?.startDate) {
      conditions.push(sql`timestamp >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`timestamp <= ${filters.endDate}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(auditLogs.timestamp));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    return query;
  }

  async createTemporaryDocumentLink(link: Omit<TemporaryDocumentLink, 'id' | 'createdAt'>): Promise<TemporaryDocumentLink> {
    const [newLink] = await db
      .insert(temporaryDocumentLinks)
      .values({
        id: sql`gen_random_uuid()`,
        documentId: link.documentId,
        createdBy: link.createdBy,
        token: link.token,
        expiresAt: link.expiresAt,
        accessCount: link.accessCount,
        maxAccess: link.maxAccess,
        ipWhitelist: link.ipWhitelist,
        createdAt: sql`NOW()`
      })
      .returning();
    return newLink;
  }

  async getTemporaryDocumentLink(token: string): Promise<TemporaryDocumentLink | undefined> {
    const [link] = await db
      .select()
      .from(temporaryDocumentLinks)
      .where(eq(temporaryDocumentLinks.token, token))
      .limit(1);
    return link;
  }

  async updateDocumentLinkAccess(token: string): Promise<void> {
    await db
      .update(temporaryDocumentLinks)
      .set({ 
        accessCount: sql`access_count + 1`
      })
      .where(eq(temporaryDocumentLinks.token, token));
  }

  async cleanupExpiredDocumentLinks(): Promise<void> {
    await db
      .delete(temporaryDocumentLinks)
      .where(sql`expires_at < NOW()`);
  }

  async getKYBQueue(filters?: {
    status?: NonNullable<User["kybStatus"]>;
    assignedTo?: NonNullable<User["adminRole"]>;
  }): Promise<User[]> {
    const query = db.select().from(users);
    const conditions = [
      or(
        eq(users.kybStatus, 'pending'),
        eq(users.kybStatus, 'in_review')
      )
    ];
    
    if (filters?.status) {
      conditions.push(eq(users.kybStatus, filters.status));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(users.adminRole, filters.assignedTo));
    }
    
    return query.where(and(...conditions)).orderBy(desc(users.createdAt));
  }
}

// Use DatabaseStorage for consistent data across all endpoints
export const storage = new DatabaseStorage();
