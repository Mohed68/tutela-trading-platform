import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { requireTestDatabase } from "../auth/test-database.js";

test("real V2 journey: registration, independent review, engines/replay, publication, order, contract", {timeout:900_000}, async(t)=>{
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
    const commodity=(await client.query(`SELECT id,name,type::text FROM public.commodities WHERE name='West Texas Intermediate (WTI) Crude Oil' LIMIT 1`)).rows[0];assert.ok(commodity);
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
    const draft=await drafts.createOwnedDraftOffer(seller,{commodityId:commodity.id,offerType:"sell",quantity:"100",unit:"bbl",amountPerUnit:"75.50",currency:"USD",location:"Houston",validUntil:new Date(Date.now()+86_400_000).toISOString()});
    assert.ok(await drafts.updateOwnedDraftOffer(seller,draft.id,{quantity:"120"}));
    assert.equal((await trading.createOrder({offerId:draft.id,buyerUserId:buyer,buyerOrganizationId:buyerOrg,quantity:"20"})).ok,false);
    assert.equal((await app.submitOfferEvidence(seller,draft.id,{assertions:[{assertionCode:"document_type",value:"offer_specification"},{assertionCode:"commodity",value:commodity.name}]})).status,"created");
    assert.ok(await drafts.submitOwnedDraftOffer(seller,draft.id));assert.equal(await drafts.updateOwnedDraftOffer(seller,draft.id,{quantity:"130"}),undefined);
    const work=await processNextVerificationCommand();assert.ok(work);assert.equal(work.decision,"approved");assert.equal(work.workflowResult,"applied");
    assert.ok((await getPublishedMarketplaceOfferRecords()).some(record=>record.offer.id===draft.id));
    assert.equal((await trading.createOrder({offerId:draft.id,buyerUserId:ordinary,buyerOrganizationId:buyerOrg,quantity:"20"})).ok,false);
    assert.equal((await trading.createOrder({offerId:draft.id,buyerUserId:buyer,buyerOrganizationId:buyerOrg,quantity:"121"})).ok,false);
    const order=await trading.createOrder({offerId:draft.id,buyerUserId:buyer,buyerOrganizationId:buyerOrg,quantity:"20"});assert.ok(order.ok);if(!order.ok)return;
    assert.equal(order.value.terms.totalAmount,"1510");assert.equal((await trading.acceptOrder(order.value.orderId,ordinary)).ok,false);
    assert.ok((await trading.acceptOrder(order.value.orderId,seller)).ok);assert.equal((await trading.acceptOrder(order.value.orderId,seller)).ok,false);
    assert.equal((await trading.createContract(order.value.orderId,ordinary)).ok,false);assert.ok((await trading.createContract(order.value.orderId,buyer)).ok);assert.equal((await trading.createContract(order.value.orderId,buyer)).ok,false);
    assert.equal((await reads.listCanonicalOrdersForUser(seller)).length,1);assert.equal((await reads.listCanonicalContractsForUser(buyer)).length,1);assert.equal((await reads.listCanonicalContractsForUser(ordinary)).length,0);
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
