import assert from "node:assert/strict";
import test from "node:test";
import {
  approvalAppliesToSnapshot, canActivatePlatformTerms, canConfirmIntegrityAnchor,
  canCreateFeeEntitlement, domainFromVerifiedEmail, evaluateInvitation,
  evaluateMandate, mayAutoJoin, requiredSignatureSlots, resolveOrganization,
} from "./domain.js";

const at=(value:string)=>new Date(value);
test("verified email alone and domain match alone cannot create membership or authority",()=>{
  assert.equal(domainFromVerifiedEmail("person@example.com",false),null);
  assert.equal(mayAutoJoin({emailVerified:true,emailDomain:"example.com",organizationDomain:"example.com",domainStatus:"UNVERIFIED",membershipPolicy:"VERIFIED_DOMAIN_AUTO_JOIN",conflictOrRisk:false}),false);
  assert.equal(mayAutoJoin({emailVerified:true,emailDomain:"example.com",organizationDomain:"example.com",domainStatus:"VERIFIED",membershipPolicy:"APPROVAL_REQUIRED",conflictOrRisk:false}),false);
  assert.equal(mayAutoJoin({emailVerified:true,emailDomain:"example.com",organizationDomain:"example.com",domainStatus:"REVOKED",membershipPolicy:"VERIFIED_DOMAIN_AUTO_JOIN",conflictOrRisk:false}),false);
  assert.equal(mayAutoJoin({emailVerified:true,emailDomain:"example.com",organizationDomain:"example.com",domainStatus:"VERIFIED",membershipPolicy:"VERIFIED_DOMAIN_AUTO_JOIN",conflictOrRisk:false}),true);
});
test("candidate resolution never silently creates membership or ownership",()=>{
  const candidate={organizationId:"org-1",legalName:"Example",jurisdiction:"DE",verifiedDomainMatch:false,exactIdentifierMatch:false,possibleNameMatch:true,trustStatus:null};
  assert.deepEqual(resolveOrganization({candidates:[candidate]}).outcome,"POSSIBLE_MATCH");
  assert.deepEqual(resolveOrganization({candidates:[{...candidate,verifiedDomainMatch:true}]}).outcome,"MATCHED");
  assert.deepEqual(resolveOrganization({candidates:[candidate,{...candidate,organizationId:"org-2"}]}).outcome,"MULTIPLE_MATCHES");
});
test("wrong-email expired replayed revoked and unverified invitations fail",()=>{
  const base={expectedEmail:"member@example.com",actualEmail:"member@example.com",emailVerified:true,expiresAt:at("2030-01-02T00:00:00Z"),now:at("2030-01-01T00:00:00Z")};
  assert.equal(evaluateInvitation(base),"ALLOW_MEMBER");
  assert.equal(evaluateInvitation({...base,actualEmail:"other@example.com"}),"WRONG_EMAIL");
  assert.equal(evaluateInvitation({...base,now:base.expiresAt}),"EXPIRED");
  assert.equal(evaluateInvitation({...base,redeemedAt:base.now}),"REPLAYED");
  assert.equal(evaluateInvitation({...base,revokedAt:base.now}),"REVOKED");
  assert.equal(evaluateInvitation({...base,emailVerified:false}),"EMAIL_UNVERIFIED");
});
const mandate={actionScope:["contract.sign"],contractTypeScope:["sale/v1"],commodityScope:["Urea"],maximumTransactionValue:"1000",valueCurrency:"USD",signatureEligibility:"BOTH" as const,validFrom:at("2030-01-01T00:00:00Z"),validUntil:at("2030-02-01T00:00:00Z"),membershipActive:true};
const request={now:at("2030-01-15T00:00:00Z"),action:"contract.sign",contractType:"sale/v1",commodity:"Urea",transactionValue:"500",currency:"USD",signatureMode:"INDIVIDUAL" as const};
test("inactive expired revoked and out-of-scope mandates cannot sign",()=>{
  assert.equal(evaluateMandate(mandate,request),"ELIGIBLE");
  assert.equal(evaluateMandate({...mandate,membershipActive:false},request),"INACTIVE_MEMBERSHIP");
  assert.equal(evaluateMandate({...mandate,validUntil:request.now},request),"EXPIRED");
  assert.equal(evaluateMandate({...mandate,revokedAt:request.now},request),"REVOKED");
  assert.equal(evaluateMandate(mandate,{...request,commodity:"Copper"}),"COMMODITY_OUT_OF_SCOPE");
  assert.equal(evaluateMandate(mandate,{...request,transactionValue:"1001"}),"VALUE_OUT_OF_SCOPE");
  assert.equal(evaluateMandate(mandate,{...request,currency:"EUR"}),"CURRENCY_MISMATCH");
});
test("joint signature requirement cannot be reduced to one slot",()=>{
  const result=requiredSignatureSlots({kind:"VALUE_BANDS",bands:[{minimumInclusive:"0",requiredSignatures:2,signatureMode:"JOINT"}]},"500");
  assert.deepEqual(result,{ok:true,slots:2,mode:"JOINT"});
  assert.deepEqual(requiredSignatureSlots({kind:"VALUE_BANDS",bands:[{minimumInclusive:"0",requiredSignatures:1,signatureMode:"JOINT"}]},"500"),{ok:false,reason:"INVALID_POLICY"});
});
test("stale or returned-for-revision approvals cannot carry forward",()=>{
  assert.equal(approvalAppliesToSnapshot({snapshotId:"a",contractVersion:1},{snapshotId:"b",contractVersion:2,state:"CONTRACT_PREPARATION"}),false);
  assert.equal(approvalAppliesToSnapshot({snapshotId:"a",contractVersion:1},{snapshotId:"a",contractVersion:1,state:"RETURNED_FOR_REVISION"}),false);
});
test("legal, fee, and integrity authority fail closed",()=>{
  assert.equal(canActivatePlatformTerms({status:"ACTIVE",effectiveAt:at("2030-01-01T00:00:00Z")}),false);
  assert.equal(canActivatePlatformTerms({status:"ACTIVE",effectiveAt:at("2030-01-01T00:00:00Z"),approvedAuthorityReference:"legal-approval-1"}),true);
  assert.equal(canCreateFeeEntitlement({scheduleStatus:"ACTIVE",governedTriggerFound:false,deterministicInputs:true}),false);
  assert.equal(canCreateFeeEntitlement({scheduleStatus:"DRAFT",governedTriggerFound:true,deterministicInputs:true}),false);
  assert.equal(canConfirmIntegrityAnchor({transactionReference:"tx",anchorTimestamp:at("2030-01-01T00:00:00Z")}),false);
  assert.equal(canConfirmIntegrityAnchor({transactionReference:"tx",anchorTimestamp:at("2030-01-01T00:00:00Z"),realReceipt:{block:1}}),true);
});
