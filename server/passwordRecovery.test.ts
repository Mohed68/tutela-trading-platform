import assert from "node:assert/strict";
import test from "node:test";
import { passwordResetSchema } from "./passwordRecovery.js";
test("password reset policy matches local registration strength",()=>{
  assert.equal(passwordResetSchema.safeParse("short").success,false);
  assert.equal(passwordResetSchema.safeParse("alllowercase123").success,false);
  assert.equal(passwordResetSchema.safeParse("StrongPassword123").success,true);
});
