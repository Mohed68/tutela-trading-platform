import type { Express } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import {
  isAuthenticated,
  isLocallyAuthenticatable,
  setupAuth,
  toCurrentUserDto,
} from "./auth";
import { BusinessEvents } from "./monitoring";
import Stripe from "stripe";
import { requireAdminAuth, requirePermission, adminRateLimit } from "./adminAuth";
import { logAdminAction, AUDIT_ACTIONS } from "./auditLogger";
import { 
  insertOfferSchema, 
  insertContractSchema, 
  insertVerificationDocumentSchema,
  insertCommoditySchema,
  insertInterestedOfferSchema 
} from "@shared/schema";
import { validateDocument } from "./services/aiValidation";
import { createSmartContract, getContractStatus } from "./services/blockchain";
import { generatePerformanceInsights } from "./services/insightsGenerator";
import { generatePersonalizedRecommendations } from "./services/aiRecommendations";
import { seedDemoData, clearDemoData } from "./seedData";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { resolveFilters } from "./filters/publicOffers";
import { shouldRunStartupSeeding } from "./recoveryMode";
import { safeErrorMessage } from "./safeErrors";
import { canon } from "@shared/constants/units";
import {
  buildMarketplaceOptions,
  buildMarketplaceSummary,
  filterPublishedMarketplaceOffers,
  getPublishedMarketplaceOfferRecords,
  normalizePublishedOffer,
} from "./marketplace/publicMarketplace";
import { buildDashboardOverview } from "./dashboard";

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" })
  : null;

