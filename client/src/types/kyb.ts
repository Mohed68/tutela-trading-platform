export type KybFile = {
  id: string;           // unique per file
  step: string;         // e.g., "company-legal", "ids", "address", "bank", "tax", "activity", "foreign"
  kind: string;         // e.g., "trade_license", "moa", "ubo", "board_res", "passport", "national_id", ...
  name: string;         // filename
  mime: string;
  size: number;
  previewUrl?: string;  // for images (URL.createObjectURL)
  valid: boolean;
  error?: string;
};

export type KybStep = {
  id: string;
  title: string;
  required: boolean;
  completed: boolean;
  description: string;
  fileKinds: {
    id: string;
    label: string;
    required: boolean;
    multiple?: boolean;
    description?: string;
  }[];
};

export type KybState = {
  steps: KybStep[];
  files: KybFile[];
  progress: number;     // 0–100
  submitted: boolean;
  currentStep: number;
  taxApplicable: boolean;
};

export const KYB_STEPS: KybStep[] = [
  {
    id: "company-legal",
    title: "Company Legal Proof",
    required: true,
    completed: false,
    description: "Upload valid company registration and legal documents",
    fileKinds: [
      { id: "trade_license", label: "Trade License / Commercial Registration", required: true },
      { id: "moa_aoa", label: "Memorandum/Articles (MoA/AoA) + Amendments", required: true },
      { id: "ubo_declaration", label: "UBO Declaration (Beneficial Owners)", required: true },
      { id: "board_resolution", label: "Board Resolution / Authorized Signatories", required: true }
    ]
  },
  {
    id: "ids",
    title: "Owners/Directors IDs",
    required: true,
    completed: false,
    description: "Passport and National ID for each beneficial owner, director, and authorized signer",
    fileKinds: [
      { id: "passport", label: "Passport", required: true, multiple: true, description: "For each owner/director" },
      { id: "national_id", label: "National ID", required: true, multiple: true, description: "For each owner/director" }
    ]
  },
  {
    id: "address",
    title: "Company Address Proof",
    required: true,
    completed: false,
    description: "Recent proof of company's registered address",
    fileKinds: [
      { id: "lease_or_utility", label: "Lease/Title Deed or Utility Bill (≤ 3 months)", required: true }
    ]
  },
  {
    id: "bank",
    title: "Bank Details",
    required: true,
    completed: false,
    description: "Official bank documentation with company name",
    fileKinds: [
      { id: "iban_or_bank_letter", label: "Bank Letter or IBAN Certificate", required: true }
    ]
  },
  {
    id: "tax",
    title: "Tax Registration",
    required: false, // Will be set based on taxApplicable
    completed: false,
    description: "VAT/TRN certificate if company is registered for VAT",
    fileKinds: [
      { id: "vat_trn", label: "VAT/TRN Certificate", required: true }
    ]
  },
  {
    id: "activity",
    title: "Business Activity Evidence",
    required: false,
    completed: false,
    description: "Optional: Recent business activity documentation",
    fileKinds: [
      { id: "invoices_or_contracts", label: "Recent Invoices/Contracts/Shipping Docs", required: false, multiple: true },
      { id: "auditor_or_bank_ref", label: "Auditor or Bank Reference", required: false }
    ]
  },
  {
    id: "foreign",
    title: "Foreign Entities",
    required: false,
    completed: false,
    description: "For foreign companies: incorporation certificates and translations",
    fileKinds: [
      { id: "incorporation_cert", label: "Certificate of Incorporation/Good Standing", required: false },
      { id: "certified_translation", label: "Certified Translation (if not in English)", required: false }
    ]
  }
];

export const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png'];
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];