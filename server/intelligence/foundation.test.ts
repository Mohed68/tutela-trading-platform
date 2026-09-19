import assert from "node:assert/strict";
import test from "node:test";
import { assertCandidateCannotBecomeAuthority, createIntelligenceOrchestrator, INTELLIGENCE_AUTHORITY_NOTICE } from "./foundation.js";

const valid={findings:[{code:"CURRENCY_MISMATCH",severity:"WARNING",message:"Payment and price currencies differ.",fieldReferences:["payment.currency","price.currency"]}],confidence:0.92};

test("valid structured output remains a provenance-bound non-authoritative candidate",async()=>{
  const seen:any[]=[];
  const service=createIntelligenceOrchestrator({provider:{providerId:"test",async generate(){return {output:valid,usage:{inputTokens:10,outputTokens:20}}}},clock:()=>new Date("2026-09-19T00:00:00Z"),observation:{record:value=>seen.push(value)}});
  const result=await service.run({task:"CONTRACT_CONSISTENCY",input:"redacted structured contract fields",sourceReferences:["snapshot-1"]});
  assert.equal(result.ok,true);
  if(result.ok){assert.equal(result.candidate.authorityNotice,INTELLIGENCE_AUTHORITY_NOTICE);assert.equal(result.candidate.status,"CANDIDATE");assert.deepEqual(result.candidate.provenance.sourceReferences,["snapshot-1"])}
  assert.equal(seen[0].outcome,"candidate");assert.equal(JSON.stringify(seen).includes("redacted structured contract fields"),false);
});

test("malformed output fails closed without candidate",async()=>{
  const service=createIntelligenceOrchestrator({provider:{providerId:"test",async generate(){return {output:{findings:[],confidence:17}}}}});
  assert.deepEqual(await service.run({task:"CONTRACT_CONSISTENCY",input:"x",sourceReferences:[]}),{ok:false,failure:"MALFORMED_OUTPUT",authorityNotice:INTELLIGENCE_AUTHORITY_NOTICE});
});

test("provider outage cannot invent success",async()=>{
  const service=createIntelligenceOrchestrator({provider:{providerId:"test",async generate(){throw new Error("offline")}}});
  assert.deepEqual(await service.run({task:"DOCUMENT_EXTRACTION",input:"x",sourceReferences:[]}),{ok:false,failure:"AI_UNAVAILABLE",authorityNotice:INTELLIGENCE_AUTHORITY_NOTICE});
});

test("classification requires independent confirmation and AI cannot manufacture authority",async()=>{
  const service=createIntelligenceOrchestrator({provider:{providerId:"test",async generate(){return {output:{candidates:[{scheme:"HS",code:"310210",description:"Candidate only",confidence:.7,basis:"document text"}],requiresHumanOrProviderConfirmation:true,confidence:.7}}}}});
  const result=await service.run({task:"CLASSIFICATION_ASSISTANCE",input:"fertilizer",sourceReferences:["doc-1"]});
  assert.equal(result.ok,true);assert.throws(()=>assertCandidateCannotBecomeAuthority(result),/REQUIRES_GOVERNED_DOMAIN_ACCEPTANCE/);
});