// Map plan/term -> Stripe Price ID (set env vars in Replit Secrets)
const PRICE_MAP: Record<string, string> = {
  "ma:annual": process.env.PRICE_MA_ANNUAL || "",
  "ma:monthly": process.env.PRICE_MA_MONTHLY || "",
  "td:annual": process.env.PRICE_TD_ANNUAL || "",
  "td:monthly": process.env.PRICE_TD_MONTHLY || "",
  "cs:annual": process.env.PRICE_CS_ANNUAL || "",
  "cs:monthly": process.env.PRICE_CS_MONTHLY || "",
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), environment: process.env.NODE_ENV ?? "development" });
  });


  // KYB status endpoint
  app.get('/api/auth/kyb-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        kybStatus: user.kybStatus || 'pending',
        verificationLevel: user.verificationLevel || 'unverified',
        hasCompletedKyb: user.kybStatus === 'verified',
        requiredDocuments: {
          businessRegistration: user.businessRegistrationStatus || 'pending',
          taxCertificate: user.taxCertificateStatus || 'pending',
          bankStatement: user.bankStatementStatus || 'pending',
          identityVerification: user.identityVerificationStatus || 'pending'
        }
      });
    } catch (error) {
      console.error("Error fetching KYB status:", error);
      res.status(500).json({ message: "Failed to fetch KYB status" });
    }
  });

  // Plan information endpoint
  app.get('/api/auth/plan', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        currentPlan: user.currentPlan || 'freemium',
        planStatus: user.planStatus || 'active',
        subscriptionId: user.subscriptionId,
        billingCycle: user.billingCycle || 'monthly',
        nextBillingDate: user.nextBillingDate,
        features: getPlanFeatures(user.currentPlan || 'freemium'),
        usage: {
          contractsThisMonth: user.contractsThisMonth || 0,
          documentsUploaded: user.documentsUploaded || 0,
          partnersConnected: user.partnersConnected || 0
        }
      });
    } catch (error) {
      console.error("Error fetching plan info:", error);
      res.status(500).json({ message: "Failed to fetch plan information" });
    }
  });

  // Update user preferences (non-sensitive data)
  app.patch('/api/auth/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language, timezone, notifications, currency } = req.body;
      
      const updatedUser = await storage.updateUserPreferences(userId, {
        language,
        timezone,
        notifications,
        currency
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Helper function to get plan features
  function getPlanFeatures(plan: string) {
    switch (plan) {
      case 'freemium':
        return {
          contractsPerMonth: 2,
          documentsUpload: true,
          basicSupport: true,
          advancedAnalytics: false,
          prioritySupport: false,
          customIntegrations: false
        };
      case 'professional':
        return {
          contractsPerMonth: 50,
          documentsUpload: true,
          basicSupport: true,
          advancedAnalytics: true,
          prioritySupport: true,
          customIntegrations: false
        };
      case 'enterprise':
        return {
          contractsPerMonth: -1, // unlimited
          documentsUpload: true,
          basicSupport: true,
          advancedAnalytics: true,
          prioritySupport: true,
          customIntegrations: true
        };
      default:
        return {
          contractsPerMonth: 2,
          documentsUpload: true,
          basicSupport: true,
          advancedAnalytics: false,
          prioritySupport: false,
          customIntegrations: false
        };
    }
  }

  // Stripe Checkout Session Creation
  app.post("/api/checkout/sessions", async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ error: "Stripe not configured. Please set STRIPE_SECRET_KEY." });
      }

      const { plan, term } = req.body as { plan: "ma"|"td"|"cs"; term: "annual"|"monthly" };
      const priceId = PRICE_MAP[`${plan}:${term}`];
      
      if (!priceId) {
        return res.status(400).json({ 
          error: "Invalid plan/term or missing price mapping",
          available: Object.keys(PRICE_MAP),
          requested: `${plan}:${term}`
        });
      }

      const baseUrl = process.env.APP_BASE_URL || req.get('origin') || `${req.protocol}://${req.get('host')}`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${baseUrl}/checkout/success?plan=${plan}&term=${term}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/checkout?plan=${plan}&term=${term}`,
        metadata: { plan, term },
      });

      res.json({ url: session.url });
    } catch (e: any) {
      console.error("Stripe session creation error:", e);
      res.status(500).json({ error: "stripe_session_error", details: e.message });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/overview', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const identity = userId
        ? await storage.getAuthenticationUser(userId)
        : undefined;

      if (!isLocallyAuthenticatable(identity)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [ownedOfferCount, publishedOfferCount] = await Promise.allSettled([
        storage.getDashboardOwnedOfferCount(identity.id),
        getPublishedMarketplaceOfferRecords().then((records) => records.length),
      ]);

      return res.json(
        buildDashboardOverview(
          toCurrentUserDto(identity),
          ownedOfferCount,
          publishedOfferCount,
        ),
      );
    } catch {
      return res.status(500).json({
        message: "Dashboard temporarily unavailable.",
      });
    }
  });

  app.get('/api/dashboard/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const metrics = await storage.getDashboardMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // AI Recommendations endpoint
  app.get('/api/recommendations/personalized', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recommendations = await generatePersonalizedRecommendations(userId);
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  app.get('/api/dashboard/activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const activities = await storage.getRecentActivity(userId, limit);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // Commodity routes
  app.get('/api/commodities', async (req, res) => {
    try {
      const commodities = await storage.getCommodities();
      res.json(commodities);
    } catch (error) {
      console.error(`Error fetching commodities: ${safeErrorMessage(error)}`);
      res.status(500).json({ message: "Failed to fetch commodities" });
    }
  });

  app.post('/api/commodities', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertCommoditySchema.parse(req.body);
      const commodity = await storage.createCommodity(validatedData);
      
      const userId = req.user.claims.sub;
      await storage.logActivity(userId, "create_commodity", "commodity", commodity.id);
      
      res.status(201).json(commodity);
    } catch (error) {
      console.error("Error creating commodity:", error);
      res.status(400).json({ message: "Failed to create commodity" });
    }
  });

  // Public marketplace reads use a dedicated, minimal projection. When either
  // authoritative verification field is unavailable, the repository returns
  // no rows rather than inferring trust from legacy data.
  app.get('/api/offers/summary', async (req, res) => {
    try {
      const filter = resolveFilters(req);
      const records = filterPublishedMarketplaceOffers(
        await getPublishedMarketplaceOfferRecords(),
        filter,
      );

      if (req.query.group === 'category') {
        const categories = new Map<string, typeof records>();
        for (const record of records) {
          const category = record.offer.commodity.category;
          categories.set(category, [
            ...(categories.get(category) ?? []),
            record,
          ]);
        }
        return res.json(
          Array.from(categories.entries())
            .map(([categoryKey, categoryRecords]) => ({
              category_key: categoryKey,
              offers: categoryRecords.length,
              market_value_usd:
                buildMarketplaceSummary(categoryRecords).marketValueUsd,
            }))
            .sort((left, right) =>
              left.category_key.localeCompare(right.category_key),
            ),
        );
      }

      const targetUnit = canon(req.query.targetUnit as string);
      res.json(
        buildMarketplaceSummary(
          records,
          filter.commodityKey,
          targetUnit,
        ),
      );
    } catch (error) {
      console.error(
        `Error fetching offers summary: ${safeErrorMessage(error)}`,
      );
      res.status(500).json({ message: "Failed to fetch offers summary" });
    }
  });

  app.get('/api/offers/options', async (req, res) => {
    try {
      const records = filterPublishedMarketplaceOffers(
        await getPublishedMarketplaceOfferRecords(),
        {
          category: req.query.category as string,
        },
      );
      res.json(buildMarketplaceOptions(records));
    } catch (error) {
      console.error(
        `Error fetching offer options: ${safeErrorMessage(error)}`,
      );
      res.status(500).json({ message: "Failed to fetch offer options" });
    }
  });

  app.get('/api/offers', async (req: any, res) => {
    try {
      const filter = req.query.filter;
      if (filter === 'my' || filter === 'interested') {
        if (!req.isAuthenticated() || !req.user?.claims?.sub) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const userId = req.user.claims.sub;
        if (filter === 'my') {
          return res.json(await storage.getOffers(userId));
        }
        const offers = (
          await storage.getUserInterestedOffers(userId)
        ).map((item) => item.offer);
        return res.json(offers);
      }

      const marketFilter = resolveFilters(req);
      const targetUnit = canon(req.query.normalizeUnit as string);
      const records = filterPublishedMarketplaceOffers(
        await getPublishedMarketplaceOfferRecords(),
        marketFilter,
      );
      const offers = records.map(({ offer }) =>
        normalizePublishedOffer(
          offer,
          marketFilter.commodityKey,
          targetUnit,
        ),
      );

      res.json({
        offers,
        totalCount: offers.length,
        publicationPolicy:
          "verified_offer_and_verified_seller_organization",
      });
    } catch (error) {
      console.error(`Error fetching offers: ${safeErrorMessage(error)}`);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  // Offer verification document upload endpoint
  app.post('/api/verification/upload-document', isAuthenticated, async (req: any, res) => {
    try {
      const { documentType } = req.body;
      if (!documentType) {
        return res.status(400).json({ error: "documentType is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Offer verification submission endpoint
  app.post('/api/offers/:offerId/verify', isAuthenticated, async (req: any, res) => {
    try {
      const { offerId } = req.params;
      const { documents, notes } = req.body;
      const userId = req.user.claims.sub;

      // Store verification submission
      const verification = await storage.createOfferVerification({
        offerId,
        submittedBy: userId,
        documents: JSON.stringify(documents),
        notes: notes || '',
        status: 'pending',
        submittedAt: new Date(),
      });

      // Log business event
      BusinessEvents.offerVerificationSubmitted(userId, offerId, Object.keys(documents).length);

      res.status(201).json(verification);
    } catch (error) {
      console.error("Error submitting offer verification:", error);
      res.status(500).json({ error: "Failed to submit verification" });
    }
  });

  app.get('/api/offers/search', async (req, res) => {
    try {
      const records = filterPublishedMarketplaceOffers(
        await getPublishedMarketplaceOfferRecords(),
        {
          q: (req.query.q as string) || "",
          category: req.query.category as string,
        },
      );
      const offers = records.map(({ offer }) => offer);
      res.json({
        offers,
        totalCount: offers.length,
        publicationPolicy:
          "verified_offer_and_verified_seller_organization",
      });
    } catch (error) {
      console.error(`Error searching offers: ${safeErrorMessage(error)}`);
      res.status(500).json({ message: "Failed to search offers" });
    }
  });

  app.get('/api/offers/:id', isAuthenticated, async (req, res) => {
    try {
      const offer = await storage.getOfferById(req.params.id);
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }
      res.json(offer);
    } catch (error) {
      console.error("Error fetching offer:", error);
      res.status(500).json({ message: "Failed to fetch offer" });
    }
  });

  app.post('/api/offers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Transform the data to match schema expectations
      const transformedData = {
        ...req.body,
        quantity: String(req.body.quantity || 0),
        pricePerUnit: String(req.body.pricePerUnit || req.body.price || 0),
        minQuantity: req.body.minQuantity ? String(req.body.minQuantity) : undefined,
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
      };
      
      const validatedData = insertOfferSchema.parse(transformedData);
      const offer = await storage.createOffer(userId, validatedData);
      
      // Log business event for offer creation
      BusinessEvents.offerCreated(
        userId,
        offer.id,
        offer.commodityId,
        parseFloat(offer.quantity) * parseFloat(offer.pricePerUnit),
      );
      
      // Log activity
      await storage.logActivity(userId, "create_offer", "offer", offer.id);
      
      // Automatically start verification process for marketplace readiness
      try {
        await storage.createOfferVerification({
          offerId: offer.id,
          submittedBy: userId,
          documents: JSON.stringify({}), // Empty documents initially
          notes: 'Automatic verification started after offer creation - pending document upload',
          status: 'pending',
          submittedAt: new Date(),
        });
        
        // Log verification initiation
        BusinessEvents.offerVerificationSubmitted(userId, offer.id, 0);
        await storage.logActivity(userId, "start_offer_verification", "offer", offer.id);
      } catch (verificationError) {
        console.error("Error starting automatic verification:", verificationError);
        // Don't fail the offer creation if verification fails
      }
      
      res.status(201).json(offer);
    } catch (error) {
      console.error("Error creating offer:", error);
      if (error instanceof Error && 'issues' in error) {
        console.error("Validation issues:", (error as any).issues);
      }
      res.status(400).json({ message: "Failed to create offer" });
    }
  });

  app.patch('/api/offers/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateOfferStatus(req.params.id, status);
      res.json({ message: "Offer status updated successfully" });
    } catch (error) {
      console.error("Error updating offer status:", error);
      res.status(500).json({ message: "Failed to update offer status" });
    }
  });

  // Interested offers routes
  app.get('/api/interested-offers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const interestedOffers = await storage.getUserInterestedOffers(userId);
      res.json(interestedOffers);
    } catch (error) {
      console.error("Error fetching interested offers:", error);
      res.status(500).json({ message: "Failed to fetch interested offers" });
    }
  });

  app.post('/api/interested-offers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { offerId } = req.body;
      
      // Check if already interested
      const isAlreadyInterested = await storage.isOfferInterested(userId, offerId);
      if (isAlreadyInterested) {
        return res.status(409).json({ message: "Offer already in interested list" });
      }
      
      const interestedOffer = await storage.addInterestedOffer(userId, offerId);
      await storage.logActivity(userId, "add_interested_offer", "offer", offerId);
      
      res.status(201).json(interestedOffer);
    } catch (error) {
      console.error("Error adding interested offer:", error);
      res.status(400).json({ message: "Failed to add interested offer" });
    }
  });

  app.delete('/api/interested-offers/:offerId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { offerId } = req.params;
      
      await storage.removeInterestedOffer(userId, offerId);
      await storage.logActivity(userId, "remove_interested_offer", "offer", offerId);
      
      res.json({ message: "Offer removed from interested list" });
    } catch (error) {
      console.error("Error removing interested offer:", error);
      res.status(500).json({ message: "Failed to remove interested offer" });
    }
  });

  app.get('/api/offers/:offerId/interested', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { offerId } = req.params;
      
      const isInterested = await storage.isOfferInterested(userId, offerId);
      res.json({ isInterested });
    } catch (error) {
      console.error("Error checking if offer is interested:", error);
      res.status(500).json({ message: "Failed to check interested status" });
    }
  });

  // Orders routes
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderData = { ...req.body, userId };
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(400).json({ message: "Failed to create order" });
    }
  });

  app.patch('/api/orders/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateOrderStatus(req.params.id, status);
      res.json({ message: "Order status updated successfully" });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Contract routes
  app.get('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contracts = await storage.getContracts(userId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get('/api/contracts/:id', isAuthenticated, async (req, res) => {
    try {
      const contract = await storage.getContractById(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.post('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertContractSchema.parse(req.body);
      
      // Create the contract
      const contract = await storage.createContract(validatedData);
      
      // Log contract signing event
      BusinessEvents.contractSigned(
        contract.id,
        validatedData.buyerId || userId,
        validatedData.sellerId || userId,
        parseFloat(validatedData.totalAmount),
      );
      
      // Create an explicitly simulated smart contract.
      try {
        const offer = await storage.getOfferById(contract.offerId);
        if (!offer) {
          throw new Error("Contract offer not found for simulation");
        }

        const simulation = await createSmartContract({
          buyerId: contract.buyerId,
          sellerId: contract.sellerId,
          commodity: offer.commodity.name,
          quantity: contract.quantity,
          price: contract.totalAmount,
          terms: {
            paymentTerms: contract.paymentTerms,
            deliveryTerms: contract.deliveryTerms,
            specifications: contract.specifications,
          },
        });
        await storage.updateContractSmartContract(
          contract.id,
          simulation.contractAddress,
          simulation.status,
        );
        
        res.status(201).json({ 
          ...contract,
          smartContractAddress: simulation.contractAddress,
          smartContractStatus: simulation.status,
          simulation: true,
          message: "Contract created with simulated smart-contract deployment",
        });
      } catch (blockchainError) {
        console.error("Smart-contract simulation failed:", blockchainError);
        BusinessEvents.blockchainError(contract.id, blockchainError instanceof Error ? blockchainError.message : 'Unknown blockchain error');
        res.status(201).json({ 
          ...contract,
          simulation: true,
          message: "Contract created, smart-contract simulation pending",
        });
      }
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(400).json({ message: "Failed to create contract" });
    }
  });

  app.patch('/api/contracts/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateContractStatus(req.params.id, status);
      res.json({ message: "Contract status updated successfully" });
    } catch (error) {
      console.error("Error updating contract status:", error);
      res.status(500).json({ message: "Failed to update contract status" });
    }
  });

  app.get('/api/contracts/:id/blockchain-status', isAuthenticated, async (req, res) => {
    try {
      const contract = await storage.getContractById(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      if (!contract.smartContractAddress) {
        return res.json({
          status: contract.smartContractStatus || "not_deployed",
          simulation: true,
        });
      }
      
      const blockchainStatus = await getContractStatus(contract.smartContractAddress);
      res.json(blockchainStatus);
    } catch (error) {
      console.error("Error fetching blockchain status:", error);
      res.status(500).json({ message: "Failed to fetch blockchain status" });
    }
  });

  // Verification routes
  app.get('/api/verification/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documents = await storage.getVerificationDocuments(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching verification documents:", error);
      res.status(500).json({ message: "Failed to fetch verification documents" });
    }
  });

  // Get presigned URL for KYB document upload
  app.post('/api/verification/upload-url', isAuthenticated, async (req: any, res) => {
    try {
      const { documentType } = req.body;
      
      if (!documentType) {
        return res.status(400).json({ message: "Document type is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getKYBDocumentUploadURL(documentType);
      
      res.json({ uploadURL, documentType });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Complete KYB document upload and set ACL
  app.post('/api/verification/complete-upload', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentType, fileName, fileSize, mimeType, documentPath } = req.body;

      // Validate required fields
      if (!documentType || !fileName || !documentPath) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Set secure ACL policy for uploaded document
      const objectStorageService = new ObjectStorageService();
      await objectStorageService.setKYBDocumentAclPolicy(documentPath, {
        owner: userId,
        visibility: "private", // KYB documents are always private
        aclRules: [] // Only owner can access
      });

      // Store document metadata in database
      const documentData = {
        documentType,
        fileName,
        filePath: documentPath, // Store object storage path, not local file path
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/octet-stream',
      };

      const validatedData = insertVerificationDocumentSchema.parse(documentData);
      const document = await storage.createVerificationDocument(userId, validatedData);

      // Trigger AI validation using object storage
      try {
        const objectFile = await objectStorageService.getKYBDocumentFile(documentPath);
        // Note: AI validation would need to be updated to work with object storage
        // For now, we'll mark as under review without AI validation
        await storage.updateVerificationStatus(document.id, "under_review", {
          confidence: 0.8,
          isValid: true,
          extractedData: {},
          notes: "Uploaded to secure storage, manual review required"
        });
        
        res.status(201).json({ 
          ...document, 
          message: "Document uploaded securely and queued for review" 
        });
      } catch (aiError) {
        console.error("AI validation setup failed:", aiError);
        res.status(201).json({ 
          ...document, 
          message: "Document uploaded securely, validation pending" 
        });
      }
    } catch (error) {
      console.error("Error completing document upload:", error);
      res.status(500).json({ message: "Failed to complete document upload" });
    }
  });

  // Secure document access endpoint
  app.get('/api/verification/documents/:documentPath(*)', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentPath = `/kyb-documents/${req.params.documentPath}`;
      
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getKYBDocumentFile(documentPath);
      
      // Check if user has access to this document
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Stream the secure document
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing document:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Document not found" });
      }
      return res.status(500).json({ message: "Failed to access document" });
    }
  });

  app.get('/api/verification/pending', isAuthenticated, async (req, res) => {
    try {
      const pendingDocs = await storage.getPendingVerifications();
      res.json(pendingDocs);
    } catch (error) {
      console.error("Error fetching pending verifications:", error);
      res.status(500).json({ message: "Failed to fetch pending verifications" });
    }
  });

  app.patch('/api/verification/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { status, notes } = req.body;
      await storage.updateVerificationStatus(req.params.id, status, undefined, notes);
      res.json({ message: "Verification status updated successfully" });
    } catch (error) {
      console.error("Error updating verification status:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // Partner routes
  app.get('/api/partners', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const partners = await storage.getPartnerRelations(userId);
      res.json(partners);
    } catch (error) {
      console.error("Error fetching partners:", error);
      res.status(500).json({ message: "Failed to fetch partners" });
    }
  });

  app.post('/api/partners/request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { partnerId, notes } = req.body;
      
      const relation = await storage.createPartnerRelation(userId, partnerId, notes);
      res.status(201).json(relation);
    } catch (error) {
      console.error("Error creating partner request:", error);
      res.status(500).json({ message: "Failed to create partner request" });
    }
  });

  app.patch('/api/partners/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updatePartnerRelationStatus(req.params.id, status);
      res.json({ message: "Partner relation status updated successfully" });
    } catch (error) {
      console.error("Error updating partner status:", error);
      res.status(500).json({ message: "Failed to update partner status" });
    }
  });

  // Performance Insights routes
  app.get('/api/insights/latest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const report = await storage.getLatestInsightsReport(userId);
      res.json(report);
    } catch (error) {
      console.error("Error fetching insights report:", error);
      res.status(500).json({ message: "Failed to fetch insights report" });
    }
  });

  app.post('/api/insights/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Generate new insights using AI
      const insights = await generatePerformanceInsights(userId);
      
      // Log activity
      await storage.logActivity(userId, "generated_insights", "insights", insights.id, { 
        reportId: insights.id,
        aiGenerated: true 
      });
      
      res.json(insights);
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // Admin routes for demo data management
  app.post('/api/admin/seed-demo-data', async (req, res) => {
    try {
      await seedDemoData();
      res.json({ 
        success: true, 
        message: "Demo data seeded successfully",
        offers: 15,
        commodities: 9,
        users: 9
      });
    } catch (error: any) {
      console.error("Failed to seed demo data:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to seed demo data", 
        error: error.message 
      });
    }
  });

  // Force production seeding endpoint (GET for easy browser access)
  app.get('/api/admin/force-seed-production', async (req, res) => {
    try {
      console.log("🔄 FORCE SEEDING: Clearing all existing data...");
      await clearDemoData();
      
      console.log("🌱 FORCE SEEDING: Creating 9 verified traders and 30 offers...");
      await seedDemoData();
      
      // Verify the seeding worked
      const offers = await storage.getOffers();
      const verifiedOffers = offers.filter(offer => offer.verified && offer.sellerOrgVerified);
      const uniqueTraders = new Set(verifiedOffers.map(offer => offer.userId)).size;
      
      console.log(`✅ FORCE SEEDING COMPLETE: ${offers.length} offers, ${uniqueTraders} verified traders`);
      
      res.json({ 
        success: true, 
        message: "Production data force-seeded successfully",
        totalOffers: offers.length,
        verifiedOffers: verifiedOffers.length,
        verifiedTraders: uniqueTraders,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("❌ FORCE SEEDING FAILED:", error);
      res.status(500).json({ 
        success: false, 
        message: "Force seeding failed", 
        error: error.message 
      });
    }
  });

  app.delete('/api/admin/clear-demo-data', async (req, res) => {
    try {
      await clearDemoData();
      res.json({ 
        success: true, 
        message: "Demo data cleared successfully" 
      });
    } catch (error: any) {
      console.error("Failed to clear demo data:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to clear demo data", 
        error: error.message 
      });
    }
  });

  // Public object serving endpoint
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ADMIN CONSOLE ROUTES
  // Apply rate limiting to admin routes
  app.use('/admin', rateLimit(adminRateLimit));
  
  // Add storage to request context for admin routes
  app.use('/admin', (req: any, res, next) => {
    req.storage = storage;
    (global as any).adminStorage = storage;
    next();
  });
  
  // Admin authentication endpoint
  app.get('/admin/auth/info', isAuthenticated, requireAdminAuth, async (req: any, res) => {
    try {
      const adminSession = req.adminSession;
      res.json({
        user: {
          id: adminSession.userId,
          role: adminSession.role,
          permissions: adminSession.permissions,
          requires2FA: adminSession.requires2FA,
          is2FAVerified: adminSession.is2FAVerified
        }
      });
    } catch (error) {
      console.error("Admin auth info error:", error);
      res.status(500).json({ message: "Failed to get admin info" });
    }
  });

  // KYB/KYC Management
  app.get('/admin/kyb', isAuthenticated, requireAdminAuth, requirePermission('kyb:view'), async (req: any, res) => {
    try {
      const { status, assignedTo } = req.query;
      const users = await storage.getAllUsers({ 
        kybStatus: status,
        ...(assignedTo && { adminRole: assignedTo })
      });
      
      const kybQueue = users.filter(user => 
        user.kybStatus && ['pending', 'in_review'].includes(user.kybStatus)
      );
      
      res.json(kybQueue);
    } catch (error) {
      console.error("KYB queue error:", error);
      res.status(500).json({ message: "Failed to fetch KYB queue" });
    }
  });

  app.post('/admin/kyb/:companyId/decision', isAuthenticated, requireAdminAuth, requirePermission('kyb:approve'), async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const { decision, reason, verificationLevel } = req.body;
      const adminSession = req.adminSession;
      
      if (!['verified', 'enhanced', 'rejected'].includes(decision)) {
        return res.status(400).json({ message: "Invalid decision type" });
      }

      const beforeUser = await storage.getUser(companyId);
      if (!beforeUser) {
        return res.status(404).json({ message: "Company not found" });
      }

      const updatedUser = await storage.updateKYBStatus(companyId, decision, verificationLevel);
      
      // Log the admin action
      await logAdminAction({
        userId: adminSession.userId,
        userRole: adminSession.role,
        action: decision === 'verified' ? AUDIT_ACTIONS.KYB_APPROVED : 
                decision === 'enhanced' ? AUDIT_ACTIONS.KYB_ENHANCED :
                AUDIT_ACTIONS.KYB_REJECTED,
        entityType: "company",
        entityId: companyId,
        beforeValue: { kybStatus: beforeUser.kybStatus, verificationLevel: beforeUser.verificationLevel },
        afterValue: { kybStatus: decision, verificationLevel },
        reason,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        message: `KYB ${decision} successfully`,
        user: updatedUser
      });
    } catch (error) {
      console.error("KYB decision error:", error);
      res.status(500).json({ message: "Failed to process KYB decision" });
    }
  });

  // Admin Offers Management
  app.get('/admin/offers', isAuthenticated, requireAdminAuth, requirePermission('offers:view'), async (req: any, res) => {
    try {
      const { status, moderationStatus } = req.query;
      const offers = await storage.getOffers(undefined, true); // Include hidden offers
      
      let filteredOffers = offers;
      if (status) {
        filteredOffers = offers.filter(offer => offer.status === status);
      }
      if (moderationStatus) {
        filteredOffers = filteredOffers.filter(offer => offer.moderationStatus === moderationStatus);
      }

      res.json(filteredOffers);
    } catch (error) {
      console.error("Admin offers error:", error);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  app.post('/admin/offers/:id/moderate', isAuthenticated, requireAdminAuth, requirePermission('offers:moderate'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { action, reason } = req.body;
      const adminSession = req.adminSession;

      if (!['hide', 'unhide', 'archive'].includes(action)) {
        return res.status(400).json({ message: "Invalid moderation action" });
      }

      const beforeOffer = await storage.getOfferById(id);
      if (!beforeOffer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      const moderationStatus = action === 'hide' ? 'hidden' : 
                              action === 'archive' ? 'archived' : 'active';

      const updatedOffer = await storage.moderateOffer(id, moderationStatus, reason, adminSession.userId);

      await logAdminAction({
        userId: adminSession.userId,
        userRole: adminSession.role,
        action: action === 'hide' ? AUDIT_ACTIONS.OFFER_HIDDEN :
                action === 'unhide' ? AUDIT_ACTIONS.OFFER_UNHIDDEN :
                AUDIT_ACTIONS.OFFER_ARCHIVED,
        entityType: "offer",
        entityId: id,
        beforeValue: { moderationStatus: beforeOffer.moderationStatus || 'active' },
        afterValue: { moderationStatus },
        reason,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        message: `Offer ${action}d successfully`,
        offer: updatedOffer
      });
    } catch (error) {
      console.error("Moderate offer error:", error);
      res.status(500).json({ message: "Failed to moderate offer" });
    }
  });

  // Admin Insights
  app.get('/admin/insights/market', isAuthenticated, requireAdminAuth, requirePermission('insights:view'), async (req: any, res) => {
    try {
      const { export: exportCsv } = req.query;
      const insights = await storage.getMarketInsights();
      
      if (exportCsv === 'csv') {
        const csvData = [
          ['Metric', 'Value'],
          ['Active Offers', insights.activeOffers.toString()],
          ['Total Market Value', insights.totalValue],
          ['Average Price', insights.avgPrice],
          ...insights.topCommodities.map((c: any) => [c.name, c.count.toString()])
        ].map(row => row.join(',')).join('\\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="market-insights.csv"');
        return res.send(csvData);
      }

      res.json(insights);
    } catch (error) {
      console.error("Market insights error:", error);
      res.status(500).json({ message: "Failed to fetch market insights" });
    }
  });

  app.get('/admin/insights/compliance', isAuthenticated, requireAdminAuth, requirePermission('insights:view'), async (req: any, res) => {
    try {
      const insights = await storage.getComplianceInsights();
      res.json(insights);
    } catch (error) {
      console.error("Compliance insights error:", error);
      res.status(500).json({ message: "Failed to fetch compliance insights" });
    }
  });

  // Audit Logs
  app.get('/admin/audit', isAuthenticated, requireAdminAuth, requirePermission('audit:view'), async (req: any, res) => {
    try {
      const { 
        userId, action, entityType, entityId, 
        startDate, endDate, limit = '50', offset = '0' 
      } = req.query;
      
      const auditLogs = await storage.getAuditLogs({
        userId: userId as string,
        action: action as string,
        entityType: entityType as string,
        entityId: entityId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json(auditLogs);
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Companies Management
  app.get('/admin/companies', isAuthenticated, requireAdminAuth, requirePermission('users:view'), async (req: any, res) => {
    try {
      const { search, role, kybStatus } = req.query;
      const users = await storage.getAllUsers({ adminRole: role as string, kybStatus: kybStatus as string });
      
      let filteredUsers = users;
      if (search) {
        filteredUsers = users.filter((user: any) => 
          user.companyName?.toLowerCase().includes(search.toLowerCase()) ||
          user.email?.toLowerCase().includes(search.toLowerCase()) ||
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(search.toLowerCase())
        );
      }

      res.json(filteredUsers);
    } catch (error) {
      console.error("Companies list error:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post('/admin/users/:id/toggle', isAuthenticated, requireAdminAuth, requirePermission('users:toggle'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const adminSession = req.adminSession;

      const beforeUser = await storage.getUser(id);
      if (!beforeUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.toggleUserStatus(id, enabled);

      await logAdminAction({
        userId: adminSession.userId,
        userRole: adminSession.role,
        action: enabled ? AUDIT_ACTIONS.USER_ENABLED : AUDIT_ACTIONS.USER_DISABLED,
        entityType: "user",
        entityId: id,
        beforeValue: { active: !enabled },
        afterValue: { active: enabled },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        message: `User ${enabled ? 'enabled' : 'disabled'} successfully`,
        user: updatedUser
      });
    } catch (error) {
      console.error("Toggle user error:", error);
      res.status(500).json({ message: "Failed to toggle user status" });
    }
  });

  const httpServer = createServer(app);
  
  if (shouldRunStartupSeeding()) {
    // Preserve the existing deployment behavior outside controlled recovery.
    setTimeout(async () => {
      try {
        console.log("🔍 Checking for existing data...");
        const existingOffers = await storage.getOffers();
        const verifiedOffers = existingOffers.filter(offer => offer.verified && offer.sellerOrgVerified);
        const uniqueTraders = new Set(verifiedOffers.map(offer => offer.userId)).size;
        
        console.log(`📊 Found ${existingOffers.length} existing offers`);
        console.log(`✅ Found ${uniqueTraders} verified traders`);
        
        if (uniqueTraders < 9) {
          console.log(`🌱 Only ${uniqueTraders} verified traders found, need 9. Clearing and seeding demo data...`);
          await clearDemoData();
          await seedDemoData();
          console.log("✅ Demo data seeding completed for deployment");
        } else {
          console.log("📦 Sufficient verified traders found, skipping demo data seeding");
        }
      } catch (error) {
        console.error("❌ Failed to seed demo data on startup:", error);
        try {
          console.log("🔄 Attempting forced demo data seeding...");
          await clearDemoData();
          await seedDemoData();
          console.log("✅ Forced demo data seeding completed");
        } catch (seedError) {
          console.error("❌ Forced seeding also failed:", seedError);
        }
      }
    }, 1000);
  } else {
    console.warn("Controlled recovery mode: startup demo-data mutation disabled");
  }
  
  return httpServer;
}
