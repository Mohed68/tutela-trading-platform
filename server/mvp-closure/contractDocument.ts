import { sha256, type ContractParty, type ContractTermsSnapshot } from "./domain.js";

// PDF generation does not itself form, amend or execute a contract; it renders
// the immutable server-authoritative snapshot and governed signature records.

export interface ContractDocumentSignature {readonly party:ContractParty;readonly signerName:string;readonly organizationName:string;readonly signedAt:string;readonly signatureFingerprint:string}
export interface ContractDocument {readonly bytes:Buffer;readonly sha256:string;readonly pageCount:number}

const GENERAL_CONDITIONS:readonly [string,string][]=Object.freeze([
  ["Definitions and interpretation","Defined terms take their meaning from Part A. Headings aid navigation and do not change meaning."],
  ["Contract formation","This Contract is formed only when both authorized parties sign the same version through TUTELA. An unsigned draft or generated PDF alone is not acceptance."],
  ["Seller obligations","Seller shall supply conforming goods, arrange the obligations allocated to it by Part A, and provide the agreed documents."],
  ["Buyer obligations","Buyer shall cooperate with delivery, make payment as agreed, and provide timely instructions and documents allocated to it."],
  ["Product conformity","The goods must conform to Part A and Annex A. Evidence records an assertion and does not by itself prove conformity."],
  ["Quantity and tolerance","Delivered quantity shall be determined by the agreed method and remain within the stated tolerance."],
  ["Delivery","Delivery shall occur within the shipment window and at the named place under the selected Incoterms rule."],
  ["Incoterms relationship","The selected Incoterms (R) 2020 rule allocates delivery, risk, costs and specified obligations only. It does not determine title, payment, governing law or dispute resolution."],
  ["Inspection and determination","Inspection, quality and quantity determinations shall follow Part A and Annex D, including the agreed effect on claims."],
  ["Claims procedure","A party shall notify the other promptly with reasonable particulars and supporting evidence. No platform workflow decides legal merits automatically."],
  ["Documents","Seller shall provide the agreed documentary package in authentic, legible form within the required timing."],
  ["Payment obligations","Buyer shall pay the agreed currency, amount and timing through the agreed method. TUTELA does not receive or move funds."],
  ["Late or non-payment","Late or non-payment entitles the affected party to contractual and legal remedies subject to notice, cure and applicable law."],
  ["Transfer of risk","Risk transfers only as expressly stated in Part A and the incorporated Incoterms rule."],
  ["Transfer of title","Title transfers only under the separate title provision in Part A and is not determined by Incoterms."],
  ["Representations and warranties","Each party represents that it exists validly, has authority to contract, and will comply with applicable law."],
  ["Sanctions and trade compliance","Each party shall comply with applicable sanctions, export controls, anti-bribery and trade laws and shall not require unlawful performance."],
  ["Force majeure","The agreed treatment applies to impediments beyond reasonable control that could not reasonably be foreseen, avoided or overcome, subject to prompt notice and mitigation."],
  ["Hardship","The agreed treatment governs exceptional changes that fundamentally alter performance economics, including good-faith renegotiation and the stated termination or adaptation outcome."],
  ["Default","A material failure not cured within a reasonable notified period permits suspension or termination where lawful and proportionate."],
  ["Suspension and termination","A party may suspend affected performance or terminate only under this Contract or applicable law, preserving accrued rights and immutable records."],
  ["Limitation of liability","Neither party excludes liability that cannot lawfully be excluded. Otherwise, indirect loss is excluded only to the extent fair and enforceable under governing law."],
  ["Confidentiality","Non-public commercial and technical information shall be protected and used only for this transaction, subject to lawful disclosure."],
  ["Assignment","No party may assign material rights or obligations without written consent, except to a permitted successor that assumes them."],
  ["Notices","Contract notices shall be sent to the agreed party contacts by a durable method that records sending and receipt."],
  ["Amendments","No amendment is effective unless documented as a new governed version or a separately executed amendment linked to this Contract."],
  ["Entire agreement","This Contract, its annexes and incorporated references constitute the agreement on this sale and supersede inconsistent prior statements."],
  ["Governing law","The governing law is the law stated in Part A, subject to mandatory rules that cannot be excluded."],
  ["CISG treatment","The parties adopt the explicit CISG treatment stated in Part A; international character alone is not treated by TUTELA as a legal conclusion."],
  ["Dispute resolution","Disputes shall follow the institution, seat, language, tribunal size and procedure stated in Part A."],
  ["Electronic contracting and signatures","The parties consent to electronic contracting. TUTELA records identity, authority, assurance, consent, version, time and integrity metadata; it does not claim a qualified PKI signature."],
  ["Counterparts","The Contract may be accepted in electronic counterparts that together evidence the same immutable version."],
  ["Precedence","Part A prevails over the General Conditions, then the Annexes, unless Part A expressly states another order."],
  ["Survival","Confidentiality, accrued payment, claims, liability, governing law, dispute resolution and integrity provisions survive as appropriate."],
]);

