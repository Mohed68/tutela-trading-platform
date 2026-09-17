import type { Express, Request, Response } from "express";
import { isAuthenticated, isLocallyAuthenticatable } from "../auth.js";
import { storage } from "../storage.js";
import {
  createDraftOfferRequestSchema,
  submitDraftRequestSchema,
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
  getOwnedPrivateOffer,
  listOwnedPrivateOffers,
  submitOwnedDraftOffer,
  updateOwnedDraftOffer,
} from "./storage.js";
import { pool } from "../db.js";
import { loadCurrentOrganizationContext } from "../trade-trust-application/postgresRepository.js";
import { EnforcementDeniedError, requireTradeMutation } from "../enforcement/guard.js";

async function activeOrganizationId(userId:string):Promise<string|undefined>{
  const result=await loadCurrentOrganizationContext(userId);
  return result.status==='resolved' && result.record.membershipRole==='owner' ? result.record.organizationId : undefined;
}
async function enforceOfferMutation(action:"offer.create"|"offer.edit"|"offer.submit",userId:string,response:Response,offerId?:string){
  const organizationId=offerId ? (await pool.query<{seller_org_id:string}>(`SELECT offer.seller_org_id FROM public.offers offer
    JOIN public.organization_memberships membership ON membership.organization_id=offer.seller_org_id AND membership.user_id=offer.user_id
      AND membership.role='owner' AND membership.status='active' WHERE offer.id=$1 AND offer.user_id=$2`,[offerId,userId])).rows[0]?.seller_org_id : await activeOrganizationId(userId);
  if(!organizationId){response.status(409).json({message:"An active Organization membership is required."});return false;}
  await requireTradeMutation(action,[{scope:"USER",subjectId:userId},{scope:"ORGANIZATION",subjectId:organizationId}]);
  return true;
}

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
    } catch (error) {
      if(error instanceof EnforcementDeniedError)return response.status(403).json({message:"This trade action is restricted by an active enforcement decision.",code:"enforcement_denied"});
      routeFailure(response);
    }
  });

  app.get("/api/drafts", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      response.json(await listOwnedPrivateOffers(ownerId));
    } catch (error) {
      if(error instanceof EnforcementDeniedError)return response.status(403).json({message:"This trade action is restricted by an active enforcement decision.",code:"enforcement_denied"});
      routeFailure(response);
    }
  });

  app.post("/api/drafts", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      if(!await enforceOfferMutation("offer.create",ownerId,response))return;
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
    } catch (error) {
      if(error instanceof EnforcementDeniedError)return response.status(403).json({message:"This trade action is restricted by an active enforcement decision.",code:"enforcement_denied"});
      routeFailure(response);
    }
  });

  app.get("/api/drafts/:id", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      const offer = await getOwnedPrivateOffer(ownerId, request.params.id);
      if (!offer) {
        return response.status(404).json({ message: "Offer not found." });
      }
      response.json(offer);
    } catch {
      routeFailure(response);
    }
  });

  app.patch("/api/drafts/:id", isAuthenticated, async (request, response) => {
    try {
      const ownerId = await authenticatedDraftActor(request, response);
      if (!ownerId) return;
      if(!await enforceOfferMutation("offer.edit",ownerId,response,request.params.id))return;
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
    } catch (error) {
      if(error instanceof EnforcementDeniedError)return response.status(403).json({message:"This trade action is restricted by an active enforcement decision.",code:"enforcement_denied"});
      routeFailure(response);
    }
  });

  app.post(
    "/api/drafts/:id/submit",
    isAuthenticated,
    async (request, response) => {
      try {
        const ownerId = await authenticatedDraftActor(request, response);
        if (!ownerId) return;
        if(!await enforceOfferMutation("offer.submit",ownerId,response,request.params.id))return;
        if (!submitDraftRequestSchema.safeParse(request.body ?? {}).success) {
          return invalidRequest(response);
        }
        const submitted = await submitOwnedDraftOffer(
          ownerId,
          request.params.id,
        );
        if (!submitted) {
          return response.status(404).json({ message: "Offer not found." });
        }
        response.json(submitted);
      } catch (error) {
        if (error instanceof Error && error.message === "OFFER_DOCUMENTARY_EVIDENCE_REQUIRED") {
          return response.status(422).json({ message: "Documentary offer evidence is required before submission." });
        }
        if(error instanceof EnforcementDeniedError)return response.status(403).json({message:"This trade action is restricted by an active enforcement decision.",code:"enforcement_denied"});
        routeFailure(response);
      }
    },
  );

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
