import { randomUUID } from "node:crypto";
import { z } from "zod";

export const INTELLIGENCE_AUTHORITY_NOTICE = "AI_CANDIDATE_NOT_CANONICAL_TRUTH" as const;
export type IntelligenceTask = "DOCUMENT_EXTRACTION"|"COMMODITY_IDENTIFICATION"|"SPECIFICATION_EXTRACTION"|"CLASSIFICATION_ASSISTANCE"|"CONTRACT_CONSISTENCY"|"EXCEPTION_EXPLANATION";
export interface IntelligenceProvider {readonly providerId:string;generate(input:Readonly<{model:string;systemPrompt:string;input:string;schemaName:string}>):Promise<{output:unknown;usage?:{inputTokens?:number;outputTokens?:number}}>}
export interface IntelligenceObservation {record(event:Readonly<{task:IntelligenceTask;taskVersion:string;providerId:string;model:string;outcome:"candidate"|"unavailable"|"invalid_output";durationMs:number;inputBytes:number;inputTokens?:number;outputTokens?:number}>):void}
export interface IntelligenceCandidate<T> {readonly status:"CANDIDATE";readonly candidateId:string;readonly task:IntelligenceTask;readonly taskVersion:string;readonly providerId:string;readonly model:string;readonly createdAt:string;readonly confidence:number|null;readonly provenance:Readonly<{sourceReferences:readonly string[];promptVersion:string}>;readonly authorityNotice:typeof INTELLIGENCE_AUTHORITY_NOTICE;readonly value:T}
export type IntelligenceResult<T>={readonly ok:true;readonly candidate:IntelligenceCandidate<T>}|{readonly ok:false;readonly failure:"AI_UNAVAILABLE"|"MALFORMED_OUTPUT";readonly authorityNotice:typeof INTELLIGENCE_AUTHORITY_NOTICE};

const bounded=z.string().trim().min(1).max(2000);
export const intelligenceSchemas={
  DOCUMENT_EXTRACTION:z.object({documentType:bounded,fields:z.record(z.string(),z.union([z.string(),z.number(),z.boolean(),z.null()])),issues:z.array(bounded).max(50),confidence:z.number().min(0).max(1)}).strict(),
  COMMODITY_IDENTIFICATION:z.object({candidates:z.array(z.object({name:bounded,grade:z.string().max(300),form:z.string().max(300),confidence:z.number().min(0).max(1),basis:bounded}).strict()).max(10),confidence:z.number().min(0).max(1)}).strict(),
  SPECIFICATION_EXTRACTION:z.object({specifications:z.array(z.object({code:bounded,label:bounded,value:bounded,unit:z.string().max(80).optional(),sourceReference:bounded,confidence:z.number().min(0).max(1)}).strict()).max(100),confidence:z.number().min(0).max(1)}).strict(),
  CLASSIFICATION_ASSISTANCE:z.object({candidates:z.array(z.object({scheme:bounded,code:bounded,description:bounded,confidence:z.number().min(0).max(1),basis:bounded}).strict()).max(10),requiresHumanOrProviderConfirmation:z.literal(true),confidence:z.number().min(0).max(1)}).strict(),
  CONTRACT_CONSISTENCY:z.object({findings:z.array(z.object({code:bounded,severity:z.enum(["INFO","WARNING","BLOCKING_CANDIDATE"]),message:bounded,fieldReferences:z.array(bounded).max(20)}).strict()).max(100),confidence:z.number().min(0).max(1)}).strict(),
  EXCEPTION_EXPLANATION:z.object({summary:bounded,probableCauses:z.array(bounded).max(20),recommendedActions:z.array(bounded).max(20),confidence:z.number().min(0).max(1)}).strict(),
} as const;

const SYSTEM_PROMPT="You are TUTELA Intelligence. Return only the requested structured object. Extract and recommend candidates; never declare verification, trust, eligibility, enforcement, customs truth, contract acceptance, or legal advice. Never invent missing values.";
const VERSION:Record<IntelligenceTask,string>={DOCUMENT_EXTRACTION:"document-extraction/v1",COMMODITY_IDENTIFICATION:"commodity-identification/v1",SPECIFICATION_EXTRACTION:"specification-extraction/v1",CLASSIFICATION_ASSISTANCE:"classification-assistance/v1",CONTRACT_CONSISTENCY:"contract-consistency/v1",EXCEPTION_EXPLANATION:"exception-explanation/v1"};
export function createIntelligenceOrchestrator(dependencies:Readonly<{provider:IntelligenceProvider;models?:Partial<Record<IntelligenceTask,string>>;clock?:()=>Date;observation?:IntelligenceObservation}>){
  const clock=dependencies.clock??(()=>new Date());
  return Object.freeze({
    async run<T extends IntelligenceTask>(request:Readonly<{task:T;input:string;sourceReferences:readonly string[]}>):Promise<IntelligenceResult<z.infer<(typeof intelligenceSchemas)[T]>>>{
      const started=Date.now(),model=dependencies.models?.[request.task]??process.env.TUTELA_AI_MODEL??"gpt-5",taskVersion=VERSION[request.task],meta={task:request.task,taskVersion,providerId:dependencies.provider.providerId,model,inputBytes:Buffer.byteLength(request.input)};
      try{
        const response=await dependencies.provider.generate({model,systemPrompt:SYSTEM_PROMPT,input:request.input,schemaName:request.task});
        const parsed=intelligenceSchemas[request.task].safeParse(response.output);
        if(!parsed.success){dependencies.observation?.record({...meta,outcome:"invalid_output",durationMs:Date.now()-started});return Object.freeze({ok:false,failure:"MALFORMED_OUTPUT",authorityNotice:INTELLIGENCE_AUTHORITY_NOTICE})}
        dependencies.observation?.record({...meta,outcome:"candidate",durationMs:Date.now()-started,...response.usage});
        return Object.freeze({ok:true,candidate:Object.freeze({status:"CANDIDATE",candidateId:randomUUID(),task:request.task,taskVersion,providerId:dependencies.provider.providerId,model,createdAt:clock().toISOString(),confidence:typeof (parsed.data as any).confidence==="number"?(parsed.data as any).confidence:null,provenance:Object.freeze({sourceReferences:Object.freeze([...request.sourceReferences]),promptVersion:taskVersion}),authorityNotice:INTELLIGENCE_AUTHORITY_NOTICE,value:Object.freeze(parsed.data)})});
      }catch{dependencies.observation?.record({...meta,outcome:"unavailable",durationMs:Date.now()-started});return Object.freeze({ok:false,failure:"AI_UNAVAILABLE",authorityNotice:INTELLIGENCE_AUTHORITY_NOTICE})}
    },
  });
}

export function assertCandidateCannotBecomeAuthority(value:unknown):never{
  void value;throw new Error("AI_CANDIDATE_REQUIRES_GOVERNED_DOMAIN_ACCEPTANCE");
}