function clean(value:unknown):string{return String(value??"").replace(/[\u0000-\u001f\u007f-\u009f]/g," ").replace(/\s+/g," ").trim()}
function pdfEscape(value:string):string{return clean(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}
function wrap(text:string,width=94):string[]{const words=clean(text).split(" ");const lines:string[]=[];let line="";for(const word of words){if(!word)continue;const next=line?`${line} ${word}`:word;if(next.length>width&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);return lines.length?lines:[""]}
type Line={text:string;size:number;bold:boolean;gap:number;pageBreak?:boolean};
function add(lines:Line[],text:string,size=9,bold=false,gap=3){for(const line of wrap(text,size>=14?75:size>=11?88:100))lines.push({text:line,size,bold,gap});}
function section(lines:Line[],title:string){lines.push({text:"",size:4,bold:false,gap:3});add(lines,title,12,true,5)}
function pageBreak(lines:Line[]){lines.push({text:"",size:0,bold:false,gap:0,pageBreak:true})}
function field(lines:Line[],label:string,value:unknown){add(lines,`${label}: ${clean(value)||"Not specified"}`,9,false,2)}

function buildLines(snapshot:ContractTermsSnapshot,signatures:readonly ContractDocumentSignature[],executed:boolean):Line[]{
  const l:Line[]=[];add(l,"TUTELA",17,true,3);add(l,"INTERNATIONAL COMMODITY SALE CONTRACT",16,true,8);
  if(!executed)add(l,"DRAFT FOR REVIEW - NOT EXECUTED",12,true,8);
  field(l,"Contract reference",snapshot.tutelaReference);field(l,"Contract version",snapshot.contractVersion);field(l,"Prepared at",snapshot.preparedAt);field(l,"Effective date",snapshot.effectiveDate??"Effective upon the second governed signature");
  add(l,"SELLER and BUYER are the only parties to this sale. TUTELA provides the digital contracting, execution workflow and integrity-record platform only.",9,false,9);
  section(l,"SELLER");field(l,"Legal name",snapshot.seller.legalName);field(l,"Jurisdiction",snapshot.seller.registrationJurisdiction);
  section(l,"BUYER");field(l,"Legal name",snapshot.buyer.legalName);field(l,"Jurisdiction",snapshot.buyer.registrationJurisdiction);
  pageBreak(l);
  section(l,"PART A - SPECIFIC CONDITIONS");
  field(l,"Seller",`${snapshot.seller.legalName} (${snapshot.seller.registrationJurisdiction})`);field(l,"Seller identifiers",snapshot.seller.registrationIdentifiers.map(v=>`${v.scheme}: ${v.value}`).join("; "));field(l,"Seller registered address",`${snapshot.seller.registeredAddress.addressLines?.join(", ")}, ${snapshot.seller.registeredAddress.locality}, ${snapshot.seller.registeredAddress.countryCode}`);field(l,"Seller commercial representative",snapshot.seller.commercialRepresentative);field(l,"Seller authorized signatory",snapshot.seller.authorizedSignatory);
  field(l,"Buyer",`${snapshot.buyer.legalName} (${snapshot.buyer.registrationJurisdiction})`);field(l,"Buyer identifiers",snapshot.buyer.registrationIdentifiers.map(v=>`${v.scheme}: ${v.value}`).join("; "));field(l,"Buyer registered address",`${snapshot.buyer.registeredAddress.addressLines?.join(", ")}, ${snapshot.buyer.registeredAddress.locality}, ${snapshot.buyer.registeredAddress.countryCode}`);field(l,"Buyer commercial representative",snapshot.buyer.commercialRepresentative);field(l,"Buyer authorized signatory",snapshot.buyer.authorizedSignatory);
  field(l,"Commodity",`${snapshot.commodity.name} - ${snapshot.commodity.grade} - ${snapshot.commodity.form}`);field(l,"Product description",snapshot.commodity.productDescription);field(l,"Origin",snapshot.commodity.origin);if(snapshot.commodity.producer)field(l,"Producer",snapshot.commodity.producer);if(snapshot.commodity.customsClassification)field(l,"Customs classification reference",`${snapshot.commodity.customsClassification.scheme} ${snapshot.commodity.customsClassification.code} (${snapshot.commodity.customsClassification.applicabilityBasis})`);
  field(l,"Quantity",`${snapshot.quantity.amount} ${snapshot.quantity.unit} +/- ${snapshot.quantity.tolerancePercent}%`);field(l,"Measurement basis",snapshot.quantity.measurementBasis);field(l,"Price",`${snapshot.price.currency} ${snapshot.price.unitPrice} per ${snapshot.quantity.unit}`);field(l,"Pricing basis",snapshot.price.pricingBasis);field(l,"Estimated contract value",`${snapshot.price.currency} ${snapshot.price.estimatedTotal}`);
  field(l,"Delivery",`${snapshot.delivery.incoterm} ${snapshot.delivery.namedPlace} Incoterms (R) ${snapshot.delivery.incotermsVersion}`);field(l,"Shipment window",`${snapshot.delivery.shipmentWindowStart} to ${snapshot.delivery.shipmentWindowEnd}`);field(l,"Shipment window / laycan meaning",snapshot.delivery.laycanSemantics);field(l,"Packaging and shipment mode",`${snapshot.delivery.packaging}; ${snapshot.delivery.shipmentMode}`);field(l,"Partial shipments",snapshot.delivery.partialShipmentPolicy);
  field(l,"Inspection",snapshot.inspection.required?`${snapshot.inspection.bodyOrMethod}; ${snapshot.inspection.inspectionPoint}; ${snapshot.inspection.finalityAndClaims}; claims notice ${snapshot.inspection.claimsNoticePeriod}`:"Not required by agreement");field(l,"Payment",`${snapshot.payment.method}; ${snapshot.payment.timing}; due ${snapshot.payment.dueTrigger}; ${snapshot.payment.currency}; ${snapshot.payment.bankDocumentConditions}`);
  field(l,"Required documents",snapshot.requiredDocuments.join("; "));field(l,"Risk transfer",snapshot.legal.riskTransfer);field(l,"Title transfer",snapshot.legal.titleTransfer);field(l,"Governing law",snapshot.legal.governingLaw);field(l,"CISG treatment",snapshot.legal.cisgTreatment);
  field(l,"Dispute resolution",snapshot.legal.disputeResolution==="ICC_ARBITRATION"?`ICC Arbitration; seat ${snapshot.legal.arbitrationSeat}; language ${snapshot.legal.arbitrationLanguage}; ${snapshot.legal.arbitratorCount} arbitrator(s)`:"Courts specified by governing law and agreed forum");
  field(l,"Force majeure treatment",snapshot.legal.forceMajeureTreatment);field(l,"Hardship treatment",snapshot.legal.hardshipTreatment);field(l,"Claims",snapshot.legal.claimsTreatment);field(l,"Default",snapshot.legal.defaultTreatment);field(l,"Liability",snapshot.legal.liabilityTreatment);field(l,"Trade compliance",snapshot.legal.tradeComplianceTreatment);field(l,"Platform fee treatment",snapshot.platform.platformFeeTreatment);field(l,"Special conditions",snapshot.specialConditions.join("; ")||"None");
  pageBreak(l);section(l,"PART B - GENERAL CONDITIONS");for(const [i,[title,body]] of GENERAL_CONDITIONS.entries())add(l,`${i+1}. ${title}. ${body}`,8.5,false,4);
  pageBreak(l);
  section(l,"ANNEX A - PRODUCT SPECIFICATION");for(const s of snapshot.commodity.specifications)field(l,s.label,`${s.value}${s.unit?` ${s.unit}`:""}${s.tolerance?` (${s.tolerance})`:""}; source ${s.sourceReference}`);
  section(l,"ANNEX B - DELIVERY / SHIPMENT SCHEDULE");field(l,"Shipment window",`${snapshot.delivery.shipmentWindowStart} to ${snapshot.delivery.shipmentWindowEnd}`);field(l,"Window semantics",snapshot.delivery.laycanSemantics);field(l,"Named place",snapshot.delivery.namedPlace);field(l,"Packaging",snapshot.delivery.packaging);field(l,"Shipment mode",snapshot.delivery.shipmentMode);
  section(l,"ANNEX C - REQUIRED DOCUMENTS");snapshot.requiredDocuments.forEach((d,i)=>field(l,String(i+1),d));
  section(l,"ANNEX D - INSPECTION PROTOCOL");field(l,"Required",snapshot.inspection.required?"Yes":"No");field(l,"Body or method",snapshot.inspection.bodyOrMethod);field(l,"Point",snapshot.inspection.inspectionPoint);field(l,"Quantity determination",snapshot.inspection.quantityDetermination);field(l,"Quality determination",snapshot.inspection.qualityDetermination);field(l,"Finality and claims",snapshot.inspection.finalityAndClaims);
  pageBreak(l);section(l,"SIGNATURES");for(const party of ["SELLER","BUYER"] as const){const s=signatures.find(v=>v.party===party);field(l,party,s?`${s.signerName}, for ${s.organizationName}, signed ${s.signedAt}`:"Awaiting authorized electronic signature")}
  add(l,"Legal configuration boundary: this product records the parties' configured terms and electronic acceptance. It is not autonomous legal advice and jurisdiction- or commodity-specific counsel review may be required.",8,false,4);
  section(l,"TUTELA EXECUTION & INTEGRITY RECORD");field(l,"Contract reference",snapshot.tutelaReference);field(l,"Contract version",snapshot.contractVersion);field(l,"Snapshot reference",snapshot.snapshotId);field(l,"Contract form version",snapshot.templateVersion);field(l,"Commercial profile",snapshot.commercialProfileVersion);field(l,"Snapshot SHA-256",sha256({scope:"mvp-contract-snapshot/v1.1",snapshot}));field(l,"Execution state",executed?"Executed by both governed party signatures":"Not executed");for(const signature of signatures)field(l,`${signature.party} signing record`,`${signature.signerName}; ${signature.signedAt}; ${signature.signatureFingerprint}`);add(l,"This record supports document integrity and auditability. It does not make TUTELA a sale party, guarantor, bank, escrow provider, truth verifier or legal adviser.",8,false,4);
  return l;
}

function makePdf(lines:Line[],snapshot:ContractTermsSnapshot,executed:boolean):{bytes:Buffer;pageCount:number}{
  const pages:Line[][]=[];let page:Line[]=[];let y=770;for(const line of lines){if(line.pageBreak){if(page.length)pages.push(page);page=[];y=770;continue}const needed=line.size+line.gap;if(y-needed<55){pages.push(page);page=[];y=770}page.push(line);y-=needed}if(page.length)pages.push(page);
  const objects:string[]=[];const addObject=(value:string)=>{objects.push(value);return objects.length};
  const catalog=addObject("");const pagesRoot=addObject("");const regular=addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");const bold=addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds:number[]=[];for(const [pageIndex,pageLines] of pages.entries()){
    let cursor=790;const ops:string[]=["0.07 0.24 0.19 rg","0 812 595 30 re f","1 1 1 rg","BT","/F2 9 Tf","1 0 0 1 55 823 Tm",`(${pdfEscape(`TUTELA | ${snapshot.tutelaReference}`)}) Tj`,"ET","0.12 0.18 0.16 rg","0.5 w","50 805 m 545 805 l S"];
    if(!executed)ops.push("0.82 0.84 0.83 rg","BT","/F2 26 Tf","0.866 0.5 -0.5 0.866 120 330 Tm","(DRAFT FOR REVIEW - NOT EXECUTED) Tj","ET","0.12 0.18 0.16 rg");
    for(const line of pageLines){cursor-=line.size+line.gap;if(!line.text)continue;ops.push("BT",`/${line.bold?"F2":"F1"} ${line.size} Tf`,`1 0 0 1 55 ${cursor.toFixed(2)} Tm`,`(${pdfEscape(line.text)}) Tj`,"ET")}
    ops.push("BT","/F1 8 Tf",`1 0 0 1 55 28 Tm`,`(${pdfEscape(`TUTELA Contract ${snapshot.tutelaReference} | v1.1`)}) Tj`,"ET","BT","/F1 8 Tf",`1 0 0 1 490 28 Tm`,`(Page ${pageIndex+1} of ${pages.length}) Tj`,"ET");
    const stream=ops.join("\n");const content=addObject(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    pageIds.push(addObject(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;objects[pagesRoot-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output="%PDF-1.4\n%TUTELA\n";const offsets=[0];objects.forEach((obj,index)=>{offsets.push(Buffer.byteLength(output));output+=`${index+1} 0 obj\n${obj}\nendobj\n`});const xref=Buffer.byteLength(output);output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)output+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;output+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return {bytes:Buffer.from(output,"binary"),pageCount:pages.length};
}

export function generateContractPdf(snapshot:ContractTermsSnapshot,signatures:readonly ContractDocumentSignature[]=[],executed=false):ContractDocument{
  const result=makePdf(buildLines(snapshot,signatures,executed),snapshot,executed);return Object.freeze({...result,sha256:sha256(result.bytes)});
}
