import { createHash } from "node:crypto";

export const MVP_TEMPLATE_VERSION = "tutela-international-commodity-sale-contract/v1" as const;
export const UREA46_PROFILE_VERSION = "tutela-commodity-profile/urea46/v1" as const;
export const INCOTERMS_2020 = ["EXW","FCA","CPT","CIP","DAP","DPU","DDP","FAS","FOB","CFR","CIF"] as const;
export type Incoterm2020 = typeof INCOTERMS_2020[number];
export type ContractParty = "SELLER" | "BUYER";
export type CisgTreatment = "APPLIES_WHERE_LEGALLY_APPLICABLE" | "EXPRESSLY_INCLUDED" | "EXPRESSLY_EXCLUDED" | "LEGAL_REVIEW_REQUIRED";
export type MvpContractState = "CONTRACT_PREPARATION" | "CONTRACT_READY" | "AWAITING_SELLER_SIGNATURE" |
  "AWAITING_BUYER_SIGNATURE" | "EXECUTED" | "EXECUTION_STARTED" | "DOCUMENTS_SUBMITTED" |
  "DELIVERY_CONFIRMED" | "SETTLEMENT_CONFIRMED" | "TRADE_CLOSED" | "DISPUTED" | "TERMINATED";

export interface LegalPartySnapshot {
  readonly organizationId:string;
  readonly profileRevisionId:string;
  readonly legalName:string;
  readonly registrationJurisdiction:string;
  readonly registrationIdentifiers:readonly Readonly<{scheme:string;value:string}>[];
  readonly registeredAddress:Readonly<{countryCode?:string;administrativeArea?:string;locality?:string;postalCode?:string;addressLines?:readonly string[]}>;
  readonly authorizedRepresentative:string;
}
export interface SpecificationLine { readonly code:string;readonly label:string;readonly value:string;readonly unit?:string;readonly tolerance?:string;readonly sourceReference:string }
export interface ContractTermsSnapshot {
  readonly contractId:string;readonly orderId:string;readonly tutelaReference:string;
  readonly contractVersion:number;readonly snapshotId:string;readonly snapshotCreatedAt:string;
  readonly templateVersion:typeof MVP_TEMPLATE_VERSION;readonly commercialProfileVersion:string;
  readonly seller:LegalPartySnapshot;readonly buyer:LegalPartySnapshot;
  readonly commodity:Readonly<{name:string;grade:string;productDescription:string;origin:string;producer?:string;specifications:readonly SpecificationLine[]}>;
  readonly quantity:Readonly<{amount:string;unit:string;tolerancePercent:string}>;
  readonly price:Readonly<{unitPrice:string;currency:string;pricingBasis:string;estimatedTotal:string}>;
  readonly delivery:Readonly<{incoterm:Incoterm2020;incotermsVersion:"2020";namedPlace:string;shipmentWindowStart:string;shipmentWindowEnd:string;packaging:string;partialShipmentPolicy:"ALLOWED"|"NOT_ALLOWED"|"BY_WRITTEN_AGREEMENT"}>;
  readonly inspection:Readonly<{required:boolean;bodyOrMethod:string;inspectionPoint:string;quantityDetermination:string;qualityDetermination:string;finalityAndClaims:string}>;
  readonly payment:Readonly<{method:string;timing:string;currency:string;bankDocumentConditions:string}>;
  readonly requiredDocuments:readonly string[];
  readonly legal:Readonly<{riskTransfer:string;titleTransfer:string;governingLaw:string;cisgTreatment:CisgTreatment;disputeResolution:"ICC_ARBITRATION"|"COURTS";arbitrationInstitution?:"ICC";arbitrationSeat?:string;arbitrationLanguage?:string;arbitratorCount?:1|3;forceMajeureTreatment:string;hardshipTreatment:string}>;
  readonly platform:Readonly<{platformFeeTreatment:string;snapshotVersion:1;sourceOrderFingerprint:string;sourceTermsFingerprint:string}>;
  readonly specialConditions:readonly string[];
}
export interface ReadinessResult { readonly outcome:"READY"|"NOT_READY";readonly missing:readonly string[];readonly presentationPercent:number;readonly policyVersion:"mvp-contract-readiness/v1" }

function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function sha256(value:unknown):string{return `sha256:${createHash("sha256").update(typeof value==="string"||Buffer.isBuffer(value)?value:canonical(value)).digest("hex")}`}
const text=(value:unknown,max=500)=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=max;
const iso=(value:unknown)=>text(value,40)&&Number.isFinite(Date.parse(value as string));

