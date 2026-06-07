import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Clock, FileText, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  VERIFICATION_WORKFLOW_STEPS,
  getStoredVerificationWorkflowState,
  isWorkflowStepComplete,
  setStoredVerificationWorkflowState,
  type VerificationWorkflowState,
} from "@/lib/access";

type CompanyProfile = {
  companyName: string;
  country: string;
  city: string;
  industry: string;
  businessType: string;
  website: string;
  corporateEmail: string;
  description: string;
};

type DocumentFields = {
  commercialRegistration: string;
  taxCertificate: string;
  proofOfAddress: string;
  signatoryId: string;
  isoCertificates: string;
  exportLicense: string;
  importLicense: string;
  industryCertifications: string;
};

type SignatoryFields = {
  fullName: string;
  position: string;
  identityDocument: string;
  powerOfAttorney: string;
};

const initialCompanyProfile: CompanyProfile = {
  companyName: "",
  country: "",
  city: "",
  industry: "",
  businessType: "Buyer",
  website: "",
  corporateEmail: "",
  description: "",
};

const initialDocuments: DocumentFields = {
  commercialRegistration: "",
  taxCertificate: "",
  proofOfAddress: "",
  signatoryId: "",
  isoCertificates: "",
  exportLicense: "",
  importLicense: "",
  industryCertifications: "",
};

const initialSignatory: SignatoryFields = {
  fullName: "",
  position: "",
  identityDocument: "",
  powerOfAttorney: "",
};

const aiValidationChecks = [
  "Registration validated",
  "Expiry date detected",
  "Country matched",
  "Signatory detected",
  "Risk score generated",
];

const verificationSources = [
  { name: "Company Registry", status: "Available" },
  { name: "Tax Authority", status: "Available" },
  { name: "Identity Verification", status: "Available" },
  { name: "AI Document Validation", status: "Available" },
  { name: "AML Screening", status: "Coming Soon" },
  { name: "Sanctions Screening", status: "Coming Soon" },
];

const trustScoreBreakdown = [
  { label: "Company Information", points: 20 },
  { label: "Documents Submitted", points: 25 },
  { label: "Signatory Verified", points: 20 },
  { label: "AI Validation", points: 22 },
];

const verificationBenefits = [
  "View counterparty details",
  "Access real pricing",
  "Download trade documents",
  "Start negotiation",
  "Smart contract access",
  "Shipment tracking",
];

