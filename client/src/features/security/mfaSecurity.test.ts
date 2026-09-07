import assert from "node:assert/strict";import{readFileSync}from"node:fs";import test from"node:test";
const source=readFileSync("client/src/features/security/MfaSecuritySettings.tsx","utf8");
test("MFA enrollment uses server APIs and local QR generation",()=>{assert.match(source,/\/api\/auth\/mfa\/enrollment/);assert.match(source,/QRCode\.toDataURL\(enrollment\.otpauthUri/);assert.doesNotMatch(source,/chart\.google|http:\/\/|https:\/\//)});
test("recovery codes are acknowledged and never persisted in browser storage",()=>{assert.match(source,/I saved the recovery codes securely/);assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB/)});
test("client cannot manufacture assurance or automatically replay actions",()=>{assert.match(source,/\/api\/auth\/mfa\/step-up/);assert.doesNotMatch(source,/mfaSatisfiedAt|stepUpSatisfiedAt|recent_step_up\s*:/)});
