import { randomUUID } from "node:crypto";

import { productionOrganizationParticipationEligibilityReadAdapter } from "../organization-participation-eligibility/productionRuntime.js";
import { offerVerificationEligibilityReadRepository } from "../verification/eligibilityReadRepository.js";
import { postgresTradingFlowRepository } from "./postgresRepository.js";
import { createTradingFlowService } from "./service.js";

export const productionTradingFlowService = createTradingFlowService({
  repository: postgresTradingFlowRepository,
  organizationParticipationEligibility:
    productionOrganizationParticipationEligibilityReadAdapter,
  offerVerificationEligibility: offerVerificationEligibilityReadRepository,
  ids: Object.freeze({ next: () => randomUUID() }),
  clock: Object.freeze({ now: () => new Date().toISOString() }),
});