function SourcesCard() {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 font-semibold text-gray-900">Verification Sources</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {verificationSources.map((source) => (
          <div key={source.name} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
            <span className="font-medium text-gray-700">{source.name}</span>
            <Badge className={source.status === "Available" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>
              {source.status}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustScoreCard() {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Trust Score</h3>
        <Shield className="h-5 w-5 text-blue-600" />
      </div>
      <div className="mb-3 text-3xl font-bold text-gray-900">87 / 100</div>
      <div className="space-y-2 text-sm text-gray-700">
        {trustScoreBreakdown.map((item) => (
          <div key={item.label} className="flex justify-between">
            <span>{item.label}</span>
            <span className="font-medium">+{item.points}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Demo score based on submitted verification data. Final trust score will be generated after review.
      </p>
    </section>
  );
}

function BenefitsCard() {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 font-semibold text-gray-900">Verification Benefits</h3>
      <div className="space-y-2 text-sm text-gray-700">
        {verificationBenefits.map((benefit) => (
          <div key={benefit} className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            {benefit}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewSlaCard({ workflowState }: { workflowState: VerificationWorkflowState }) {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 font-semibold text-gray-900">Review SLA</h3>
      <div className="space-y-3 text-sm text-gray-700">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Expected Review Time</p>
          <p className="text-lg font-semibold text-gray-900">24–48 Hours</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Current Status</p>
          <Badge className={workflowState === "pending_review" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"}>
            {workflowState === "pending_review" ? "Pending Review" : "Not Submitted"}
          </Badge>
        </div>
      </div>
    </section>
  );
}

export default function Verification() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [workflowState, setWorkflowState] = useState<VerificationWorkflowState>(() => getStoredVerificationWorkflowState());
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(initialCompanyProfile);
  const [documents, setDocuments] = useState<DocumentFields>(initialDocuments);
  const [signatory, setSignatory] = useState<SignatoryFields>(initialSignatory);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const updateWorkflowState = (state: VerificationWorkflowState) => {
    setWorkflowState(state);
    setStoredVerificationWorkflowState(state);
  };

  const goToNextStep = () => {
    const nextStateByStep: VerificationWorkflowState[] = [
      "profile_completed",
      "documents_completed",
      "signatory_completed",
      "ai_validated",
    ];
    const nextState = nextStateByStep[currentStep];

    if (nextState) {
      updateWorkflowState(nextState);
    }

    setCurrentStep((step) => Math.min(step + 1, 4));
  };

  const submitForReview = () => {
    updateWorkflowState("pending_review");
    toast({
      title: "Verification Submitted",
      description: "Your company verification has been submitted for review.",
    });
  };

  const handleDocumentChange = (field: keyof DocumentFields, files: FileList | null) => {
    setDocuments((current) => ({
      ...current,
      [field]: files?.[0]?.name ?? current[field],
    }));
  };

  const handleSignatoryDocumentChange = (field: keyof SignatoryFields, files: FileList | null) => {
    setSignatory((current) => ({
      ...current,
      [field]: files?.[0]?.name ?? current[field],
    }));
  };

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <AppShell>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Verification Center</h1>
          <p className="mt-2 text-gray-600">Complete company onboarding to unlock verified marketplace access.</p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-5">
          {VERIFICATION_WORKFLOW_STEPS.map((step, index) => {
            const complete = isWorkflowStepComplete(workflowState, step.completeAfter);
            const active = currentStep === index;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => setCurrentStep(index)}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${active ? "border-blue-300 bg-blue-50" : "bg-white"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{step.label}</span>
                  {complete ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-gray-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {workflowState === "pending_review" && (
          <Card className="mb-6 border-blue-100 bg-blue-50">
            <CardContent className="py-3 text-sm text-blue-800">
              Your verification package has been submitted and is pending review.
            </CardContent>
          </Card>
        )}

        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1 — Company Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input placeholder="Company Name" value={companyProfile.companyName} onChange={(event) => setCompanyProfile({ ...companyProfile, companyName: event.target.value })} />
                <Input placeholder="Country" value={companyProfile.country} onChange={(event) => setCompanyProfile({ ...companyProfile, country: event.target.value })} />
                <Input placeholder="City" value={companyProfile.city} onChange={(event) => setCompanyProfile({ ...companyProfile, city: event.target.value })} />
                <Input placeholder="Industry" value={companyProfile.industry} onChange={(event) => setCompanyProfile({ ...companyProfile, industry: event.target.value })} />
                <select className="tutela-form-select" value={companyProfile.businessType} onChange={(event) => setCompanyProfile({ ...companyProfile, businessType: event.target.value })}>
                  <option>Buyer</option>
                  <option>Seller</option>
                  <option>Broker</option>
                  <option>Trader</option>
                </select>
                <Input placeholder="Website" value={companyProfile.website} onChange={(event) => setCompanyProfile({ ...companyProfile, website: event.target.value })} />
                <Input placeholder="Corporate Email" value={companyProfile.corporateEmail} onChange={(event) => setCompanyProfile({ ...companyProfile, corporateEmail: event.target.value })} />
              </div>
              <Textarea placeholder="Company Description" value={companyProfile.description} onChange={(event) => setCompanyProfile({ ...companyProfile, description: event.target.value })} />
            </CardContent>
          </Card>
        )}

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2 — Company Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-3 font-semibold text-gray-900">Mandatory Documents</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    ["commercialRegistration", "Commercial Registration"],
                    ["taxCertificate", "Tax Certificate"],
                    ["proofOfAddress", "Proof of Address"],
                    ["signatoryId", "Authorized Signatory ID"],
                  ].map(([field, label]) => (
                    <label key={field} className="text-sm font-medium text-gray-700">
                      {label}
                      <Input className="mt-2" type="file" onChange={(event) => handleDocumentChange(field as keyof DocumentFields, event.target.files)} />
                      {documents[field as keyof DocumentFields] && <span className="mt-1 block text-xs text-gray-500">{documents[field as keyof DocumentFields]}</span>}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-semibold text-gray-900">Optional Documents</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    ["isoCertificates", "ISO Certificates"],
                    ["exportLicense", "Export License"],
                    ["importLicense", "Import License"],
                    ["industryCertifications", "Industry Certifications"],
                  ].map(([field, label]) => (
                    <label key={field} className="text-sm font-medium text-gray-700">
                      {label}
                      <Input className="mt-2" type="file" onChange={(event) => handleDocumentChange(field as keyof DocumentFields, event.target.files)} />
                      {documents[field as keyof DocumentFields] && <span className="mt-1 block text-xs text-gray-500">{documents[field as keyof DocumentFields]}</span>}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3 — Authorized Signatory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input placeholder="Full Name" value={signatory.fullName} onChange={(event) => setSignatory({ ...signatory, fullName: event.target.value })} />
                <Input placeholder="Position" value={signatory.position} onChange={(event) => setSignatory({ ...signatory, position: event.target.value })} />
                <label className="text-sm font-medium text-gray-700">
                  Passport or National ID
                  <Input className="mt-2" type="file" onChange={(event) => handleSignatoryDocumentChange("identityDocument", event.target.files)} />
                  {signatory.identityDocument && <span className="mt-1 block text-xs text-gray-500">{signatory.identityDocument}</span>}
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Power of Attorney (optional)
                  <Input className="mt-2" type="file" onChange={(event) => handleSignatoryDocumentChange("powerOfAttorney", event.target.files)} />
                  {signatory.powerOfAttorney && <span className="mt-1 block text-xs text-gray-500">{signatory.powerOfAttorney}</span>}
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 4 — AI Validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-gray-600">
                This step prepares workflow state for future AI validation. No live external AI, registry, AML, or sanctions integration is connected yet.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {aiValidationChecks.map((check) => (
                  <div key={check} className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {check}
                  </div>
                ))}
              </div>
              <SourcesCard />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TrustScoreCard />
                <BenefitsCard />
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 5 — Review & Submit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <section>
                <h3 className="mb-2 font-semibold text-gray-900">Company Profile</h3>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                  {Object.entries(companyProfile).map(([key, value]) => (
                    <div key={key} className="rounded bg-gray-50 p-3">
                      <span className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}: </span>
                      {value || "Not provided"}
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="mb-2 font-semibold text-gray-900">Documents</h3>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                  {Object.entries(documents).map(([key, value]) => (
                    <div key={key} className="rounded bg-gray-50 p-3">
                      <span className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}: </span>
                      {value || "Not provided"}
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="mb-2 font-semibold text-gray-900">Authorized Signatory</h3>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                  {Object.entries(signatory).map(([key, value]) => (
                    <div key={key} className="rounded bg-gray-50 p-3">
                      <span className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}: </span>
                      {value || "Not provided"}
                    </div>
                  ))}
                </div>
              </section>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <TrustScoreCard />
                <BenefitsCard />
                <ReviewSlaCard workflowState={workflowState} />
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800">Workflow state: {workflowState.replace(/_/g, " ")}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="outline" disabled={currentStep === 0} onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}>
            Back
          </Button>
          {currentStep < 4 ? (
            <Button className="tutela-btn-primary" onClick={goToNextStep}>
              {currentStep === 3 ? "Run Mock AI Validation" : "Continue"}
            </Button>
          ) : (
            <Button className="tutela-btn-primary" onClick={submitForReview}>
              <FileText className="mr-2 h-4 w-4" />
              Submit For Review
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
