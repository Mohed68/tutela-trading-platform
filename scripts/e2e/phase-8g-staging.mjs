import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.env.TUTELA_E2E_BASE_URL ?? "http://127.0.0.1:5100";
const statePath = join(tmpdir(), "tutela-phase-8g-staging-state.json");
let commodity = Object.freeze({
  id: "ca961030-ee2c-49c4-83df-a61bdf4864be",
  classification: "metals_precious",
  activityCode: "metals_precious",
});

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await response.text();
  let value = null;
  try { value = text ? JSON.parse(text) : null; } catch { value = text; }
  return {
    status: response.status,
    value,
    cookie: response.headers.get("set-cookie")?.split(";", 1)[0] ?? cookie,
  };
}

async function identity(scope) {
  const suffix = randomUUID();
  const credentials = {
    firstName: "Phase",
    lastName: scope,
    email: `phase8g-${scope.toLowerCase()}-${suffix}@example.test`,
    password: `Tutela-${suffix}-A1`,
  };
  const registered = await request("/api/auth/register", { method: "POST", body: credentials });
  check(registered.status === 201, `${scope}_registration_${registered.status}`);
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: credentials.email, password: credentials.password },
  });
  check(login.status === 200 && login.cookie, `${scope}_login_${login.status}`);
  return { credentials, cookie: login.cookie, userId: login.value.id };
}

async function loadCanonicalCommodity(actor) {
  const options = await request("/api/drafts/options", { cookie: actor.cookie });
  const copper = options.value?.commodities?.find(
    (entry) => entry.name === "Copper Cathode",
  );
  check(options.status === 200 && copper, `commodity_catalog_${options.status}`);
  commodity = Object.freeze({
    id: copper.id,
    classification: copper.category,
    activityCode: copper.category,
  });
}

async function organization(actor, scope) {
  const registrationIdentifier = `phase8g-${scope}-${randomUUID()}`;
  const legalName = `Phase 8G ${scope} Trading`;
  const created = await request("/api/organizations", {
    method: "POST",
    cookie: actor.cookie,
    body: {
      legalName,
      tradingNames: [],
      organizationType: "trading_company",
      jurisdiction: "AE",
      registrationIdentifiers: [{ scheme: "trade_license", value: registrationIdentifier }],
      declaredActivities: [{ code: commodity.activityCode }],
    },
  });
  check(created.status === 201 && created.value.membershipRole === "owner" && created.value.membershipStatus === "active", `${scope}_organization_${created.status}`);
  return { ...created.value, legalName, registrationIdentifier };
}

function validEvidence(org, representativeReference) {
  return { assertions: [
    { assertionCode: "evidence_category", value: "organization_existence" },
    { assertionCode: "evidence_category", value: "representative_association" },
    { assertionCode: "document_type", value: "business_registration" },
    { assertionCode: "legal_name", value: org.legalName },
    { assertionCode: "registration_jurisdiction", value: "AE" },
    { assertionCode: "registration_identifier", value: `trade_license:${org.registrationIdentifier}` },
    { assertionCode: "association_asserted", value: "true" },
    { assertionCode: "representative_reference", value: representativeReference },
    { assertionCode: "organization.activity_code", value: commodity.activityCode },
    { assertionCode: "activity.commodity_id", value: commodity.id },
    { assertionCode: "activity.commodity_classification", value: commodity.classification },
  ] };
}

async function verifyOrganization(actor, org, evidence) {
  const submitted = await request(`/api/organizations/${org.organizationId}/profile-revisions/${org.profileRevisionId}/evidence`, { method: "POST", cookie: actor.cookie, body: evidence });
  check(submitted.status === 201, `organization_evidence_${submitted.status}`);
  const verified = await request(`/api/organizations/${org.organizationId}/profile-revisions/${org.profileRevisionId}/verification`, { method: "POST", cookie: actor.cookie, body: {} });
  check(verified.status === 200 && verified.value.status === "completed" && verified.value.trustState !== "unknown", `organization_verification_${verified.status}`);
  return verified.value;
}

