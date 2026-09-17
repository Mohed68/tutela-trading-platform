import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { requireTestDatabase } from "../auth/test-database.js";
import { createPasswordRecoveryService } from "../../server/passwordRecovery.js";
import { hashPassword, verifyPassword } from "../../server/password.js";
import { encryptMfaSecret, generateTotpSecret } from "../../server/mfa/index.js";

test("password recovery: canonical delivery, digest-only token, cooldown, expiry, single use, sessions revoked and MFA intact",{timeout:120_000},async()=>{
  const client=new Client({connectionString:requireTestDatabase().connectionString,connectionTimeoutMillis:30_000});await client.connect();
  const user=randomUUID(),email=`recovery-${user}@pre-v3.invalid`,credential=randomUUID();
  let token="",deliveries=0;
  const adapter={query:(sql:string,values?:unknown[])=>client.query(sql,values),async connect(){return {async query(sql:string,values?:unknown[]){
    if(sql==="BEGIN")return client.query("SAVEPOINT recovery_command");
    if(sql==="COMMIT")return client.query("RELEASE SAVEPOINT recovery_command");
    if(sql==="ROLLBACK"){await client.query("ROLLBACK TO SAVEPOINT recovery_command");return client.query("RELEASE SAVEPOINT recovery_command");}
    return client.query(sql,values);
  },release(){}};}};
  const service=createPasswordRecoveryService(adapter as any,{apiKey:"unused-test-key",sender:"test@pre-v3.invalid",applicationBaseUrl:"https://pre-v3.invalid"},async(_configuration,message)=>{
    assert.equal(message.recipient,email);deliveries++;
    const link=message.text.match(/https:\/\/pre-v3\.invalid\/reset-password\?token=([^\s]+)/);assert.ok(link);token=link[1];
  });
  try{
    await client.query("BEGIN");
    await client.query(`INSERT INTO public.users(id,email,role,auth_provider,login_enabled,credential_status,password_hash,email_verified_at,is_2fa_enabled) VALUES($1,$2,'trader','local',true,'active',$3,now(),true)`,[user,email,await hashPassword("OriginalPassword123")]);
    const encrypted=encryptMfaSecret(generateTotpSecret(),randomBytes(32));
    await client.query(`INSERT INTO public.user_mfa_credentials(id,user_id,factor_type,status,encrypted_secret,secret_iv,secret_auth_tag,encryption_key_version,last_accepted_counter,activated_at) VALUES($1,$2,'totp','active',$3,$4,$5,$6,123,now())`,[credential,user,encrypted.ciphertext,encrypted.iv,encrypted.authTag,encrypted.keyVersion]);
    const mfaBefore=(await client.query(`SELECT * FROM public.user_mfa_credentials WHERE id=$1`,[credential])).rows[0];
    await client.query(`INSERT INTO public.sessions(sid,sess,expire) VALUES($1,$2::json,now()+interval '1 hour')`,[randomUUID(),JSON.stringify({passport:{user},cookie:{}})]);
    await service.request(`missing-${email}`);assert.equal(deliveries,0);
    await service.request(email.toUpperCase());assert.equal(deliveries,1);assert.ok(token);
    await service.request(email);assert.equal(deliveries,1);
    const stored=(await client.query(`SELECT token_digest FROM public.password_reset_tokens WHERE user_id=$1`,[user])).rows[0];
    assert.equal(stored.token_digest,createHash("sha256").update(token).digest("hex"));assert.notEqual(stored.token_digest,token);
    assert.equal(await service.reset(token,"weak"),false);
    const expired=randomBytes(32).toString("base64url");
    await client.query(`INSERT INTO public.password_reset_tokens(id,user_id,token_digest,created_at,expires_at) VALUES($1,$2,$3,now()-interval '2 hours',now()-interval '1 hour')`,[randomUUID(),user,createHash("sha256").update(expired).digest("hex")]);
    assert.equal(await service.reset(expired,"ReplacementPassword123"),false);
    assert.equal(await service.reset(token,"ReplacementPassword123"),true);
    assert.equal(await service.reset(token,"AnotherPassword123"),false);
    const account=(await client.query(`SELECT password_hash,is_2fa_enabled FROM public.users WHERE id=$1`,[user])).rows[0];
    assert.equal(await verifyPassword("ReplacementPassword123",account.password_hash),true);
    assert.equal(await verifyPassword("OriginalPassword123",account.password_hash),false);assert.equal(account.is_2fa_enabled,true);
    assert.deepEqual((await client.query(`SELECT * FROM public.user_mfa_credentials WHERE id=$1`,[credential])).rows[0],mfaBefore);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.sessions WHERE sess #>> '{passport,user}'=$1`,[user])).rows[0].n,0);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.account_security_events WHERE user_id=$1`,[user])).rows[0].n,1);
  }finally{await client.query("ROLLBACK").catch(()=>undefined);await client.end();}
});
