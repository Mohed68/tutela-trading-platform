import { stepDefs, type KybState } from "@/lib/kyb";

export type ReviewIssue = { fileId?: string; message: string; severity: "error" | "warn" };
export type ReviewResult = { pass: boolean; score: number; issues: ReviewIssue[] };

const DOC_KEYWORDS: Record<string, string[]> = {
  trade_license: ["license", "trade", "business license", "commercial license"],
  commercial_registration: ["commercial registration", "registration", "cr"],
  moa_aoa: ["moa", "aoa", "articles", "memorandum"],
  ubo_declaration: ["ubo", "beneficial owner", "beneficial-owners"],
  board_resolution: ["board", "resolution", "signatory"],
  auth_signatory_letter: ["authorized signatory", "signatory letter"],
  passport: ["passport"], 
  passport_1: ["passport"],
  national_id: ["emirates id", "eid", "national id", "identity"], 
  national_id_1: ["emirates id", "eid", "national id", "identity"],
  lease_or_utility: ["lease", "tenancy", "utility", "bill", "dewa", "sewa"],
  iban_or_bank_letter: ["iban", "bank letter", "bank", "account"],
  vat_trn: ["vat", "trn", "tax"],
  invoices_or_contracts_or_shipments: ["invoice", "contract", "shipment", "b/l", "bill of lading"],
  auditor_or_bank_ref: ["auditor", "audit", "bank reference", "reference"],
  incorporation_or_good_standing: ["incorporation", "good standing"],
  certified_translation: ["translation", "certified translation"]
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-.\\s]+/g, " ");

export async function runAiReview(state: KybState): Promise<ReviewResult> {
  // Simulate AI processing time
  await new Promise(r => setTimeout(r, 900));
  
  const issues: ReviewIssue[] = [];
  
  // Check filename vs assigned document type
  for (const f of state.files) {
    if (!f.valid || !f.kind) continue;
    const words = DOC_KEYWORDS[f.kind] || [];
    const hit = words.some(w => norm(f.name).includes(norm(w)));
    if (!hit) { 
      issues.push({
        fileId: f.id,
        severity: "warn",
        message: `Filename does not look like "${f.kind}" (name: ${f.name})`
      }); 
    }
  }
  
  // Check required groups completion
  const required = state.steps.filter(s => s.required && (s.id !== "tax" || state.taxApplicable));
  for (const st of required) {
    const def = stepDefs.find(d => d.id === st.id)!;
    const files = state.files.filter(f => f.step === st.id && f.valid && !!f.kind);
    const primary = def.rules.filter(r => r.priority === "primary");
    
    for (const g of primary) {
      const count = g.items.filter(k => files.some(f => f.kind === k)).length;
      const need = g.type === "all" ? g.items.length : 1;
      if (count < need) { 
        issues.push({
          severity: "error",
          message: `Missing required: ${g.label} (${st.title})`
        }); 
      }
    }
  }
  
  const hard = issues.some(i => i.severity === "error");
  const sat = required.filter(s => s.completed).length;
  const score = Math.round((sat / Math.max(required.length, 1)) * 100);
  
  return { 
    pass: !hard && sat === required.length, 
    score, 
    issues 
  };
}