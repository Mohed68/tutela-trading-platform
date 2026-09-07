import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformOwnershipService, type PlatformOwnershipAssignment, type PlatformOwnershipMutationPort, type PlatformOwnershipReadPort } from "./index.js";

const now="2026-09-08T10:00:00.000Z";
class Store implements PlatformOwnershipReadPort,PlatformOwnershipMutationPort{
  principals=new Map<string,string>();assignments:PlatformOwnershipAssignment[]=[];failFinal=false;
  async findPrincipalIdByUserId(id:string){return this.principals.get(id)}
  async listOwnershipAssignments(id?:string){return this.assignments.filter(a=>!id||a.principalId===id)}
  async commitOwnershipGrant(input:any){this.assignments.push(input.assignment)}
  async commitOwnershipRevocation(input:any){if(this.assignments.filter(a=>a.status==="active").length<=1)throw new Error("FINAL_PLATFORM_OWNER");this.assignments=this.assignments.map(a=>a.assignmentId===input.after.assignmentId?input.after:a)}
}
const context=(overrides:Record<string,unknown>={})=>({actorUserId:"owner-user",actorPrincipalId:"owner-principal",sessionAssurance:"recent_step_up" as const,reason:"Approved ownership succession",requestId:"request-1",correlationId:"correlation-1",auditEventId:"audit-1",occurredAt:now,...overrides});
function fixture(){const s=new Store();s.principals.set("owner-user","owner-principal");s.principals.set("target-user","target-principal");s.assignments.push(Object.freeze({assignmentId:"ownership-1",principalId:"owner-principal",status:"active",authoritySource:"initial_bootstrap",grantedByPrincipalId:null,grantedAt:now,grantReason:"Initial controlled bootstrap",revokedByPrincipalId:null,revokedAt:null,revocationReason:null,version:1}));return s}

test("active ownership resolves independently from Platform roles",async()=>{const s=fixture();const r=await createPlatformOwnershipService({read:s,mutations:s}).resolveOwner("owner-user");assert.equal(r.state,"active_owner");assert.equal(Object.isFrozen(r),true)});
test("Owner with recent step-up can grant a second Owner",async()=>{const s=fixture();const result=await createPlatformOwnershipService({read:s,mutations:s}).grantPlatformOwnership({targetPrincipalId:"target-principal",assignmentId:"ownership-2",context:context()});assert.equal(result.status,"completed");assert.equal(s.assignments.filter(a=>a.status==="active").length,2)});
test("non-owner and missing recent step-up cannot grant ownership",async()=>{const s=fixture();const service=createPlatformOwnershipService({read:s,mutations:s});assert.equal((await service.grantPlatformOwnership({targetPrincipalId:"target-principal",assignmentId:"o2",context:context({actorUserId:"target-user",actorPrincipalId:"target-principal"})})).status,"denied");assert.equal((await service.grantPlatformOwnership({targetPrincipalId:"target-principal",assignmentId:"o3",context:context({sessionAssurance:"mfa"}) as any})).status,"denied")});
test("final active Owner cannot be revoked",async()=>{const s=fixture();const result=await createPlatformOwnershipService({read:s,mutations:s}).revokePlatformOwnership({assignmentId:"ownership-1",targetPrincipalId:"owner-principal",context:context()});assert.deepEqual(result,{status:"failed",code:"final_platform_owner_cannot_be_revoked"})});
test("one Owner may be revoked after a successor becomes active",async()=>{const s=fixture();const service=createPlatformOwnershipService({read:s,mutations:s});await service.grantPlatformOwnership({targetPrincipalId:"target-principal",assignmentId:"ownership-2",context:context()});const result=await service.revokePlatformOwnership({assignmentId:"ownership-1",targetPrincipalId:"owner-principal",context:context({auditEventId:"audit-2"})});assert.equal(result.status,"completed");assert.equal((await service.resolveOwner("owner-user")).state,"not_owner")});
