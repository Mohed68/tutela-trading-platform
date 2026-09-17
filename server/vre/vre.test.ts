import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { authorizeVre, assertTransition, createVreService, signalSchema, decisionSchema, states, type CommandContext } from './service.js';
import { PLATFORM_ROLE_PERMISSION_MATRIX } from '../platform-authority/policy.js';
import { PLATFORM_OWNER_ADMIN_PERMISSIONS } from '../admin-security/policy.js';
import { createMinimumTradeTrustOrganizationPolicyBundle, createOrganizationVerificationPolicyV2 } from '../trade-trust-policy/organizationVerificationPolicy.js';

const ctx = (permissions: readonly string[], assurance='recent_step_up') => ({admin:{principalId:'principal',userId:'user',permissions,assurance,roles:['OPERATIONS']},
  requestId:randomUUID(),correlationId:randomUUID()}) as CommandContext;

test('atomic VRE permissions preserve role vocabulary and stronger decision assurance',()=>{
  assert.throws(()=>authorizeVre(ctx([]),'enforcement.decide'));
  assert.throws(()=>authorizeVre(ctx(['enforcement.decide'],'mfa'),'enforcement.decide'));
  assert.doesNotThrow(()=>authorizeVre(ctx(['enforcement.decide']),'enforcement.decide'));
  assert.ok(!PLATFORM_ROLE_PERMISSION_MATRIX.SUPPORT.includes('enforcement.decide'));
  assert.ok(!PLATFORM_ROLE_PERMISSION_MATRIX.OPERATIONS.includes('enforcement.decide'));
  assert.ok(PLATFORM_ROLE_PERMISSION_MATRIX.PLATFORM_ADMIN.includes('enforcement.decide'));
  assert.ok(PLATFORM_ROLE_PERMISSION_MATRIX.VERIFICATION_REVIEWER.includes('verification.review.submit'));
  assert.ok(PLATFORM_OWNER_ADMIN_PERMISSIONS.includes('verification.review.submit'));
});
test('state transitions require an explicit change and preserve reversible history',()=>{
  for (const from of states) for (const to of states) {
    if (from === to) assert.throws(()=>assertTransition(from,to));
    else assert.doesNotThrow(()=>assertTransition(from,to));
  }
  assert.throws(()=>assertTransition('trusted','BLOCKED'));
  assert.equal(decisionSchema.safeParse({state:'BLOCKED'}).success,false);
});
test('HTTP signal cannot forge provider/AI authority or unsupported scope',()=>{
  const signal = {scope:'USER',subjectId:'user',signalType:'document_discrepancy',sourceReference:'analyst',severity:'medium',
    evidenceReference:'evidence:123',observedAt:new Date().toISOString(),reason:'Investigate a documented discrepancy'};
  assert.equal(signalSchema.safeParse(signal).success,true);
  for (const source of ['provider','automated','ai_advisory']) assert.equal(signalSchema.safeParse({...signal,source}).success,false);
  assert.equal(signalSchema.safeParse({...signal,scope:'PLATFORM_WIDE'}).success,false);
});
test('audit failure rolls back a signal and never executes hidden enforcement',async()=>{
  const calls: string[] = [];
  const db = {async query(sql: string) { calls.push(sql); if(sql.includes('INSERT INTO public.security_audit_events')) throw new Error('audit unavailable');
    return {rows:sql.startsWith('SELECT')?[{id:'user'}]:[],rowCount:1}; },release() {calls.push('release');}};
  const service=createVreService({async connect(){return db;}});
  await assert.rejects(service.createSignal(ctx(['risk.signal.create']),{scope:'USER',subjectId:'user',signalType:'document_discrepancy',
    sourceReference:'analyst',severity:'medium',evidenceReference:'evidence:1',observedAt:new Date(Date.now()-1000).toISOString(),reason:'Documented discrepancy'}));
  assert.ok(calls.includes('ROLLBACK')); assert.ok(!calls.includes('COMMIT'));
  assert.ok(!calls.some(sql=>sql.includes('vre_enforcement')));
});
test('V1 policy is preserved and V2 requires independent confirmation',()=>{
  const old=createMinimumTradeTrustOrganizationPolicyBundle(), future=createOrganizationVerificationPolicyV2('2026-09-10T00:00:00.000Z');
  assert.equal(old.policySet.policySetVersion,'minimum-trade-trust-organization-policy/v1');
  assert.equal(old.rules.length,5); assert.equal(future.rules.length,6);
  const independent=future.implementationSet.bindings.find(b=>b.rule.ruleId==='organization-independent-confirmation-required');
  assert.ok(independent); assert.equal(independent.implementation.evaluate({evidenceFacts:[]}), 'manual_review_required');
});
test('VRE persistence is immutable and the V2 command guard never rewrites historical business facts',()=>{
  const migration=readFileSync(new URL('../../migrations/0022_vre_baseline.sql',import.meta.url),'utf8');
  assert.doesNotMatch(migration,/\b(?:ALTER TABLE|DROP TABLE|TRUNCATE|UPDATE public\.|DELETE FROM)\b/i);
  assert.match(migration,/BEFORE UPDATE OR DELETE/);
  const service=readFileSync(new URL('./service.ts',import.meta.url),'utf8');
  assert.doesNotMatch(service,/(?:UPDATE|DELETE FROM) public\.(?:offers|orders|contracts|organization_verification|platform_ownership)/i);
  assert.match(service,/integrationStatus:"ACTIVE_V2_COMMAND_GUARD"/);
  assert.match(service,/vre_enforcement_action_restrictions/);
});
