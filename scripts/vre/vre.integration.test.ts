import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { requireTestDatabase } from '../auth/test-database.js';
import { createVreService, loadReviewContext, type CommandContext } from '../../server/vre/service.js';
import { PLATFORM_OWNER_ADMIN_PERMISSIONS } from '../../server/admin-security/policy.js';
import { contentDigest } from '../../server/vre/verificationReview.js';
import { createOrganizationMembership } from '../../server/organization-membership/index.js';

test('TEST PostgreSQL: independent review, canonical V2 replay, risk separation, explicit reversible enforcement and atomic audit', {timeout:300_000},async()=>{
  const identity=requireTestDatabase();
  const saved={DATABASE_URL:process.env.DATABASE_URL,NODE_ENV:process.env.NODE_ENV,TUTELA_TEST_NODE_POSTGRES:process.env.TUTELA_TEST_NODE_POSTGRES};
  process.env.DATABASE_URL=identity.connectionString;process.env.NODE_ENV='test';process.env.TUTELA_TEST_NODE_POSTGRES='true';
  const client=new Client({connectionString:identity.connectionString,connectionTimeoutMillis:30_000});
  await client.connect().catch(async error=>{await client.end();throw error;});
  const suffix=randomUUID(), owner=`vre-owner-${suffix}`, reviewer=`vre-reviewer-${suffix}`, principal=`vre-principal-${suffix}`;
  const org=`vre-org-${suffix}`, profileId=`vre-profile-${suffix}`, evidenceId=`vre-evidence-${suffix}`;
  const context=():CommandContext=>({admin:{userId:reviewer,principalId:principal,roles:[],permissions:PLATFORM_OWNER_ADMIN_PERMISSIONS,
    assurance:'recent_step_up',isPlatformOwner:true,authority:{contractVersion:'platform-authority/v1',state:'resolved',authenticatedUserId:reviewer,principalId:principal,activeRoles:[],permissions:[]}},requestId:randomUUID(),correlationId:randomUUID()});
  let failAudit=false;
  const db={async query(sql:string,values?:any[]){
    // Actual SQL and transaction savepoints preserve fixture rollback, including audit failures.
    if(sql==='BEGIN')return client.query('SAVEPOINT vre_command');
    if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT vre_command');
    if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT vre_command');
    if(failAudit&&sql.includes('INSERT INTO public.security_audit_events'))throw new Error('TEST_AUDIT_FAILURE');
    return client.query(sql,values);
  },release(){}};
  const service=createVreService({async connect(){return db;}});
  let runtimePool: {end():Promise<void>}|undefined;
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO public.users(id,email,role,auth_provider,login_enabled,credential_status)
      VALUES ($1,$2,'trader','local',true,'active'),($3,$4,'trader','local',true,'active')`,[owner,`${suffix}-owner@vre.invalid`,reviewer,`${suffix}-review@vre.invalid`]);
    await client.query(`INSERT INTO public.platform_principals(id,user_id,status,created_at,updated_at) VALUES ($1,$2,'active',now(),now()),($3,$4,'active',now(),now())`,[principal,reviewer,`${principal}-owner`,owner]);
    const profile={organization_id:org,organization_profile_revision_id:profileId,organization_profile_revision_sequence:1,
      organization_profile_fingerprint:`profile-fingerprint-${suffix}`,legal_identity_projection:{legal_name:'VRE Test Organization',trading_names:[],
        registration_jurisdiction:'AE',registration_identifiers:[{scheme:'license',value:'123'}]},organization_type:'company',jurisdiction:'AE',
      declared_activity_projection:{activities:[]},approved_disclosure_projection:{legal_name:'VRE Test Organization',trading_names:[],organization_type:'company',jurisdiction:'AE'},
      organization_lifecycle:'active',registry_contract_version:'organization_registry_profile_revision.v1',published_at:new Date(Date.now()-60_000).toISOString()};
    await client.query(`INSERT INTO public.organization_registry_profile_revisions(organization_id,organization_profile_revision_id,registry_contract_version,contract_payload,created_at,integrity_reference)
      VALUES ($1,$2,'organization_registry_profile_revision.v1',$3::jsonb,now()-interval '1 minute',$4)`,[org,profileId,JSON.stringify(profile),profile.organization_profile_fingerprint]);
    const membership=createOrganizationMembership({membershipId:`membership-${suffix}`,userId:owner,organizationId:org,role:'owner',status:'active',membershipVersion:1,
      effectiveFrom:profile.published_at,createdAt:profile.published_at,updatedAt:profile.published_at,provenanceReference:'test-owner-membership',integrityReference:'test-membership-integrity'});
    assert.ok(membership.ok);
    await client.query(`INSERT INTO public.organization_memberships(membership_id,user_id,organization_id,role,status,membership_version,effective_from,created_at,updated_at,provenance_reference,integrity_reference,membership_fingerprint)
      VALUES ($1,$2,$3,'owner','active',1,$4,$4,$4,$5,$6,$7)`,[membership.value.membershipId,owner,org,profile.published_at,membership.value.provenanceReference,membership.value.integrityReference,membership.value.membershipFingerprint]);
    const assertions=[{assertionCode:'evidence_category',value:'organization_existence'},{assertionCode:'evidence_category',value:'representative_association'},
      {assertionCode:'document_type',value:'business_registration'},{assertionCode:'registration_identifier',value:'license:123'},
      {assertionCode:'legal_name',value:'VRE Test Organization'},{assertionCode:'registration_jurisdiction',value:'AE'},
      {assertionCode:'association_asserted',value:'true'},{assertionCode:'representative_reference',value:owner}];
    const submittedAt=new Date(Date.now()-30_000).toISOString();
    const fingerprint=`sha256:${createHash('sha256').update(JSON.stringify({contractVersion:'evidence-provider/v1',evidenceId,evidenceVersion:'evidence-version-1',
      providerKind:'platform_submitted',subject:{subjectKind:'organization',subjectId:org,subjectVersion:profileId},assuranceLevel:'documentary',
      assertions:[...assertions].sort((a,b)=>a.assertionCode.localeCompare(b.assertionCode)),capturedAt:submittedAt,provenanceReference:'test-provenance',integrityReference:'test-integrity'})).digest('hex')}`;
    await client.query(`INSERT INTO public.platform_submitted_evidence(evidence_id,evidence_version,subject_kind,subject_id,subject_version,assertions,submitted_by,submitted_at,provenance_reference,integrity_reference,evidence_fingerprint)
      VALUES ($1,'evidence-version-1','organization',$2,$3,$4::jsonb,$5,$7,'test-provenance','test-integrity',$6)`,
    [evidenceId,org,profileId,JSON.stringify(assertions),owner,fingerprint,submittedAt]);
    const {createVreReadModel}=await import('../../server/vre/readModel.js');
    const {createTransactionalVerificationDatabase}=await import('../../server/trade-trust-application/verificationReadModelAdapter.js');
    const {executeProductionOrganizationVerification}=await import('../../server/trade-trust-application/organizationVerificationOrchestrator.js');
    runtimePool=(await import('../../server/db.js')).pool;
    const source=await loadReviewContext(db,org,profileId);
    const run=()=>executeProductionOrganizationVerification({actorUserId:owner,organizationId:org,profileRevisionId:profileId,profilePayload:profile},
      {database:createTransactionalVerificationDatabase(db),query:db,evidenceProvider:source.provider});
    const initial=await run();
    assert.equal(initial.workflowExecution.decisionTrustIntegrationExecution?.decision.outcome,'manual_review');
    assert.notEqual(initial.trustStatus?.status,'trusted');
    const reviewInput={organizationId:org,profileRevisionId:profileId,evidenceId,evidenceVersion:'evidence-version-1',evidenceDigest:contentDigest(source.evidence),
      outcome:'confirmed',sourceReference:'independent registry lookup:test-only',reason:'Independently confirmed exact identity and representative evidence'};
    const impersonated=context(); impersonated.admin={...impersonated.admin,userId:owner,principalId:`${principal}-owner`};
    await assert.rejects(service.recordReview(impersonated,reviewInput),{code:'independent_reviewer_required'});
    await assert.rejects(service.recordReview(context(),{...reviewInput,evidenceDigest:'0'.repeat(64)}));
    failAudit=true;await assert.rejects(service.recordReview(context(),reviewInput));failAudit=false;
    assert.equal((await client.query('SELECT count(*)::int AS n FROM public.vre_verification_reviews WHERE organization_id=$1',[org])).rows[0].n,0);
    await service.recordReview(context(),reviewInput);
    const {reevaluateOrganization}=await import('../../server/vre/reevaluate.js');
    const reverify={organizationId:org,profileRevisionId:profileId,trigger:'reverification',reason:'Independent review completed; legitimate reverification requested'};
    failAudit=true;await assert.rejects(reevaluateOrganization(service,context(),reverify));failAudit=false;
    assert.equal((await client.query('SELECT count(*)::int AS n FROM public.organization_verification_persistence_streams WHERE organization_id=$1',[org])).rows[0].n,1);
    const approved=await reevaluateOrganization(service,context(),reverify);
    assert.equal(approved.trust,'trusted');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM public.organization_participation_runtime_bindings WHERE organization_id=$1',[org])).rows[0].n,1);
    const history=await createVreReadModel(db).verificationHistory(org);
    assert.equal(history.decisions.length,2);
    assert.ok(history.decisions.some(d=>d.decision==='approved'));
    await service.recordReview(context(),{...reviewInput,outcome:'revision_requested',reason:'New independent review requests clarified evidence'});
    const revisited=await run();
    assert.notEqual(revisited.trustStatus?.status,'trusted');
    const preserved=await createVreReadModel(db).verificationHistory(org);
    assert.ok(preserved.decisions.some(d=>d.decision==='approved'&&d.trust==='trusted'));

    const signal=await service.createSignal(context(),{scope:'ORGANIZATION',subjectId:org,signalType:'document_discrepancy',sourceReference:'manual-review',
      severity:'medium',evidenceReference:'test-evidence:1',observedAt:new Date(Date.now()-1000).toISOString(),reason:'Documented discrepancy, not missing verification'});
    assert.equal((await client.query('SELECT count(*)::int AS n FROM public.vre_enforcement_cases WHERE subject_id=$1',[org])).rows[0].n,0);
    const assessment=await service.assess(context(),{signalId:signal.id,conclusion:'substantiated',reason:'Independent contextual assessment'});
    await service.dispose(context(),{assessmentId:assessment.id,disposition:'refer_for_case_review',reason:'Separate explicit review is warranted'});
    assert.equal((await client.query('SELECT count(*)::int AS n FROM public.vre_enforcement_actions WHERE subject_id=$1',[org])).rows[0].n,0);
    await assert.rejects(service.openCase(context(),{scope:'USER',subjectId:owner,riskAssessmentId:assessment.id,evidenceReference:'evidence:1',reason:'Wrong scope'}));
    const caseInput={scope:'ORGANIZATION',subjectId:org,riskAssessmentId:assessment.id,evidenceReference:'evidence:1',reason:'Explicitly open case from substantiated evidence'};
    const firstCase=await service.openCase(context(),caseInput);
    const decision={caseId:firstCase.id,expectedActionId:null,state:'RESTRICTED',restrictedActions:['order.create'],reason:'Governed scope review',remediation:'Provide independently confirmed revised evidence',reviewAt:new Date(Date.now()+86_400_000).toISOString()};
    failAudit=true;await assert.rejects(service.decide(context(),decision));failAudit=false;
    assert.equal((await client.query('SELECT count(*)::int AS n FROM public.vre_enforcement_decisions WHERE case_id=$1',[firstCase.id])).rows[0].n,0);
    const action=await service.decide(context(),decision);
    assert.equal(action.integrationStatus,'ACTIVE_V2_COMMAND_GUARD');
    await assert.rejects(service.decide(context(),decision));
    const liftingCase=await service.openCase(context(),{...caseInput,reason:'Remediation review and explicit lifting'});
    await assert.rejects(service.decide(context(),{...decision,caseId:liftingCase.id,state:'NORMAL',restrictedActions:[]}));
    await service.decide(context(),{...decision,caseId:liftingCase.id,expectedActionId:action.id,state:'NORMAL',restrictedActions:[],reason:'Confirmed remediation; explicitly lift prior restriction'});
    const actions=await createVreReadModel(db).enforcementHistory('ORGANIZATION',org);
    assert.deepEqual(actions.map(a=>a.state),['NORMAL','RESTRICTED']);
    await client.query('SAVEPOINT immutable_test');
    await assert.rejects(client.query('UPDATE public.vre_enforcement_actions SET state=$1 WHERE id=$2',['NORMAL',action.id]));
    await client.query('ROLLBACK TO SAVEPOINT immutable_test');
    assert.equal((await createVreReadModel(db).verificationHistory(org)).decisions.length,3);
  } finally {
    await client.query('ROLLBACK');await client.end();await runtimePool?.end();
    for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
