import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { configurePrivilegedAdminAuthorization } from '../adminAuth.js';
import { markAuthenticated, markMfaSatisfied, markStepUpSatisfied } from '../session-assurance/index.js';

test('actual VRE HTTP routes enforce canonical roles, MFA and step-up before domain writes',{timeout:60_000},async()=>{
  const prior=process.env.DATABASE_URL;
  process.env.DATABASE_URL='postgresql://test:test@127.0.0.1:1/vre-unit-no-database';
  const {registerVreRoutes}=await import('./routes.js');
  const {pool}=await import('../db.js');
  let role='SUPPORT',level='mfa',authenticated=true;
  const now=new Date().toISOString();
  configurePrivilegedAdminAuthorization({
    async findPrincipalByUserId(userId){return {principalId:'principal',userId,status:'active',createdAt:now};},
    async findPrincipalById(){return undefined;},async findRoleAssignmentById(){return undefined;},
    async listRoleAssignments(){return [{assignmentId:'assignment',principalId:'principal',role,status:'active',
      grantedByPrincipalId:'governor',grantedAt:now,grantReason:'Assigned operational duty',revokedByPrincipalId:null,revokedAt:null,revocationReason:null}];},
  });
  const statements:string[]=[];
  const fakeDb={async query(sql:string){statements.push(sql);return {rows:[],rowCount:0};},async connect(){throw new Error('UNEXPECTED_MUTATION');}};
  const app=express();app.use(express.json());app.use((req:any,_res,next)=>{
    if(authenticated)req.user={claims:{sub:'user'}};
    req.session={};markAuthenticated(req.session,new Date());
    if(level!=='authenticated')markMfaSatisfied(req.session,new Date());
    if(level==='recent_step_up')markStepUpSatisfied(req.session,new Date());
    next();
  });registerVreRoutes(app,fakeDb);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const request=(path:string,body?:unknown)=>fetch(`http://127.0.0.1:${address.port}/admin/vre/${path}`,{
    method:body?'POST':'GET',headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  try {
    authenticated=false;assert.equal((await request('verification')).status,401);authenticated=true;
    assert.equal((await request('risk')).status,403);
    assert.equal((await request('enforcement/cases',{})).status,403);
    role='OPERATIONS';level='authenticated';assert.equal((await request('risk')).status,403);
    level='mfa';assert.equal((await request('risk')).status,200);
    assert.equal((await request('enforcement/decisions',{})).status,403);
    assert.equal((await request('enforcement/cases',{})).status,403);
    assert.equal((await request('risk/signals',{source:'provider'})).status,400);
    role='VERIFICATION_REVIEWER';level='authenticated';assert.equal((await request('verification')).status,200);
    assert.equal((await request('verification/org/profiles/profile/evidence')).status,403);
    level='mfa';assert.equal((await request('verification/reviews',{})).status,403);
    level='recent_step_up';assert.equal((await request('verification/reviews',{})).status,400);
    assert.equal((await request('verification/reevaluate',{approved:true})).status,400);
    assert.ok(!statements.some(sql=>/INSERT|UPDATE|DELETE/.test(sql)));
  } finally {
    server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();
    if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;
  }
});
