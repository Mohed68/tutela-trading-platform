import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(path,"utf8");

test("production navigation and route guards do not consume browser-manufactured authority",()=>{
  const guard=read("client/src/components/navigation/RouteGuard.tsx");
  const sidebar=read("client/src/components/navigation/AppSidebar.tsx");
  for(const source of [guard,sidebar]){
    assert.doesNotMatch(source,/localStorage|tutela_kyb_state|tutela_user_role|getAuth\(|isVerified\(|hasRole\(/);
    assert.match(source,/useAuth/);
  }
  assert.match(guard,/organizations\/current|useOrganizationContext/);
});

test("production application does not mount demo or payment simulation controls",()=>{
  const app=read("client/src/App.tsx"),routes=read("server/routes.ts");
  assert.doesNotMatch(app,/PaymentSimulation|<Route path="\/demo|DemoShell/);
  assert.match(routes,/NODE_ENV\s*!==\s*"production"\s*&&\s*process\.env\.ENABLE_DEMO_RUNTIME\s*===\s*"true"/);
});

test("future user capabilities are hidden or explicitly not activated",()=>{
  const app=read("client/src/App.tsx"),sidebar=read("client/src/components/navigation/AppSidebar.tsx");
  assert.match(app,/NOT YET ACTIVATED/);
  assert.doesNotMatch(sidebar,/Negotiations|Payments|Logistics|Partners|Analytics|Support/);
});