async function participation(actor, org, activityCode = commodity.activityCode, commodityId = commodity.id) {
  return request(`/api/organizations/${org.organizationId}/trade-participation`, {
    method: "POST",
    cookie: actor.cookie,
    body: { profileRevisionId: org.profileRevisionId, activityCode, commodity: { commodityId, commodityClassification: commodity.classification, jurisdiction: null } },
  });
}

async function beforeRestart() {
  const health = await request("/api/health");
  check(health.status === 200 && health.value.status === "ok", "health_unavailable");

  const seller = await identity("Seller");
  const buyer = await identity("Buyer");
  const negative = await identity("Negative");
  await loadCanonicalCommodity(seller);
  const sellerOrg = await organization(seller, "Seller");
  const buyerOrg = await organization(buyer, "Buyer");
  const negativeOrg = await organization(negative, "Negative");

  const sellerVerification = await verifyOrganization(seller, sellerOrg, validEvidence(sellerOrg, seller.userId));
  const buyerVerification = await verifyOrganization(buyer, buyerOrg, validEvidence(buyerOrg, buyer.userId));
  check(sellerVerification.trustState === "trusted" && buyerVerification.trustState === "trusted", "authoritative_trust_not_reached");

  const sellerParticipation = await participation(seller, sellerOrg);
  const buyerParticipation = await participation(buyer, buyerOrg);
  check(sellerParticipation.status === 200 && sellerParticipation.value.activity.outcome === "eligible" && sellerParticipation.value.participation.status === "resolved", "seller_participation_not_eligible");
  check(buyerParticipation.status === 200 && buyerParticipation.value.activity.outcome === "eligible" && buyerParticipation.value.participation.status === "resolved", "buyer_participation_not_eligible");

  const incompleteEvidence = { assertions: [
    { assertionCode: "evidence_category", value: "organization_existence" },
    { assertionCode: "evidence_category", value: "representative_association" },
  ] };
  const incompleteVerification = await verifyOrganization(negative, negativeOrg, incompleteEvidence);
  check(incompleteVerification.trustState !== "trusted", "incomplete_evidence_became_trusted");
  const reviewActivity = await participation(negative, negativeOrg);
  check(reviewActivity.status === 200 && reviewActivity.value.activity.outcome === "requires_review", "incomplete_activity_did_not_require_review");
  const mismatchedActivity = await participation(seller, sellerOrg, commodity.activityCode, randomUUID());
  check(mismatchedActivity.status === 200 && mismatchedActivity.value.activity.outcome === "ineligible", "mismatched_activity_not_ineligible");

  const draft = await request("/api/drafts", { method: "POST", cookie: seller.cookie, body: { offerType: "sell", commodityId: commodity.id, quantity: "100", unit: "MT", amountPerUnit: "7500", currency: "USD", location: "Dubai" } });
  check(draft.status === 201 && draft.value.status === "draft", `draft_creation_${draft.status}`);
  const noEvidenceSubmission = await request(`/api/drafts/${draft.value.id}/submit`, { method: "POST", cookie: seller.cookie, body: {} });
  check(noEvidenceSubmission.status === 422, "offer_without_evidence_did_not_fail_closed");
  const offerEvidence = await request(`/api/drafts/${draft.value.id}/evidence`, { method: "POST", cookie: seller.cookie, body: { assertions: [
    { assertionCode: "document_type", value: "commercial_offer_document" },
    { assertionCode: "offer_id", value: draft.value.id },
    { assertionCode: "documentary_consistency", value: "true" },
  ] } });
  check(offerEvidence.status === 201, `offer_evidence_${offerEvidence.status}`);
  const submitted = await request(`/api/drafts/${draft.value.id}/submit`, { method: "POST", cookie: seller.cookie, body: {} });
  check(submitted.status === 200 && submitted.value.status === "submitted", `offer_submission_${submitted.status}`);

  let market;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    market = await request(`/api/offers/search?q=${encodeURIComponent("Copper")}`);
    if (market.status === 200 && market.value.offers?.some((offer) => offer.id === draft.value.id)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  check(market?.value?.offers?.some((offer) => offer.id === draft.value.id), "offer_not_published");

  const ineligibleOrder = await request("/api/orders", { method: "POST", cookie: negative.cookie, body: { offerId: draft.value.id, buyerOrganizationId: negativeOrg.organizationId, quantity: "10" } });
  check(ineligibleOrder.status === 409, "ineligible_buyer_not_rejected");
  const order = await request("/api/orders", { method: "POST", cookie: buyer.cookie, body: { offerId: draft.value.id, buyerOrganizationId: buyerOrg.organizationId, quantity: "10" } });
  check(order.status === 201 && order.value.status === "created", `order_creation_${order.status}`);
  const prematureContract = await request("/api/contracts", { method: "POST", cookie: buyer.cookie, body: { orderId: order.value.orderId } });
  check(prematureContract.status === 409, "unaccepted_order_created_contract");
  const accepted = await request(`/api/orders/${order.value.orderId}/status`, { method: "PATCH", cookie: seller.cookie, body: { status: "accepted" } });
  check(accepted.status === 200 && accepted.value.status === "accepted", `order_acceptance_${accepted.status}`);
  const conflictingAccept = await request(`/api/orders/${order.value.orderId}/status`, { method: "PATCH", cookie: seller.cookie, body: { status: "accepted" } });
  check(conflictingAccept.status === 409, "conflicting_order_acceptance_not_rejected");
  const contract = await request("/api/contracts", { method: "POST", cookie: buyer.cookie, body: { orderId: order.value.orderId } });
  check(contract.status === 201 && contract.value.orderId === order.value.orderId && contract.value.offerId === draft.value.id, `contract_creation_${contract.status}`);

  await writeFile(statePath, JSON.stringify({
    seller: { credentials: seller.credentials }, buyer: { credentials: buyer.credentials },
    sellerOrg, buyerOrg, commodity, offerId: draft.value.id, orderId: order.value.orderId, contractId: contract.value.contractId,
  }), { mode: 0o600 });
  console.log(JSON.stringify({ phase: "before_restart", health: "pass", registrations: 3, trust: "trusted", participation: "eligible", offer: "publishable", order: "accepted", contract: "created", failClosed: "pass" }));
}

async function afterRestart() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  commodity = Object.freeze(state.commodity);
  const health = await request("/api/health"); check(health.status === 200, "post_restart_health");
  for (const actor of [state.seller, state.buyer]) {
    const login = await request("/api/auth/login", { method: "POST", body: { email: actor.credentials.email, password: actor.credentials.password } });
    check(login.status === 200 && login.cookie, "post_restart_login"); actor.cookie = login.cookie;
  }
  const replayed = await participation(state.seller, state.sellerOrg);
  check(replayed.status === 200 && replayed.value.activity.outcome === "eligible" && replayed.value.participation.status === "resolved", "post_restart_replay");
  const market = await request(`/api/offers/search?q=${encodeURIComponent("Copper")}`);
  check(market.status === 200 && market.value.offers.some((offer) => offer.id === state.offerId), "post_restart_marketplace");
  const orders = await request("/api/orders", { cookie: state.buyer.cookie });
  check(orders.status === 200 && orders.value.some((order) => order.id === state.orderId || order.orderId === state.orderId), "post_restart_order");
  const contract = await request(`/api/contracts/${state.contractId}`, { cookie: state.buyer.cookie });
  check(contract.status === 200 && (contract.value.id === state.contractId || contract.value.contractId === state.contractId), "post_restart_contract");
  await unlink(statePath);
  console.log(JSON.stringify({ phase: "after_restart", health: "pass", login: "pass", replay: "pass", marketplace: "pass", order: "pass", contract: "pass" }));
}

const phase = process.argv[2];
if (phase === "before-restart") await beforeRestart();
else if (phase === "after-restart") await afterRestart();
else if (phase === "verification-smoke") {
  const actor = await identity("VerificationSmoke");
  const org = await organization(actor, "VerificationSmoke");
  const result = await verifyOrganization(actor, org, validEvidence(org, actor.userId));
  console.log(JSON.stringify({ phase: "verification_smoke", status: result.status, trust: result.trustState }));
}
else throw new Error("Use before-restart or after-restart");
