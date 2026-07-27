// lib/kyb.ts
export type Requirement =
  | { type: "all"; label: string; items: string[]; priority: "primary" | "alternative" }
  | { type: "oneOf"; label: string; items: string[]; priority: "primary" | "alternative" };

export type StepDef = {
  id: string;
  title: string;
  required: boolean;
  rules: Requirement[];
};

export type KybFile = {
  id: string;
  step: string;
  // ↓ user picks this from a dropdown
  kind: string;      // e.g. "trade_license", "moa_aoa", "ubo_declaration", "board_resolution", ...
  name: string;
  mime: string;
  size: number;
  previewUrl?: string;
  valid: boolean;
  error?: string;
};

export type KybState = {
  steps: { id: string; title: string; required: boolean; completed: boolean }[];
  files: KybFile[];
  progress: number;
  submitted: boolean;
  taxApplicable: boolean;
};

export const KYB_DRAFT_KEY = "tutela_kyb_draft";
export const allowedExt = [".pdf",".jpg",".jpeg",".png"];
export const maxSizeBytes = 10 * 1024 * 1024;

// Labels used in the dropdown
export const KIND_LABELS: Record<string,string> = {
  trade_license: "Trade License",
  commercial_registration: "Commercial Registration",
  moa_aoa: "MoA / AoA",
  ubo_declaration: "UBO Declaration",
  board_resolution: "Board Resolution",
  auth_signatory_letter: "Authorized Signatory Letter",
  passport: "Passport",
  passport_1: "Passport (Owner/Director)",
  national_id: "National ID",
  national_id_1: "National ID (Owner/Director)",
  lease_or_utility: "Lease / Utility Bill",
  iban_or_bank_letter: "IBAN / Bank Letter",
  vat_trn: "VAT / TRN Certificate",
  invoices_or_contracts_or_shipments: "Recent Invoices / Contracts / Shipments",
  auditor_or_bank_ref: "Auditor / Bank Reference",
  incorporation_or_good_standing: "Certificate of Incorporation / Good Standing",
  certified_translation: "Certified Translation",
};

// Step rules with priority and min counts
export const stepDefs: StepDef[] = [
  {
    id: "company-legal",
    title: "Company Legal Proof",
    required: true,
    rules: [
      { type: "oneOf", label: "Business license", items: ["trade_license","commercial_registration"], priority: "primary" },
      { type: "all",   label: "Constitutional docs", items: ["moa_aoa"], priority: "primary" },
      { type: "all",   label: "Beneficial owners", items: ["ubo_declaration"], priority: "primary" },
      { type: "oneOf", label: "Authority to sign", items: ["board_resolution","auth_signatory_letter"], priority: "alternative" }
    ]
  },
  {
    id: "ids",
    title: "Owners & Directors IDs",
    required: true,
    rules: [
      { type: "oneOf", label: "Passport", items: ["passport","passport_1"], priority: "primary" },
      { type: "oneOf", label: "National ID (recommended)", items: ["national_id","national_id_1"], priority: "alternative" }
    ]
  },
  {
    id: "address",
    title: "Company Address Proof",
    required: true,
    rules: [
      { type: "oneOf", label: "Address verification", items: ["lease_or_utility"], priority: "primary" }
    ]
  },
  {
    id: "bank",
    title: "Bank Details",
    required: true,
    rules: [
      { type: "oneOf", label: "Banking information", items: ["iban_or_bank_letter"], priority: "primary" }
    ]
  },
  {
    id: "tax",
    title: "Tax Registration",
    required: false,
    rules: [
      { type: "all", label: "Tax certification", items: ["vat_trn"], priority: "primary" }
    ]
  },
  {
    id: "activity",
    title: "Business Activity Evidence",
    required: false,
    rules: [
      { type: "oneOf", label: "Trading evidence", items: ["invoices_or_contracts_or_shipments"], priority: "alternative" },
      { type: "oneOf", label: "Professional references", items: ["auditor_or_bank_ref"], priority: "alternative" }
    ]
  },
  {
    id: "foreign",
    title: "Foreign Entity Documents",
    required: false,
    rules: [
      { type: "oneOf", label: "International compliance", items: ["incorporation_or_good_standing"], priority: "alternative" },
      { type: "oneOf", label: "Translation services", items: ["certified_translation"], priority: "alternative" }
    ]
  }
];

export const saveDraft = (s: KybState) => localStorage.setItem(KYB_DRAFT_KEY, JSON.stringify(s));
export const loadDraft = (): KybState | null => {
  try { return JSON.parse(localStorage.getItem(KYB_DRAFT_KEY) || "null"); } catch { return null; }
};

export const isValidFile = (f: File) => {
  const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
  const okExt = allowedExt.includes(ext);
  const okSize = f.size <= maxSizeBytes;
  return { ok: okExt && okSize, err: !okExt ? "Unsupported file type" : (!okSize ? "File exceeds 10MB" : "") };
};

// Returns whether primary is satisfied and overall completed (primary + optional if required)
export function validateStep(state: KybState, stepId: string, taxApplicable = true) {
  const step = stepDefs.find(s => s.id === stepId);
  if (!step) return { primaryOk:false, completed:false, groups: [] as {label:string; ok:boolean; priority:"primary"|"alternative"}[] };

  const files = state.files.filter(f => f.step === stepId && f.valid);

  const groups = step.rules.map(r => {
    const hits = r.items.filter(k => files.some(f => f.kind === k));
    const ok = (r.type === "all") ? hits.length === r.items.length : hits.length >= 1;
    return { label: r.label, ok, priority: r.priority as "primary"|"alternative" };
  });

  const primaryOk = groups.filter(g => g.priority === "primary").every(g => g.ok);
  // For company-legal we don't require alternative for completion, only primary
  const completed = primaryOk; 
  return { primaryOk, completed, groups };
}

export function computeProgress(state: KybState) {
  const reqSteps = state.steps.filter(s => s.required && (s.id !== "tax" || state.taxApplicable));
  const done = reqSteps.filter(s => s.completed);
  return Math.round((done.length / Math.max(reqSteps.length, 1)) * 100);
}

// Returns all allowed document types for a given step
export function allowedKindsFor(stepId: string): string[] {
  const step = stepDefs.find(s => s.id === stepId);
  if (!step) return [];
  return step.rules.flatMap(r => r.items);
}