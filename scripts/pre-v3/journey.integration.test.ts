import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { requireTestDatabase } from "../auth/test-database.js";

test("real MVP journey: verified Urea offer through executed contract and trade closeout", {timeout:900_000}, async(t)=>{
  const identity=requireTestDatabase();
  process.env.DATABASE_URL=identity.connectionString;process.env.NODE_ENV="test";process.env.TUTELA_TEST_NODE_POSTGRES="true";
  const client=new Client({connectionString:identity.connectionString,connectionTimeoutMillis:30_000});await client.connect();
  const {pool}=await import("../../server/db.js");
  const originalQuery=pool.query,originalConnect=pool.connect;
  let sequence=0;const transactions:string[]=[];
  // Real SQL on TEST_DATABASE, savepoints only replace transaction transport.
  // All append-only fixtures roll back; no authority result is fabricated.
  const query=async(sql:any,values?:any)=>{
    const text=typeof sql==="string"?sql:sql.text;
    if(/^begin\b/i.test(text)){const name=`journey_${++sequence}`;transactions.push(name);return client.query(`SAVEPOINT ${name}`);}
    if(/^commit\b/i.test(text))return client.query(`RELEASE SAVEPOINT ${transactions.pop()}`);
    if(/^rollback$/i.test(text)){const name=transactions.pop();await client.query(`ROLLBACK TO SAVEPOINT ${name}`);return client.query(`RELEASE SAVEPOINT ${name}`);}
    return client.query(sql,values);
  };
  pool.query=query as any;pool.connect=(async()=>({query,release(){}})) as any;
  try{
    await client.query("BEGIN");
    const {storage}=await import("../../server/storage.js");
    const {registerLocalAccount,activateLocalAccount}=await import("../../server/registration.js");
    const {verifyPassword}=await import("../../server/password.js");
    const {productionTradeTrustApplicationService:app}=await import("../../server/trade-trust-application/applicationService.js");
    const {createVreService,loadReviewContext}=await import("../../server/vre/service.js");
    const {contentDigest}=await import("../../server/vre/verificationReview.js");
    const {reevaluateOrganization}=await import("../../server/vre/reevaluate.js");
    const {PLATFORM_OWNER_ADMIN_PERMISSIONS}=await import("../../server/admin-security/policy.js");
    const {createVreReadModel}=await import("../../server/vre/readModel.js");
    const {productionOrganizationParticipationEligibilityReadAdapter:participation}=await import("../../server/organization-participation-eligibility/productionRuntime.js");
    const drafts=await import("../../server/drafts/storage.js");
    const {processNextVerificationCommand}=await import("../../server/verification/worker.js");
    const {getPublishedMarketplaceOfferRecords}=await import("../../server/marketplace/publicMarketplace.js");
    const {productionTradingFlowService:trading}=await import("../../server/trading-flow/productionService.js");
    const reads=await import("../../server/trading-flow/postgresRepository.js");
    const {createEnforcementGuard}=await import("../../server/enforcement/guard.js");
    const {createMvpClosureService}=await import("../../server/mvp-closure/service.js");
    const suffix=randomUUID();
    async function register(label:string){
      let token="";const email=`${label}-${suffix}@pre-v3.invalid`,password="IsolatedTestPassword123";
      await registerLocalAccount({firstName:label,lastName:"Test",email,password},{storage,applicationBaseUrl:"https://pre-v3.invalid",sender:{async send(message){token=new URL(message.verificationUrl).searchParams.get("token")!;}}});
      assert.ok(token);const account=await activateLocalAccount(token,{storage});assert.ok(account);
      assert.equal(await activateLocalAccount(token,{storage}),undefined);
      const auth=await storage.getAuthenticationUser(account.id);assert.ok(auth?.passwordHash);
      assert.equal(await verifyPassword(password,auth.passwordHash),true);return account.id;
    }
    const seller=await register("seller"),buyer=await register("buyer"),reviewer=await register("reviewer"),admin=await register("admin"),ordinary=await register("ordinary");
    const principal=randomUUID();
    await client.query(`INSERT INTO public.platform_principals(id,user_id,status,created_at,updated_at) VALUES($1,$2,'active',now(),now()),($3,$4,'active',now(),now())`,[principal,reviewer,randomUUID(),admin]);
    const context=()=>({admin:{userId:reviewer,principalId:principal,roles:[],permissions:PLATFORM_OWNER_ADMIN_PERMISSIONS,assurance:"recent_step_up",isPlatformOwner:false,authority:{contractVersion:"platform-authority/v1",state:"resolved",authenticatedUserId:reviewer,principalId:principal,activeRoles:[],permissions:[]}},requestId:randomUUID(),correlationId:randomUUID()} as any);
    const vre=createVreService(pool as any);
    const commodity={id:`urea46-${suffix}`,name:"Urea 46% Granular",type:"agricultural"};
    await client.query(`INSERT INTO public.commodities(id,name,type,description,specifications,created_at) VALUES($1,$2,'agricultural','MVP Urea 46 test profile','{}'::jsonb,now())`,[commodity.id,commodity.name]);
    async function verifyOrganization(owner:string,label:string){
      t.diagnostic(`Starting canonical Organization verification: ${label}`);
      const created=await app.createOrganization(owner,{legalName:label,tradingNames:[],organizationType:"company",jurisdiction:"AE",registrationIdentifiers:[{scheme:"license",value:"123"}],declaredActivities:[{code:commodity.type}]});assert.equal(created.status,"created");
      const organizationId=created.organizationId!,profileRevisionId=created.profileRevisionId!;
      const assertions=[{assertionCode:"evidence_category",value:"organization_existence"},{assertionCode:"evidence_category",value:"representative_association"},{assertionCode:"document_type",value:"business_registration"},{assertionCode:"registration_identifier",value:"license:123"},{assertionCode:"legal_name",value:label},{assertionCode:"registration_jurisdiction",value:"AE"},{assertionCode:"association_asserted",value:"true"},{assertionCode:"representative_reference",value:owner},{assertionCode:"organization.activity_code",value:commodity.type},{assertionCode:"activity.commodity_id",value:commodity.id},{assertionCode:"activity.commodity_classification",value:commodity.type}];
      assert.equal((await app.submitOrganizationEvidence(ordinary,organizationId,profileRevisionId,{assertions})).status,"forbidden");
      assert.equal((await app.submitOrganizationEvidence(owner,organizationId,profileRevisionId,{assertions})).status,"created");
      const self=await app.initiateOrganizationVerification(owner,organizationId,profileRevisionId);assert.notEqual(self.trustState,"trusted");
      const ineligible=await participation.resolveCurrentOrganizationParticipationEligibility({organizationId,userId:owner});assert.ok(ineligible.status!=="resolved"||ineligible.result.outcome!=="eligible");
      const source=await loadReviewContext({query} as any,organizationId,profileRevisionId);
      const review={organizationId,profileRevisionId,evidenceId:source.evidence!.evidenceId,evidenceVersion:source.evidence!.evidenceVersion,evidenceDigest:contentDigest(source.evidence),outcome:"confirmed",sourceReference:"test-only:independent-registry",reason:"Independent identity and representative confirmation"};
      const own=context();own.admin.userId=owner;own.admin.principalId=randomUUID();
      await client.query(`INSERT INTO public.platform_principals(id,user_id,status,created_at,updated_at) VALUES($1,$2,'active',now(),now())`,[own.admin.principalId,owner]);
      await assert.rejects(vre.recordReview(own,review),{code:"independent_reviewer_required"});
      await vre.recordReview(context(),review);
      const result=await reevaluateOrganization(vre,context(),{organizationId,profileRevisionId,trigger:"reverification",reason:"Independent review completed"});assert.equal(result.trust,"trusted");
      const eligible=await participation.resolveCurrentOrganizationParticipationEligibility({organizationId,userId:owner});assert.equal(eligible.status,"resolved");if(eligible.status==="resolved")assert.equal(eligible.result.outcome,"eligible");
      return organizationId;
    }
    const sellerOrg=await verifyOrganization(seller,"Seller Test Company"),buyerOrg=await verifyOrganization(buyer,"Buyer Test Company");
    const draft=await drafts.createOwnedDraftOffer(seller,{commodityId:commodity.id,offerType:"sell",quantity:"100",unit:"MT",amountPerUnit:"300",currency:"USD",location:"Jubail",validUntil:new Date(Date.now()+86_400_000).toISOString()});
    assert.ok(await drafts.updateOwnedDraftOffer(seller,draft.id,{quantity:"120"}));
    assert.equal((await trading.createOrder({offerId:draft.id,buyerUserId:buyer,buyerOrganizationId:buyerOrg,quantity:"20"})).ok,false);
    assert.equal((await app.submitOfferEvidence(seller,draft.id,{assertions:[{assertionCode:"document_type",value:"offer_specification"},{assertionCode:"commodity",value:commodity.name}]})).status,"created");
    assert.ok(await drafts.submitOwnedDraftOffer(seller,draft.id));assert.equal(await drafts.updateOwnedDraftOffer(seller,draft.id,{quantity:"130"}),undefined);
    const work=await processNextVerificationCommand();assert.ok(work);assert.equal(work.decision,"approved");assert.equal(work.workflowResult,"applied");
    assert.ok((await getPublishedMarketplaceOfferRecords()).some(record=>record.offer.id===draft.id));
    assert.equal((await trading.createOrder({offerId:draft.id,buyerUserId:ordinary,buyerOrganizationId:buyerOrg,quantity:"20"})).ok,false);
    assert.equal((await trading.createOrder({offerId:draft.id,buyerUserId:buyer,buyerOrganizationId:buyerOrg,quantity:"121"})).ok,false);
    const order=await trading.createOrder({offerId:draft.id,buyerUserId:buyer,buyerOrganizationId:buyerOrg,quantity:"20"});assert.ok(order.ok);if(!order.ok)return;
    assert.equal(order.value.terms.totalAmount,"6000");assert.equal((await trading.acceptOrder(order.value.orderId,ordinary)).ok,false);
    assert.ok((await trading.acceptOrder(order.value.orderId,seller)).ok);assert.equal((await trading.acceptOrder(order.value.orderId,seller)).ok,false);
    assert.equal((await trading.createContract(order.value.orderId,ordinary)).ok,false);const createdContract=await trading.createContract(order.value.orderId,buyer);assert.ok(createdContract.ok);if(!createdContract.ok)return;assert.equal((await trading.createContract(order.value.orderId,buyer)).ok,false);
    assert.equal((await reads.listCanonicalOrdersForUser(seller)).length,1);assert.equal((await reads.listCanonicalContractsForUser(buyer)).length,1);assert.equal((await reads.listCanonicalContractsForUser(ordinary)).length,0);
    let closureClock=Date.now();const closure=createMvpClosureService(pool as any,()=>new Date(closureClock++));
    const completeTerms={sellerRepresentative:"Seller Authorized Signer",buyerRepresentative:"Buyer Authorized Signer",sellerAddress:{countryCode:"SA",locality:"Jubail",addressLines:["Industrial Area"]},buyerAddress:{countryCode:"AE",locality:"Dubai",addressLines:["Trade Centre"]},grade:"Granular 46% N",productDescription:"Granular Urea fertilizer",origin:"Saudi Arabia",producer:"Test producer supported by accepted terms",specifications:[{code:"NITROGEN",label:"Nitrogen",value:"46.0",unit:"%",sourceReference:"offer-evidence"},{code:"BIURET",label:"Biuret",value:"agreed",unit:"%",sourceReference:"offer-evidence"},{code:"MOISTURE",label:"Moisture",value:"agreed",unit:"%",sourceReference:"offer-evidence"},{code:"PARTICLE_SIZE",label:"Particle size distribution",value:"agreed",sourceReference:"offer-evidence"},{code:"APPEARANCE",label:"Appearance",value:"white granular",sourceReference:"offer-evidence"}],quantityTolerancePercent:"5",pricingBasis:"Fixed accepted Order unit price",incoterm:"CFR" as const,namedPlace:"Jebel Ali Port, UAE",shipmentWindowStart:"2026-10-01T00:00:00.000Z",shipmentWindowEnd:"2026-10-31T00:00:00.000Z",packaging:"50 kg bags",partialShipmentPolicy:"NOT_ALLOWED" as const,inspection:{required:true,bodyOrMethod:"SGS or agreed equivalent",inspectionPoint:"Load port",quantityDetermination:"Draft survey",qualityDetermination:"Certificate of analysis",finalityAndClaims:"Final at load port subject to documented fraud or manifest error"},payment:{method:"Irrevocable documentary letter of credit",timing:"At sight against compliant documents",currency:"USD",bankDocumentConditions:"Agreed documentary conditions"},requiredDocuments:["Commercial Invoice","Bill of Lading","Certificate of Origin","Quality Certificate","Quantity Certificate","Packing List"],legal:{riskTransfer:"At loading on board under CFR Incoterms 2020",titleTransfer:"Upon Seller receipt of cleared funds",governingLaw:"Laws of the Kingdom of Saudi Arabia",cisgTreatment:"LEGAL_REVIEW_REQUIRED" as const,disputeResolution:"ICC_ARBITRATION" as const,arbitrationInstitution:"ICC" as const,arbitrationSeat:"Riyadh, Saudi Arabia",arbitrationLanguage:"English",arbitratorCount:1 as const,forceMajeureTreatment:"Original clause aligned conceptually with ICC Force Majeure Clause 2020; notice and mitigation required",hardshipTreatment:"Good-faith renegotiation followed by termination if unresolved"},platformFeeTreatment:"Fees separately invoiced",specialConditions:[]};
    assert.equal((await closure.prepare(createdContract.value.contractId,ordinary,completeTerms)).ok,false);
    const missing=await closure.prepare(createdContract.value.contractId,seller,{...completeTerms,namedPlace:""});assert.ok(missing.ok);if(!missing.ok)return;assert.equal(missing.value.readiness?.outcome,"NOT_READY");
    const prepared=await closure.prepare(createdContract.value.contractId,seller,completeTerms);assert.ok(prepared.ok);if(!prepared.ok||!prepared.value.snapshotId)return;assert.equal(prepared.value.readiness?.outcome,"READY");
    assert.equal((await closure.approveTerms(createdContract.value.contractId,ordinary,prepared.value.snapshotId,prepared.value.contractVersion)).ok,false);
    const sellerApproval=await closure.approveTerms(createdContract.value.contractId,seller,prepared.value.snapshotId,prepared.value.contractVersion);assert.ok(sellerApproval.ok);if(!sellerApproval.ok)return;assert.equal(sellerApproval.value.state,"CONTRACT_PREPARATION");
    const buyerApproval=await closure.approveTerms(createdContract.value.contractId,buyer,prepared.value.snapshotId,prepared.value.contractVersion);assert.ok(buyerApproval.ok);if(!buyerApproval.ok)return;assert.equal(buyerApproval.value.state,"AWAITING_SELLER_SIGNATURE");assert.ok(buyerApproval.value.previewSha256);
    assert.equal((await closure.grantSigningAuthority(sellerOrg,ordinary,ordinary,true)).ok,false);assert.equal((await closure.grantSigningAuthority(sellerOrg,seller,seller,false)).ok,false);
    assert.ok((await closure.grantSigningAuthority(sellerOrg,seller,seller,true)).ok);assert.ok((await closure.grantSigningAuthority(buyerOrg,buyer,buyer,true)).ok);
    assert.equal((await closure.sign(createdContract.value.contractId,buyer,{snapshotId:prepared.value.snapshotId,contractVersion:prepared.value.contractVersion,previewSha256:buyerApproval.value.previewSha256!,explicitConsent:true,recentStepUp:true})).ok,false);
    assert.equal((await closure.sign(createdContract.value.contractId,seller,{snapshotId:prepared.value.snapshotId,contractVersion:prepared.value.contractVersion+1,previewSha256:buyerApproval.value.previewSha256!,explicitConsent:true,recentStepUp:true})).ok,false);
    const sellerSigned=await closure.sign(createdContract.value.contractId,seller,{snapshotId:prepared.value.snapshotId,contractVersion:prepared.value.contractVersion,previewSha256:buyerApproval.value.previewSha256!,explicitConsent:true,recentStepUp:true});assert.ok(sellerSigned.ok);if(!sellerSigned.ok)return;assert.equal(sellerSigned.value.state,"AWAITING_BUYER_SIGNATURE");assert.equal(sellerSigned.value.signatures.length,1);
    const duplicateSeller=await closure.sign(createdContract.value.contractId,seller,{snapshotId:prepared.value.snapshotId,contractVersion:prepared.value.contractVersion,previewSha256:buyerApproval.value.previewSha256!,explicitConsent:true,recentStepUp:true});assert.ok(duplicateSeller.ok);
    const buyerSigned=await closure.sign(createdContract.value.contractId,buyer,{snapshotId:prepared.value.snapshotId,contractVersion:prepared.value.contractVersion,previewSha256:buyerApproval.value.previewSha256!,explicitConsent:true,recentStepUp:true});assert.ok(buyerSigned.ok);if(!buyerSigned.ok)return;assert.equal(buyerSigned.value.state,"EXECUTED");assert.equal(buyerSigned.value.signatures.length,2);assert.ok(buyerSigned.value.executedSha256);
    assert.equal((await closure.prepare(createdContract.value.contractId,seller,completeTerms)).ok,false);
    const artifact=await closure.artifact(createdContract.value.contractId,buyer,"EXECUTED");assert.ok(artifact.ok);if(artifact.ok){const {createHash}=await import("node:crypto");assert.equal(`sha256:${createHash("sha256").update(artifact.value.document_bytes).digest("hex")}`,artifact.value.document_sha256)}
    assert.ok((await closure.transition(createdContract.value.contractId,seller,"START_EXECUTION","Execution commenced under the executed Contract")).ok);
    assert.equal((await closure.transition(createdContract.value.contractId,buyer,"START_EXECUTION","Duplicate start")).ok,true);
    assert.ok((await closure.addEvidence(createdContract.value.contractId,seller,{evidenceType:"COMMERCIAL_INVOICE",reference:"test-only:invoice-001"})).ok);
    assert.equal((await closure.transition(createdContract.value.contractId,ordinary,"CONFIRM_DELIVERY","Unauthorized attempt")).ok,false);assert.equal((await closure.transition(createdContract.value.contractId,seller,"CONFIRM_DELIVERY","Seller cannot confirm receipt")).ok,false);
    assert.ok((await closure.transition(createdContract.value.contractId,buyer,"CONFIRM_DELIVERY","Buyer confirms delivery against referenced evidence")).ok);assert.equal((await closure.transition(createdContract.value.contractId,buyer,"CONFIRM_SETTLEMENT","Buyer cannot confirm Seller receipt")).ok,false);
    assert.ok((await closure.addEvidence(createdContract.value.contractId,seller,{evidenceType:"SETTLEMENT_CONFIRMATION",reference:"test-only:settlement-001",description:"Seller assertion only; TUTELA does not move or verify funds"})).ok);
    assert.ok((await closure.transition(createdContract.value.contractId,seller,"CONFIRM_SETTLEMENT","Seller confirms receipt; TUTELA moved no funds")).ok);
    await client.query("SAVEPOINT dispute_probe");assert.ok((await closure.openDispute(createdContract.value.contractId,buyer,"Material delivery dispute requiring human review")).ok);const blockedClose=await closure.transition(createdContract.value.contractId,buyer,"CLOSE_TRADE","Closeout blocked");assert.equal(blockedClose.ok,false);await client.query("ROLLBACK TO SAVEPOINT dispute_probe");await client.query("RELEASE SAVEPOINT dispute_probe");
    const closed=await closure.transition(createdContract.value.contractId,buyer,"CLOSE_TRADE","Delivery and settlement confirmed; no unresolved dispute");assert.ok(closed.ok);if(closed.ok)assert.equal(closed.value.state,"TRADE_CLOSED");assert.ok((await closure.transition(createdContract.value.contractId,buyer,"CLOSE_TRADE","Idempotent closeout")).ok);
    await client.query("SAVEPOINT immutable_probe");
    await assert.rejects(client.query(`UPDATE public.mvp_contract_events SET reason='tampered' WHERE transaction_id=$1`,[closed.ok?closed.value.transactionId:""]));
    await client.query("ROLLBACK TO SAVEPOINT immutable_probe");
    await client.query("RELEASE SAVEPOINT immutable_probe");
    const before=await createVreReadModel({query} as any).verificationHistory(sellerOrg),guard=createEnforcementGuard({query} as any);
    let previousAction:string|null=null;
    for(const state of ["MONITORED","RESTRICTED","SUSPENDED","BLOCKED","TERMINATED","NORMAL"] as const){
      const opened=await vre.openCase(context(),{scope:"ORGANIZATION",subjectId:sellerOrg,riskAssessmentId:null,evidenceReference:"test-only:case",reason:"Isolated enforcement regression"});
      const result=await vre.decide(context(),{caseId:opened.id,expectedActionId:previousAction,state,restrictedActions:state==="RESTRICTED"?["order.create"]:[],reason:"Explicit test decision",remediation:"Review test evidence",reviewAt:new Date(Date.now()+86_400_000).toISOString()});previousAction=result.id;
      assert.equal(await guard.allows("order.create",[{scope:"ORGANIZATION",subjectId:sellerOrg}]),["NORMAL","MONITORED"].includes(state));
      assert.equal(await guard.allows("offer.edit",[{scope:"ORGANIZATION",subjectId:sellerOrg}]),["NORMAL","MONITORED","RESTRICTED"].includes(state));
      assert.equal(await guard.allows("order.create",[{scope:"USER",subjectId:seller}]),true);
      assert.equal((await reads.listCanonicalOrdersForUser(seller)).length,1);assert.equal((await reads.listCanonicalContractsForUser(buyer)).length,1);
    }
    const userCase=await vre.openCase(context(),{scope:"USER",subjectId:seller,riskAssessmentId:null,evidenceReference:"test-only:user-case",reason:"Isolated user-scope enforcement regression"});
    const blockedUser=await vre.decide(context(),{caseId:userCase.id,expectedActionId:null,state:"BLOCKED",restrictedActions:[],reason:"Explicit user decision",remediation:"Review test evidence",reviewAt:new Date(Date.now()+86_400_000).toISOString()});
    assert.equal(await guard.allows("offer.create",[{scope:"USER",subjectId:seller}]),false);
    const userLift=await vre.openCase(context(),{scope:"USER",subjectId:seller,riskAssessmentId:null,evidenceReference:"test-only:user-lift",reason:"Explicit user-scope restoration regression"});
    await vre.decide(context(),{caseId:userLift.id,expectedActionId:blockedUser.id,state:"NORMAL",restrictedActions:[],reason:"Explicit user restoration",remediation:"Completed",reviewAt:new Date(Date.now()+86_400_000).toISOString()});
    assert.equal(await guard.allows("offer.create",[{scope:"USER",subjectId:seller}]),true);
    const after=await createVreReadModel({query} as any).verificationHistory(sellerOrg);
    // Replay may mint a fresh replay fingerprint; canonical decision/trust and
    // immutable review history must remain unchanged by Enforcement.
    const canonical=(value:typeof before)=>({decisions:value.decisions.map(({replayFingerprint,...item})=>item),reviews:value.reviews});
    assert.deepEqual(canonical(after),canonical(before));
  }finally{pool.query=originalQuery;pool.connect=originalConnect;await client.query("ROLLBACK").catch(()=>undefined);await client.end();await pool.end();}
});
