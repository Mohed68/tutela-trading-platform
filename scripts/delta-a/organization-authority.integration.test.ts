import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { createOrganizationAuthorityService } from "../../server/organization-authority/service.js";

const connectionString=process.env.TEST_DATABASE_URL;
if(!connectionString||connectionString===process.env.DATABASE_URL)throw new Error("DISTINCT_TEST_DATABASE_REQUIRED");
// Neon/WebSocket test transport is intentionally kept to one real PostgreSQL
// session so a cold connection cannot fan out into avoidable TLS handshakes.
const pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:45_000});
test.after(async()=>pool.end());

test("workspace and Action Center projections enforce tenant membership",async()=>{
  const fixture=(await pool.query<{organization_id:string;owner_id:string;outsider_id:string}>(`SELECT membership.organization_id,membership.user_id owner_id,(SELECT account.id FROM public.users account WHERE account.id<>membership.user_id AND NOT EXISTS(SELECT 1 FROM public.organization_memberships own WHERE own.organization_id=membership.organization_id AND own.user_id=account.id) LIMIT 1) outsider_id FROM public.organization_memberships membership WHERE membership.role='owner' AND membership.status='active' LIMIT 1`)).rows[0];
  assert.ok(fixture?.organization_id&&fixture.owner_id&&fixture.outsider_id,"test database requires one owner and outsider");
  const service=createOrganizationAuthorityService(pool);
  const owner=await service.workspace(fixture.owner_id,fixture.organization_id);assert.equal(owner.ok,true);
  const outsider=await service.workspace(fixture.outsider_id,fixture.organization_id);assert.deepEqual(outsider,{ok:false,code:"not_found"});
  const center=await service.actionCenter(fixture.owner_id);assert.equal(center.ok,true);if(center.ok)assert.equal(center.value.authorityNotice.includes("do not grant authority"),true);
});

test("unauthorized invitation and mandate paths fail before mutation",async()=>{
  const fixture=(await pool.query<{organization_id:string;owner_id:string;outsider_id:string}>(`SELECT membership.organization_id,membership.user_id owner_id,(SELECT account.id FROM public.users account WHERE account.id<>membership.user_id AND NOT EXISTS(SELECT 1 FROM public.organization_memberships own WHERE own.organization_id=membership.organization_id AND own.user_id=account.id) LIMIT 1) outsider_id FROM public.organization_memberships membership WHERE membership.role='owner' AND membership.status='active' LIMIT 1`)).rows[0];
  assert.ok(fixture?.outsider_id);
  const service=createOrganizationAuthorityService(pool);
  assert.deepEqual(await service.invite(fixture.outsider_id,fixture.organization_id,"blocked@example.com",24),{ok:false,code:"authority_required"});
  assert.deepEqual(await service.grantMandate(fixture.outsider_id,fixture.organization_id,{userId:fixture.owner_id,actionScope:["contract.sign"],contractTypeScope:["*"],signatureEligibility:"INDIVIDUAL",validFrom:new Date().toISOString(),reason:"must fail"}),{ok:false,code:"authority_required"});
  const count=await pool.query(`SELECT 1 FROM public.organization_membership_invitations WHERE normalized_email='blocked@example.com'`);assert.equal(count.rowCount,0);
});

test("commercial and integrity foundations expose no manufactured activation",async()=>{
  const user=(await pool.query<{id:string}>(`SELECT id FROM public.users WHERE auth_provider='local' AND login_enabled=true LIMIT 1`)).rows[0];assert.ok(user);
  const service=createOrganizationAuthorityService(pool),foundation=await service.foundations(user.id);assert.equal(foundation.ok,true);
  if(foundation.ok){assert.equal(foundation.value.notices.paymentCollection,"NOT_ACTIVATED");assert.equal(foundation.value.notices.blockchain,"NOT_ACTIVATED");}
  const manufactured=await pool.query(`SELECT (SELECT count(*) FROM public.platform_terms_versions WHERE status='ACTIVE' AND approved_authority_reference IS NULL) bad_terms,(SELECT count(*) FROM public.commercial_fee_schedules WHERE status='ACTIVE' AND approved_authority_reference IS NULL) bad_fees,(SELECT count(*) FROM public.external_integrity_anchors WHERE confirmation_status='CONFIRMED' AND confirmation_receipt IS NULL) bad_anchors`);
  assert.deepEqual(manufactured.rows[0],{bad_terms:"0",bad_fees:"0",bad_anchors:"0"});
});
