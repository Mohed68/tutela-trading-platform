import assert from "node:assert/strict";
import test from "node:test";
import { createEnforcementGuard } from "./guard.js";

function guard(state:string|undefined,restricted=false){return createEnforcementGuard({async query(){return {rows:state?[{state,restricted}]:[]};}} as never);}
const subjects=[{scope:"USER" as const,subjectId:"user-1"},{scope:"ORGANIZATION" as const,subjectId:"org-1"}];
test("NORMAL and MONITORED never automatically deny Current V2 commands",async()=>{
  assert.equal(await guard("NORMAL").allows("order.create",subjects),true);
  assert.equal(await guard("MONITORED").allows("order.create",subjects),true);
});
test("RESTRICTED denies only an explicitly named action",async()=>{
  assert.equal(await guard("RESTRICTED",true).allows("order.create",subjects),false);
  assert.equal(await guard("RESTRICTED",false).allows("contract.create",subjects),true);
});
test("SUSPENDED, BLOCKED and TERMINATED deny new matching trade mutations",async()=>{
  for(const state of ["SUSPENDED","BLOCKED","TERMINATED"])assert.equal(await guard(state).allows("offer.submit",subjects),false);
});
