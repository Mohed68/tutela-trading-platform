import { createHash,randomBytes,randomUUID } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import { hashPassword } from "./password.js";
import { sendResendEmail,type VerificationEmailConfiguration } from "./verificationEmail.js";

const TTL_MS=60*60*1000;
export const passwordResetSchema=z.string().min(12).max(128)
  .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/);
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");

function content(url:string){
  const safe=url.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  return {subject:"Reset your TUTELA password",
    text:`A password reset was requested for your TUTELA account.\n\nReset password: ${url}\n\nThis one-time link expires in 60 minutes. If you did not request it, you can ignore this email.`,
    html:`<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17211d"><h1>Reset your TUTELA password</h1><p>A password reset was requested for your account.</p><p><a href="${safe}">Reset password</a></p><p>This one-time link expires in 60 minutes. If you did not request it, you can ignore this email.</p></body></html>`};
}

export function createPasswordRecoveryService(pool:Pool,configuration:VerificationEmailConfiguration,deliver=sendResendEmail){return Object.freeze({
  async request(email:string):Promise<void>{
    const normalized=z.string().trim().email().max(254).transform(value=>value.toLowerCase()).safeParse(email);
    if(!normalized.success)return;
    const token=randomBytes(32).toString("base64url"),id=randomUUID();
    const client=await pool.connect();
    let user:{id:string;email:string}|undefined;
    try {
      await client.query("BEGIN");
      user=(await client.query<{id:string;email:string}>(`SELECT id,email FROM public.users WHERE lower(email)=$1
        AND auth_provider='local' AND credential_status='active' AND login_enabled=true LIMIT 1 FOR UPDATE`,[normalized.data])).rows[0];
      if(!user){await client.query("ROLLBACK");return;}
      const recent=await client.query(`SELECT 1 FROM public.password_reset_tokens WHERE user_id=$1 AND created_at>now()-interval '60 seconds' LIMIT 1`,[user.id]);
      if(recent.rowCount){await client.query("ROLLBACK");return;}
      await client.query(`INSERT INTO public.password_reset_tokens(id,user_id,token_digest,expires_at) VALUES($1,$2,$3,$4)`,[id,user.id,digest(token),new Date(Date.now()+TTL_MS)]);
      await client.query("COMMIT");
    } catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}
    finally{client.release();}
    const url=new URL("/reset-password",configuration.applicationBaseUrl);url.searchParams.set("token",token);
    try{await deliver(configuration,{recipient:user.email,...content(url.toString())});}
    catch(error){await pool.query(`DELETE FROM public.password_reset_tokens WHERE id=$1 AND consumed_at IS NULL`,[id]).catch(()=>undefined);throw error;}
  },
  async reset(token:unknown,password:unknown):Promise<boolean>{
    if(typeof token!=="string"||token.length<32||token.length>512||!passwordResetSchema.safeParse(password).success)return false;
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      // Serialize all tokens for the same account before checking consumption.
      // This lock order also matches issuance, preventing concurrent reset races.
      const account=(await client.query<{id:string}>(`SELECT account.id FROM public.users account
        WHERE account.id=(SELECT user_id FROM public.password_reset_tokens WHERE token_digest=$1)
        AND account.auth_provider='local' AND account.credential_status='active'
        AND account.login_enabled=true FOR UPDATE`,[digest(token)])).rows[0];
      if(!account){await client.query("ROLLBACK");return false;}
      const row=(await client.query<{id:string;user_id:string}>(`SELECT id,user_id FROM public.password_reset_tokens
        WHERE token_digest=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`,[digest(token)])).rows[0];
      if(!row){await client.query("ROLLBACK");return false;}
      await client.query(`UPDATE public.users SET password_hash=$2,updated_at=now() WHERE id=$1`,[row.user_id,await hashPassword(password as string)]);
      await client.query(`UPDATE public.password_reset_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL`,[row.user_id]);
      await client.query(`DELETE FROM public.sessions WHERE sess #>> '{passport,user}'=$1`,[row.user_id]);
      await client.query(`INSERT INTO public.account_security_events(id,user_id,event_type,request_id) VALUES($1,$2,'password_reset_completed',$3)`,[randomUUID(),row.user_id,randomUUID()]);
      await client.query("COMMIT");
      return true;
    }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
  },
});}
