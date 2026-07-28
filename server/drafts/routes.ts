import type { Express, Request, Response } from "express";
import { isAuthenticated, isLocallyAuthenticatable } from "../auth.js";
import { storage } from "../storage.js";
import {
  createDraftOfferRequestSchema,
  updateDraftOfferRequestSchema,
} from "../../shared/draftValidation.js";
import {
  isAllowedPhase5bDraftUnit,
} from "./policy.js";
import {
  createOwnedDraftOffer,
  deleteOwnedDraftOffer,
  DraftDependencyConflictError,
  getDraftCommodity,
  getDraftOfferOptions,
  getOwnedDraftOffer,
  listOwnedDraftOffers,
  updateOwnedDraftOffer,
} from "./storage.js";

async function authenticatedDraftActor(
  request: Request,
  response: Response,
): Promise<string | undefined> {
  const userId = request.user?.claims.sub;
  if (!userId) {
    response.status(401).json({ message: "Unauthorized" });
    return undefined;
  }
  const identity = await storage.getAuthenticationUser(userId);
  if (!isLocallyAuthenticatable(identity)) {
    response.status(401).json({ message: "Unauthorized" });
    return undefined;
  }
  return identity.id;
}

function invalidRequest(response: Response): void {
  response.status(400).json({ message: "Invalid draft offer request." });
}

function routeFailure(response: Response): void {
  response.status(500).json({ message: "Draft operation temporarily unavailable." });
}

export function registerDraftRoutes(app: Express): void {
  app.get("/api/drafts/options", isAuthenticated, async (request, response) => {
    try {
      if (!(await authenticatedDraftActor(request, response))) return;
      response.json(await getDraftOfferOptions());
    } catch {
      routeFailure(response);
    }
  });

  app.get("/api/drafts", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      response.json(await listOwnedDraftOffers(ownerId));
    } catch {
      routeFailure(response);
    }
  });

  app.post("/api/drafts", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      const parsed = createDraftOfferRequestSchema.safeParse(request.body);
      if (!parsed.success) return invalidRequest(response);
      const commodity = await getDraftCommodity(parsed.data.commodityId);
      if (
        !commodity ||
        !isAllowedPhase5bDraftUnit(commodity.name, parsed.data.unit)
      ) {
        return invalidRequest(response);
      }
      response.status(201).json(await createOwnedDraftOffer(ownerId, parsed.data));
    } catch {
      routeFailure(response);
    }
  });

  app.get("/api/drafts/:id", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      const draft = await getOwnedDraftOffer(ownerId, request.params.id);
      if (!draft) {
        return response.status(404).json({ message: "Draft not found." });
      }
      response.json(draft);
    } catch {
      routeFailure(response);
    }
  });

  app.patch("/api/drafts/:id", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      const parsed = updateDraftOfferRequestSchema.safeParse(request.body);
      if (!parsed.success) return invalidRequest(response);

      const current = await getOwnedDraftOffer(ownerId, request.params.id);
      if (!current) {
        return response.status(404).json({ message: "Draft not found." });
      }
      const commodityId = parsed.data.commodityId ?? current.commodity.id;
      const unit = parsed.data.unit ?? current.quantity.unit;
      const commodity =
        commodityId === current.commodity.id
          ? current.commodity
          : await getDraftCommodity(commodityId);
      if (!commodity || !isAllowedPhase5bDraftUnit(commodity.name, unit)) {
        return invalidRequest(response);
      }

      const updated = await updateOwnedDraftOffer(
        ownerId,
        request.params.id,
        parsed.data,
      );
      if (!updated) {
        return response.status(404).json({ message: "Draft not found." });
      }
      response.json(updated);
    } catch {
      routeFailure(response);
    }
  });

  app.delete("/api/drafts/:id", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      const deleted = await deleteOwnedDraftOffer(ownerId, request.params.id);
      if (!deleted) {
        return response.status(404).json({ message: "Draft not found." });
      }
      response.json(deleted);
    } catch (error) {
      if (error instanceof DraftDependencyConflictError) {
        return response.status(409).json({
          message: "Draft cannot be deleted because dependent records exist.",
        });
      }
      routeFailure(response);
    }
  });
}