export function evaluateContractReadiness(snapshot:ContractTermsSnapshot):ReadinessResult {
  const missing:string[]=[];
  const require=(condition:boolean,code:string)=>{if(!condition)missing.push(code)};
  for(const [party,value] of [["seller",snapshot.seller],["buyer",snapshot.buyer]] as const){
    require(text(value.legalName),`${party}.legal_name`);require(text(value.registrationJurisdiction),`${party}.registration_jurisdiction`);
    require(value.registrationIdentifiers.length>0,`${party}.registration_identifier`);
    require(Boolean(value.registeredAddress.countryCode&&value.registeredAddress.addressLines?.length),`${party}.registered_address`);
    require(text(value.authorizedRepresentative),`${party}.authorized_representative`);
  }
  require(text(snapshot.commodity.name),"commodity.name");require(text(snapshot.commodity.grade),"commodity.grade");
  require(text(snapshot.commodity.productDescription,2000),"commodity.product_description");require(text(snapshot.commodity.origin),"commodity.origin");
  require(snapshot.commodity.specifications.length>0,"commodity.specifications");
  for(const line of snapshot.commodity.specifications)require([line.code,line.label,line.value,line.sourceReference].every(v=>text(v)),`specification.${line.code||"unknown"}`);
  if(snapshot.commercialProfileVersion===UREA46_PROFILE_VERSION){
    const codes=new Set(snapshot.commodity.specifications.map(line=>line.code.toUpperCase()));
    for(const code of ["NITROGEN","BIURET","MOISTURE","PARTICLE_SIZE","APPEARANCE"])require(codes.has(code),`urea46.specification.${code.toLowerCase()}`);
  }
  require(text(snapshot.quantity.amount),"quantity.amount");require(text(snapshot.quantity.unit),"quantity.unit");require(text(snapshot.quantity.tolerancePercent),"quantity.tolerance");
  require(text(snapshot.price.unitPrice),"price.unit_price");require(text(snapshot.price.currency),"price.currency");require(text(snapshot.price.pricingBasis),"price.pricing_basis");
  require(INCOTERMS_2020.includes(snapshot.delivery.incoterm),"delivery.incoterm");require(snapshot.delivery.incotermsVersion==="2020","delivery.incoterms_version");
  require(text(snapshot.delivery.namedPlace),"delivery.named_place");require(iso(snapshot.delivery.shipmentWindowStart),"delivery.shipment_window_start");require(iso(snapshot.delivery.shipmentWindowEnd),"delivery.shipment_window_end");
  require(text(snapshot.delivery.packaging),"delivery.packaging");
  if(snapshot.inspection.required){for(const [key,value] of Object.entries(snapshot.inspection).filter(([key])=>key!=="required"))require(text(value),`inspection.${key}`)}
  require(text(snapshot.payment.method),"payment.method");require(text(snapshot.payment.timing),"payment.timing");require(text(snapshot.payment.currency),"payment.currency");
  require(snapshot.payment.currency===snapshot.price.currency,"payment.currency_matches_price");require(snapshot.requiredDocuments.length>0,"documents.required_package");
  for(const [key,value] of [["risk_transfer",snapshot.legal.riskTransfer],["title_transfer",snapshot.legal.titleTransfer],["governing_law",snapshot.legal.governingLaw],["force_majeure",snapshot.legal.forceMajeureTreatment],["hardship",snapshot.legal.hardshipTreatment]] as const)require(text(value,2000),`legal.${key}`);
  require(["APPLIES_WHERE_LEGALLY_APPLICABLE","EXPRESSLY_INCLUDED","EXPRESSLY_EXCLUDED","LEGAL_REVIEW_REQUIRED"].includes(snapshot.legal.cisgTreatment),"legal.cisg_treatment");
  if(snapshot.legal.disputeResolution==="ICC_ARBITRATION"){
    require(snapshot.legal.arbitrationInstitution==="ICC","legal.arbitration_institution");require(text(snapshot.legal.arbitrationSeat),"legal.arbitration_seat");
    require(text(snapshot.legal.arbitrationLanguage),"legal.arbitration_language");require(snapshot.legal.arbitratorCount===1||snapshot.legal.arbitratorCount===3,"legal.arbitrator_count");
  }
  require(text(snapshot.platform.platformFeeTreatment),"platform.fee_treatment");
  const unique=[...new Set(missing)].sort();const total=35;const presentationPercent=Math.max(0,Math.round(100*(total-Math.min(total,unique.length))/total));
  return Object.freeze({outcome:unique.length?"NOT_READY":"READY",missing:Object.freeze(unique),presentationPercent,policyVersion:"mvp-contract-readiness/v1"});
}

export function fingerprintSnapshot(snapshot:ContractTermsSnapshot):string{return sha256({scope:"mvp-contract-snapshot/v1",snapshot})}
export function fingerprintApproval(input:Readonly<{snapshotFingerprint:string;party:ContractParty;organizationId:string;userId:string;approvedAt:string}>):string{return sha256({scope:"mvp-contract-terms-approval/v1",...input})}
export function fingerprintSignature(input:Readonly<{snapshotFingerprint:string;party:ContractParty;organizationId:string;signerUserId:string;authorityId:string;previewDocumentSha256:string;signedAt:string;correlationId:string}>):string{return sha256({scope:"mvp-contract-signature/v1",...input})}
export function fingerprintSigningAuthority(input:Readonly<{organizationId:string;userId:string;membershipId:string;grantedByUserId:string;grantedAt:string}>):string{return sha256({scope:"mvp-contract-signing-authority/v1",...input})}

export const VALID_TRANSITIONS:Readonly<Record<MvpContractState,readonly MvpContractState[]>>=Object.freeze({
  CONTRACT_PREPARATION:["CONTRACT_READY"],CONTRACT_READY:["AWAITING_SELLER_SIGNATURE","CONTRACT_PREPARATION"],
  AWAITING_SELLER_SIGNATURE:["AWAITING_BUYER_SIGNATURE","CONTRACT_PREPARATION"],AWAITING_BUYER_SIGNATURE:["EXECUTED","CONTRACT_PREPARATION"],
  EXECUTED:["EXECUTION_STARTED","DISPUTED","TERMINATED"],EXECUTION_STARTED:["DOCUMENTS_SUBMITTED","DISPUTED","TERMINATED"],
  DOCUMENTS_SUBMITTED:["DELIVERY_CONFIRMED","DISPUTED","TERMINATED"],DELIVERY_CONFIRMED:["SETTLEMENT_CONFIRMED","DISPUTED","TERMINATED"],
  SETTLEMENT_CONFIRMED:["TRADE_CLOSED","DISPUTED","TERMINATED"],TRADE_CLOSED:[],DISPUTED:[],TERMINATED:[],
});
export function canTransition(from:MvpContractState,to:MvpContractState):boolean{return VALID_TRANSITIONS[from]?.includes(to)??false}
