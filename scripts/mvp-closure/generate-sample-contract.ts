import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateContractPdf } from "../../server/mvp-closure/contractDocument.js";
import {
  MVP_TEMPLATE_VERSION,
  UREA46_PROFILE_VERSION,
  type ContractTermsSnapshot,
} from "../../server/mvp-closure/domain.js";

const snapshot: ContractTermsSnapshot = {
  contractId: "SAMPLE-NON-PRODUCTION-CONTRACT",
  orderId: "SAMPLE-NON-PRODUCTION-ORDER",
  tutelaReference: "TUTELA-SAMPLE-UREA46-V1",
  contractVersion: 1,
  snapshotId: "00000000-0000-4000-8000-000000000001",
  snapshotCreatedAt: "2026-09-18T00:00:00.000Z",
  templateVersion: MVP_TEMPLATE_VERSION,
  commercialProfileVersion: UREA46_PROFILE_VERSION,
  seller: {
    organizationId: "sample-seller",
    profileRevisionId: "sample-seller-profile-v1",
    legalName: "SAMPLE SELLER — NOT A REAL PARTY",
    registrationJurisdiction: "SA",
    registrationIdentifiers: [{ scheme: "sample", value: "NOT-REAL" }],
    registeredAddress: {
      countryCode: "SA",
      locality: "Jubail",
      addressLines: ["Sample address — not for execution"],
    },
    authorizedRepresentative: "Sample Seller Representative",
  },
  buyer: {
    organizationId: "sample-buyer",
    profileRevisionId: "sample-buyer-profile-v1",
    legalName: "SAMPLE BUYER — NOT A REAL PARTY",
    registrationJurisdiction: "AE",
    registrationIdentifiers: [{ scheme: "sample", value: "NOT-REAL" }],
    registeredAddress: {
      countryCode: "AE",
      locality: "Dubai",
      addressLines: ["Sample address — not for execution"],
    },
    authorizedRepresentative: "Sample Buyer Representative",
  },
  commodity: {
    name: "Urea 46% Granular",
    grade: "Granular 46% N",
    productDescription: "Granular Urea fertilizer — sample terms only",
    origin: "Saudi Arabia",
    producer: "Sample named producer",
    specifications: [
      { code: "NITROGEN", label: "Nitrogen", value: "46.0", unit: "%", sourceReference: "sample-evidence" },
      { code: "BIURET", label: "Biuret", value: "mutually agreed", unit: "%", sourceReference: "sample-evidence" },
      { code: "MOISTURE", label: "Moisture", value: "mutually agreed", unit: "%", sourceReference: "sample-evidence" },
      { code: "PARTICLE_SIZE", label: "Particle size distribution", value: "mutually agreed", sourceReference: "sample-evidence" },
      { code: "APPEARANCE", label: "Appearance", value: "white granular", sourceReference: "sample-evidence" },
    ],
  },
  quantity: { amount: "1000", unit: "MT", tolerancePercent: "5" },
  price: { unitPrice: "300", currency: "USD", pricingBasis: "Fixed accepted Order price", estimatedTotal: "300000" },
  delivery: {
    incoterm: "CFR",
    incotermsVersion: "2020",
    namedPlace: "Jebel Ali Port, UAE",
    shipmentWindowStart: "2026-10-01T00:00:00.000Z",
    shipmentWindowEnd: "2026-10-31T00:00:00.000Z",
    packaging: "50 kg bags",
    partialShipmentPolicy: "NOT_ALLOWED",
  },
  inspection: {
    required: true,
    bodyOrMethod: "SGS or mutually agreed equivalent",
    inspectionPoint: "Load port",
    quantityDetermination: "Draft survey",
    qualityDetermination: "Certificate of analysis",
    finalityAndClaims: "Final at load port subject to documented fraud or manifest error",
  },
  payment: {
    method: "Irrevocable documentary letter of credit",
    timing: "At sight against compliant documents",
    currency: "USD",
    bankDocumentConditions: "Sample conditions; bank and counsel review required",
  },
  requiredDocuments: ["Commercial Invoice", "Bill of Lading", "Certificate of Origin", "Quality Certificate", "Quantity Certificate", "Packing List"],
  legal: {
    riskTransfer: "At loading on board under CFR Incoterms 2020",
    titleTransfer: "Upon Seller receipt of cleared funds",
    governingLaw: "Laws of the Kingdom of Saudi Arabia",
    cisgTreatment: "LEGAL_REVIEW_REQUIRED",
    disputeResolution: "ICC_ARBITRATION",
    arbitrationInstitution: "ICC",
    arbitrationSeat: "Riyadh, Saudi Arabia",
    arbitrationLanguage: "English",
    arbitratorCount: 1,
    forceMajeureTreatment: "Original TUTELA clause; notice and mitigation required",
    hardshipTreatment: "Good-faith renegotiation followed by the agreed remedy",
  },
  platform: {
    platformFeeTreatment: "Fees separately invoiced",
    snapshotVersion: 1,
    sourceOrderFingerprint: `sha256:${"a".repeat(64)}`,
    sourceTermsFingerprint: `sha256:${"b".repeat(64)}`,
  },
  specialConditions: ["SAMPLE DOCUMENT ONLY — NOT AN OFFER OR EXECUTED AGREEMENT"],
};

const outputDirectory = resolve("output/pdf");
mkdirSync(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, "TUTELA_International_Commodity_Sale_Contract_v1_sample.pdf");
const document = generateContractPdf(snapshot);
writeFileSync(outputPath, document.bytes);
console.log(JSON.stringify({ outputPath, sha256: document.sha256, pageCount: document.pageCount }));
