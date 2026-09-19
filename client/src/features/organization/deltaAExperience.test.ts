import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path:string)=>readFileSync(path,"utf8");
test("organization setup resolves before create and offers governed join",()=>{const page=read("client/src/pages/organization-setup.tsx");assert.match(page,/organization-resolution/);assert.match(page,/Join this organization/);assert.match(page,/This is not my company/);assert.match(page,/Candidate matches never create membership or ownership automatically/)});
test("workspace presents business sections without implying multi-organization switching",()=>{const page=read("client/src/pages/organization.tsx");for(const section of ["Overview & verification","Company profile","Team","Roles & permissions","Signing authority","Signing policy","Verified domains","Audit activity"])assert.match(page,new RegExp(section.replace(/[&]/g,"&")));assert.doesNotMatch(page,/switch organization|organization switcher/i)});
test("action center provides focused signature context without edit controls",()=>{const page=read("client/src/pages/action-center.tsx");for(const field of ["Counterparty","Commodity","Value","Delivery","Review contract"])assert.match(page,new RegExp(field));assert.doesNotMatch(page,/Edit contract|edit terms/i)});
