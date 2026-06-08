import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertOfferSchema,
  insertContractSchema,
  insertVerificationDocumentSchema,
  insertCommoditySchema,
} from "@shared/schema";
import { validateDocument } from "./services/aiValidation";
import { createSmartContract, getContractStatus } from "./services/blockchain";
import { seedDemoData, clearDemoData } from "./seedData";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix =
        Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
      );
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF and images are allowed."));
    }
  },
});

/**
 * Safely extract a userId from the request in all modes.
 * - In Replit/OIDC mode: uses req.user.claims.sub
 * - In local/demo mode: falls back to a constant demo id
 */
function getUserIdFromRequest(req: any): string | null {
  try {
    if (req.user?.claims?.sub) return req.user.claims.sub;
    if (req.user?.id) return req.user.id;
  } catch {
    // ignore and fall through
  }

  const AUTH_MODE = process.env.AUTH_MODE ?? "local";
  const IS_DEMO_MODE = process.env.DEMO_MODE === "true";

  if (AUTH_MODE === "local" || IS_DEMO_MODE) {
    return "local-user";
  }

  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      environment: process.env.NODE_ENV ?? "development",
    });
  });

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let user = await storage.getUser(userId);

      // Fallback demo user for local/demo modes if not in DB
      if (!user) {
        const AUTH_MODE = process.env.AUTH_MODE ?? "local";
        const IS_DEMO_MODE = process.env.DEMO_MODE === "true";

        if (AUTH_MODE === "local" || IS_DEMO_MODE) {
          user = {
            id: userId,
            email: "local@example.com",
            firstName: "Local",
            lastName: "User",
            profileImageUrl: "",
            companyName: "Demo Company",
            role: "admin",
          };
        }
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const metrics = await storage.getDashboardMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get("/api/dashboard/activity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const activities = await storage.getRecentActivity(userId, limit);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // Commodity routes
  app.get("/api/commodities", async (req, res) => {
    try {
      const commodities = await storage.getCommodities();
      res.json(commodities);
    } catch (error) {
      console.error("Error fetching commodities:", error);
      res.status(500).json({ message: "Failed to fetch commodities" });
    }
  });

  app.post("/api/commodities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validatedData = insertCommoditySchema.parse(req.body);
      const commodity = await storage.createCommodity(validatedData);

      await storage.logActivity(
        userId,
        "create_commodity",
        "commodity",
        commodity.id,
      );

      res.status(201).json(commodity);
    } catch (error) {
      console.error("Error creating commodity:", error);
      res.status(400).json({ message: "Failed to create commodity" });
    }
  });

  // Offer routes
  app.get("/api/offers", isAuthenticated, async (req: any, res) => {
    try {
      const fallbackUserId = getUserIdFromRequest(req);
      if (!fallbackUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = (req.query.user_id as string) || fallbackUserId;
      const offers = await storage.getOffers(userId);
      res.json(offers);
    } catch (error) {
      console.error("Error fetching offers:", error);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  app.get("/api/offers/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const category = req.query.category as string;
      const offers = await storage.searchOffers(query, category);
      res.json(offers);
    } catch (error) {
      console.error("Error searching offers:", error);
      res.status(500).json({ message: "Failed to search offers" });
    }
  });

  app.get("/api/offers/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/offers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validatedData = insertOfferSchema.parse(req.body);
      const offer = await storage.createOffer(userId, validatedData);
      res.status(201).json(offer);
    } catch (error) {
      console.error("Error creating offer:", error);
      res.status(400).json({ message: "Failed to create offer" });
    }
  });

  app.patch("/api/offers/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateOfferStatus(req.params.id, status);
      res.json({ message: "Offer status updated successfully" });
    } catch (error) {
      console.error("Error updating offer status:", error);
      res.status(500).json({ message: "Failed to update offer status" });
    }
  });

  // Contract routes
  app.get("/api/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const contracts = await storage.getContracts(userId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validatedData = insertContractSchema.parse(req.body);

      // Create the contract
      const contract = await storage.createContract(validatedData);

      // Create smart contract on blockchain (mock)
      try {
        const blockchainTxHash = await createSmartContract(contract);
        await storage.updateContractStatus(contract.id, "pending_approval");

        res.status(201).json({
          ...contract,
          blockchainTxHash,
          message: "Contract created and deployed to blockchain",
        });
      } catch (blockchainError) {
        console.error("Blockchain deployment failed:", blockchainError);
        res.status(201).json({
          ...contract,
          message: "Contract created, blockchain deployment pending",
        });
      }
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(400).json({ message: "Failed to create contract" });
    }
  });

  app.patch("/api/contracts/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateContractStatus(req.params.id, status);
      res.json({ message: "Contract status updated successfully" });
    } catch (error) {
      console.error("Error updating contract status:", error);
      res.status(500).json({ message: "Failed to update contract status" });
    }
  });

  app.get(
    "/api/contracts/:id/blockchain-status",
    isAuthenticated,
    async (req, res) => {
      try {
        const contract = await storage.getContractById(req.params.id);
        if (!contract) {
          return res.status(404).json({ message: "Contract not found" });
        }

        if (!contract.blockchainTxHash) {
          return res.json({ status: "not_deployed" });
        }

        const blockchainStatus = await getContractStatus(
          contract.blockchainTxHash,
        );
        res.json(blockchainStatus);
      } catch (error) {
        console.error("Error fetching blockchain status:", error);
        res.status(500).json({ message: "Failed to fetch blockchain status" });
      }
    },
  );

  // Verification routes
  app.get(
    "/api/verification/documents",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const documents = await storage.getVerificationDocuments(userId);
        res.json(documents);
      } catch (error) {
        console.error("Error fetching verification documents:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch verification documents" });
      }
    },
  );

  app.post(
    "/api/verification/upload",
    isAuthenticated,
    upload.single("document"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const userId = getUserIdFromRequest(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { documentType } = req.body;

        const documentData = {
          documentType,
          fileName: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        };

        const validatedData =
          insertVerificationDocumentSchema.parse(documentData);
        const document = await storage.createVerificationDocument(
          userId,
          validatedData,
        );

        // Trigger AI validation
        try {
          const aiResult = await validateDocument(req.file.path, documentType);
          await storage.updateVerificationStatus(
            document.id,
            "under_review",
            aiResult,
          );

          res.status(201).json({
            ...document,
            aiValidationResult: aiResult,
            message: "Document uploaded and AI validation completed",
          });
        } catch (aiError) {
          console.error("AI validation failed:", aiError);
          res.status(201).json({
            ...document,
            message: "Document uploaded, AI validation pending",
          });
        }
      } catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ message: "Failed to upload document" });
      }
    },
  );

  app.get("/api/verification/pending", isAuthenticated, async (req, res) => {
    try {
      const pendingDocs = await storage.getPendingVerifications();
      res.json(pendingDocs);
    } catch (error) {
      console.error("Error fetching pending verifications:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch pending verifications" });
    }
  });

  app.patch("/api/verification/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status, notes } = req.body;
      await storage.updateVerificationStatus(
        req.params.id,
        status,
        undefined,
        notes,
      );
      res.json({ message: "Verification status updated successfully" });
    } catch (error) {
      console.error("Error updating verification status:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // Partner routes
  app.get("/api/partners", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const partners = await storage.getPartnerRelations(userId);
      res.json(partners);
    } catch (error) {
      console.error("Error fetching partners:", error);
      res.status(500).json({ message: "Failed to fetch partners" });
    }
  });

  app.post("/api/partners/request", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { partnerId, notes } = req.body;

      const relation = await storage.createPartnerRelation(
        userId,
        partnerId,
        notes,
      );
      res.status(201).json(relation);
    } catch (error) {
      console.error("Error creating partner request:", error);
      res.status(500).json({ message: "Failed to create partner request" });
    }
  });

  app.patch("/api/partners/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updatePartnerRelationStatus(req.params.id, status);
      res.json({ message: "Partner relation status updated successfully" });
    } catch (error) {
      console.error("Error updating partner status:", error);
      res.status(500).json({ message: "Failed to update partner status" });
    }
  });

  // Admin routes for demo data management
  app.post("/api/admin/seed-demo-data", async (req, res) => {
    try {
      await seedDemoData();
      res.json({
        success: true,
        message: "Demo data seeded successfully",
        offers: 9,
        commodities: 9,
        users: 3,
      });
    } catch (error: any) {
      console.error("Failed to seed demo data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to seed demo data",
        error: error.message,
      });
    }
  });

  app.delete("/api/admin/clear-demo-data", async (req, res) => {
    try {
      await clearDemoData();
      res.json({
        success: true,
        message: "Demo data cleared successfully",
      });
    } catch (error: any) {
      console.error("Failed to clear demo data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clear demo data",
        error: error.message,
      });
    }
  });

  const httpServer = createServer(app);

  if (process.env.DEMO_MODE === "true") {
    // Seed demo data on startup if demo mode is explicitly enabled.
    setTimeout(async () => {
      try {
        const existingOffers = await storage.getOffers();
        if (existingOffers.length === 0) {
          console.log("DEMO_MODE enabled: seeding demo marketplace data.");
          await seedDemoData();
        }
      } catch (error) {
        console.error("Failed to seed demo data on startup:", error);
      }
    }, 2000);
  }

  return httpServer;
}
