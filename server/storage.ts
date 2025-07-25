import {
  users,
  commodities,
  offers,
  contracts,
  verificationDocuments,
  partnerRelations,
  activityLogs,
  type User,
  type UpsertUser,
  type Commodity,
  type InsertCommodity,
  type Offer,
  type InsertOffer,
  type Contract,
  type InsertContract,
  type VerificationDocument,
  type InsertVerificationDocument,
  type PartnerRelation,
  type ActivityLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Commodity operations
  getCommodities(): Promise<Commodity[]>;
  getCommodityById(id: string): Promise<Commodity | undefined>;
  createCommodity(commodity: InsertCommodity): Promise<Commodity>;
  
  // Offer operations
  getOffers(userId?: string): Promise<(Offer & { commodity: Commodity; user: User })[]>;
  getOfferById(id: string): Promise<(Offer & { commodity: Commodity; user: User }) | undefined>;
  createOffer(userId: string, offer: InsertOffer): Promise<Offer>;
  updateOfferStatus(id: string, status: string): Promise<void>;
  searchOffers(query: string, category?: string): Promise<(Offer & { commodity: Commodity; user: User })[]>;
  
  // Contract operations
  getContracts(userId?: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User })[]>;
  getContractById(id: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User }) | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContractStatus(id: string, status: string): Promise<void>;
  
  // Verification operations
  getVerificationDocuments(userId: string): Promise<VerificationDocument[]>;
  createVerificationDocument(userId: string, document: InsertVerificationDocument): Promise<VerificationDocument>;
  updateVerificationStatus(id: string, status: string, aiResult?: any, notes?: string): Promise<void>;
  getPendingVerifications(): Promise<(VerificationDocument & { user: User })[]>;
  
  // Partner operations
  getPartnerRelations(userId: string): Promise<(PartnerRelation & { requester: User; partner: User })[]>;
  createPartnerRelation(requesterId: string, partnerId: string, notes?: string): Promise<PartnerRelation>;
  updatePartnerRelationStatus(id: string, status: string): Promise<void>;
  
  // Activity operations
  getRecentActivity(userId: string, limit?: number): Promise<ActivityLog[]>;
  logActivity(userId: string, action: string, entityType?: string, entityId?: string, details?: any): Promise<void>;
  
  // Dashboard metrics
  getDashboardMetrics(userId: string): Promise<{
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
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

  // Commodity operations
  async getCommodities(): Promise<Commodity[]> {
    return await db.select().from(commodities).orderBy(commodities.name);
  }

  async getCommodityById(id: string): Promise<Commodity | undefined> {
    const [commodity] = await db.select().from(commodities).where(eq(commodities.id, id));
    return commodity;
  }

  async createCommodity(commodity: InsertCommodity): Promise<Commodity> {
    const [created] = await db.insert(commodities).values(commodity).returning();
    return created;
  }

  // Offer operations
  async getOffers(userId?: string): Promise<(Offer & { commodity: Commodity; user: User })[]> {
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

  async createOffer(userId: string, offer: InsertOffer): Promise<Offer> {
    const [created] = await db.insert(offers).values({ ...offer, userId }).returning();
    
    await this.logActivity(userId, "create_offer", "offer", created.id);
    
    return created;
  }

  async updateOfferStatus(id: string, status: any): Promise<void> {
    await db.update(offers).set({ status, updatedAt: new Date() }).where(eq(offers.id, id));
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

  async createContract(contract: InsertContract): Promise<Contract> {
    const [created] = await db.insert(contracts).values(contract).returning();
    
    await this.logActivity(contract.buyerId, "create_contract", "contract", created.id);
    
    return created;
  }

  async updateContractStatus(id: string, status: any): Promise<void> {
    await db.update(contracts).set({ status, updatedAt: new Date() }).where(eq(contracts.id, id));
  }

  // Verification operations
  async getVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    return await db
      .select()
      .from(verificationDocuments)
      .where(eq(verificationDocuments.userId, userId))
      .orderBy(desc(verificationDocuments.uploadedAt));
  }

  async createVerificationDocument(userId: string, document: InsertVerificationDocument): Promise<VerificationDocument> {
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
      .where(eq(verificationDocuments.status, "pending"))
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

  async updatePartnerRelationStatus(id: string, status: string): Promise<void> {
    await db.update(partnerRelations).set({ status, updatedAt: new Date() }).where(eq(partnerRelations.id, id));
  }

  // Activity operations
  async getRecentActivity(userId: string, limit = 10): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async logActivity(userId: string, action: string, entityType?: string, entityId?: string, details?: any): Promise<void> {
    await db.insert(activityLogs).values({
      userId,
      action,
      entityType,
      entityId,
      details,
    });
  }

  // Dashboard metrics
  async getDashboardMetrics(userId: string): Promise<{
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  }> {
    const [activeOffersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(offers)
      .where(and(eq(offers.userId, userId), eq(offers.status, "active")));

    const [pendingContractsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contracts)
      .where(and(
        or(eq(contracts.buyerId, userId), eq(contracts.sellerId, userId)),
        eq(contracts.status, "pending_approval")
      ));

    const [verificationQueueResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(verificationDocuments)
      .where(and(eq(verificationDocuments.userId, userId), eq(verificationDocuments.status, "pending")));

    const [totalVolumeResult] = await db
      .select({ total: sql<string>`sum(total_price)` })
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
}

export const storage = new DatabaseStorage();
