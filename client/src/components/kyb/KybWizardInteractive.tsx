// client/src/components/kyb/KybWizardInteractive.tsx
import { useState, useEffect } from "react";
import { stepDefs, loadDraft, saveDraft, computeProgress, isValidFile, validateStep, allowedKindsFor, KybState, KybFile, KIND_LABELS, KYB_DRAFT_KEY } from "@/lib/kyb";
import { runAiReview, type ReviewResult } from "@/lib/aiReview";
import { ReviewDialog } from "./ReviewDialog";
import { FileDropZone } from "./FileDropZone";
import { SecureUploader } from "@/components/verification/SecureUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from "lucide-react";



const stepDescriptions: Record<string, string> = {
  "company-legal": "Upload your business registration and legal documentation",
  "ids": "Provide identification documents for all owners and directors",
  "address": "Verify your company's registered business address",
  "bank": "Submit banking details and account verification",
  "tax": "Tax registration certificates (if applicable)",
  "activity": "Optional: Recent business activity documentation",
  "foreign": "Additional documents for foreign entities",
};

export function KybWizardInteractive({ onSubmitPending, onVerified }: {
  onSubmitPending: () => void; onVerified: () => void;
}) {
  const draft = loadDraft();
  const [state, setState] = useState<KybState>(draft ?? {
    steps: stepDefs.map(s => ({...s, completed:false})),
    files: [],
    progress: 0,
    submitted: false,
    taxApplicable: true,
  });
  const [idx, setIdx] = useState(0);
  const current = state.steps[idx];

  useEffect(()=>{ saveDraft(state); }, [state]);

  const itemsForStep = state.files.filter(f => f.step === current.id);

  const validateAndUpdate = (draft: KybState) => {
    const r = validateStep(draft, current.id, draft.taxApplicable);
    const steps = draft.steps.map((st, i) => i === idx ? {...st, completed: r.completed} : st);
    return { ...draft, steps, progress: computeProgress({...draft, steps}) };
  };

  const addFiles = (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    const incoming = Array.from(fl).map((f) => {
      const v = isValidFile(f);
      return {
        id: crypto.randomUUID(),
        step: current.id,
        kind: "", // user will select from dropdown
        name: f.name,
        mime: f.type,
        size: f.size,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        valid: v.ok,
        error: v.ok ? undefined : v.err,
      };
    });
    setState(s => {
      const files = [...s.files, ...incoming];
      const draft = { ...s, files };
      return validateAndUpdate(draft);
    });
  };

  const removeFile = (id: string) => {
    setState(s => {
      const files = s.files.filter(f => f.id !== id);
      const draft = { ...s, files };
      return validateAndUpdate(draft);
    });
  };

  const res = validateStep(state, current.id, state.taxApplicable);
  const canNext = current.required ? res.primaryOk || (current.id === "tax" && !state.taxApplicable) : true;

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRes, setReviewRes] = useState<ReviewResult | null>(null);

  const next = () => setIdx(i => Math.min(i+1, state.steps.length-1));
  const back = () => setIdx(i => Math.max(i-1, 0));

  const submit = async () => {
    const req = state.steps.filter(s => s.required && (s.id !== "tax" || state.taxApplicable));
    const allOk = req.every(s => s.completed);
    
    if (!allOk) {
      // Show missing steps dialog
      const missing = req.filter(s => !s.completed).map(s => s.title);
      setReviewRes({
        pass: false,
        score: 0,
        issues: missing.map(step => ({
          severity: "error" as const,
          message: `Missing required step: ${step}`
        }))
      });
      setReviewOpen(true);
      return;
    }

    onSubmitPending();
    setState(s => ({...s, submitted: true}));
    setReviewOpen(true);
    const res = await runAiReview(state);
    setReviewRes(res);
  };

  const handleAcceptVerified = () => {
    document.body.classList.remove("state-unverified", "state-pending");
    document.body.classList.add("state-verified");
    localStorage.setItem("tutela_kyb_state", "verified");
    setReviewOpen(false);
    localStorage.removeItem(KYB_DRAFT_KEY);
    
    // Don't close the verification wizard - allow users to add more documents
    setTimeout(() => {
      onVerified();
      // Keep the wizard open for additional document uploads
    }, 500);
  };

  const toggleTaxApplicable = (checked: boolean) => {
    setState(s => ({
      ...s, 
      taxApplicable: checked,
      steps: s.steps.map(step => 
        step.id === "tax" ? { ...step, required: checked } : step
      )
    }));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>KYB Verification Wizard</span>
            <Badge variant="outline">{state.progress}% Complete</Badge>
          </CardTitle>
          <Progress value={state.progress} className="w-full" />
        </CardHeader>
      </Card>

      {/* Stepper */}
      <div className="flex gap-2 flex-wrap">
        {state.steps.map((s, i) => (
          <Button key={s.id}
            variant={i===idx ? "default" : "outline"}
            size="sm"
            className={`relative ${s.completed ? "bg-green-100 border-green-300 text-green-800" : ""}`}
            onClick={()=>setIdx(i)}
            disabled={i > idx && !canNext}
          >
            {s.completed && <CheckCircle className="w-4 h-4 mr-1" />}
            {s.required && !s.completed && <AlertCircle className="w-4 h-4 mr-1" />}
            {s.title}
            {s.required && <span className="text-red-500 ml-1">*</span>}
          </Button>
        ))}
      </div>

      {/* Current Step */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div>
              <span>{current.title}</span>
              {current.required ? (
                <Badge variant="destructive" className="ml-2">Required</Badge>
              ) : (
                <Badge variant="secondary" className="ml-2">Optional</Badge>
              )}
            </div>
            <span className="text-sm text-gray-500">Step {idx + 1} of {state.steps.length}</span>
          </CardTitle>
          <p className="text-sm text-gray-600">{stepDescriptions[current.id]}</p>
          
          {/* Priority Groups Status */}
          <ul className="mb-3 text-sm">
            {res.groups.map(g => (
              <li key={g.label} className={`flex items-center gap-2 ${g.priority === "primary" ? "text-gray-800" : "text-gray-600"}`}>
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${g.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                <strong>{g.priority === "primary" ? "Primary" : "Alternative"}:</strong> {g.label}
              </li>
            ))}
          </ul>
          
          {/* Tax Applicable Toggle */}
          {current.id === "tax" && (
            <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg">
              <Checkbox
                id="tax-applicable"
                checked={state.taxApplicable}
                onCheckedChange={toggleTaxApplicable}
              />
              <Label htmlFor="tax-applicable" className="text-sm">
                My company is registered for VAT/Tax (makes this step required)
              </Label>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Secure Document Upload Notice */}
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-800">
              <strong>Secure Upload:</strong> All KYB documents are now encrypted and stored securely in the cloud. 
              No sensitive data is kept on local servers.
            </p>
          </div>
          
          <FileDropZone items={itemsForStep} onAdd={addFiles} onRemove={removeFile} />
          
          {/* Document Type Mapping UI */}
          {itemsForStep.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-gray-700">Assign document types:</p>
              {itemsForStep.map(f => (
                <div key={f.id} className="flex items-center justify-between rounded-md border p-2">
                  <div className="text-sm">{f.name}</div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded px-2 py-1 text-sm min-w-[200px]"
                      value={f.kind || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setState(s => {
                          const files = s.files.map(x => x.id === f.id ? {...x, kind: v} : x);
                          const draft = { ...s, files };
                          return validateAndUpdate(draft);
                        });
                      }}
                    >
                      <option value="">Select document type…</option>
                      {allowedKindsFor(current.id).map(k => (
                        <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>
                      ))}
                    </select>
                    <button 
                      className="text-xs underline text-red-600" 
                      onClick={() => removeFile(f.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          

          
          {/* Step-specific Requirements Explanation */}
          {current.id === "company-legal" && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-900">Company Legal Proof Requirements:</p>
              <p className="text-blue-700 mt-1">
                <strong>Primary (required):</strong> Trade License OR Commercial Registration; MoA/AoA; UBO Declaration
              </p>
              <p className="text-blue-700">
                <strong>Alternative (recommended):</strong> Board Resolution OR Authorized Signatory Letter
              </p>
            </div>
          )}
          
          {current.id === "ids" && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-900">Identity Documents Requirements:</p>
              <p className="text-blue-700 mt-1">
                Passport is <strong>required</strong>. National ID is <strong>highly recommended</strong> for stronger verification.
              </p>
            </div>
          )}
          
          {current.id === "address" && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-900">Address Verification:</p>
              <p className="text-blue-700 mt-1">
                Provide a recent utility bill or lease agreement showing your company's registered address.
              </p>
            </div>
          )}
          
          {current.id === "bank" && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-900">Banking Information:</p>
              <p className="text-blue-700 mt-1">
                Submit bank letter or IBAN certificate to verify your company's banking details.
              </p>
            </div>
          )}
          
          {current.id === "activity" && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm">
              <p className="font-medium text-amber-900">Business Activity Evidence (Optional):</p>
              <p className="text-amber-700 mt-1">
                Recent invoices, contracts, or professional references help strengthen your verification profile.
              </p>
            </div>
          )}
          
          {current.id === "foreign" && (
            <div className="mt-4 p-3 bg-purple-50 rounded-lg text-sm">
              <p className="font-medium text-purple-900">Foreign Entity Documents (Optional):</p>
              <p className="text-purple-700 mt-1">
                Additional documents for international entities, including certified translations if needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={idx===0}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        
        <div className="flex items-center gap-2">
          {idx < state.steps.length - 1 ? (
            <Button onClick={next} disabled={!canNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={submit}
              disabled={state.submitted}
            >
              {state.submitted ? "Processing Review..." : "Submit for Review"}
            </Button>
          )}
        </div>
      </div>
      
      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Files Uploaded:</span> {state.files.filter(f => f.valid).length}
            </div>
            <div>
              <span className="font-medium">Steps Completed:</span> {state.steps.filter(s => s.completed).length}/{state.steps.filter(s => s.required && (s.id !== "tax" || state.taxApplicable)).length} required
            </div>
          </div>
        </CardContent>
      </Card>
      
      <ReviewDialog
        open={reviewOpen}
        result={reviewRes}
        onClose={() => setReviewOpen(false)}
        onAcceptVerified={handleAcceptVerified}
      />
    </div>
  );
}