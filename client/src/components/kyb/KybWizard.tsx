import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  Circle, 
  Upload, 
  FileText, 
  Image, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Save,
  Send
} from 'lucide-react';
import { useKybWizard } from '@/hooks/useKybWizard';
import KybFileUpload from './KybFileUpload';
import KybStepIndicator from './KybStepIndicator';

interface KybWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function KybWizard({ isOpen, onClose, onSubmitted }: KybWizardProps) {
  const {
    state,
    addFiles,
    removeFile,
    replaceFile,
    setCurrentStep,
    setTaxApplicable,
    canProceedToNextStep,
    canSubmit,
    submitKyb,
    clearDraft
  } = useKybWizard();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepData = state.steps[state.currentStep];
  const isLastStep = state.currentStep === state.steps.length - 1;

  const handleNext = () => {
    if (state.currentStep < state.steps.length - 1) {
      setCurrentStep(state.currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (state.currentStep > 0) {
      setCurrentStep(state.currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const success = await submitKyb();
      if (success) {
        onSubmitted?.();
        onClose();
      }
    } catch (error) {
      console.error('KYB submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Auto-save is handled by the hook
    onClose();
  };

  const getStepFiles = (stepId: string) => {
    return state.files.filter(f => f.step === stepId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-xl font-bold">KYB Verification Wizard</DialogTitle>
          
          {/* Progress Indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Progress</span>
              <span className="font-medium">{state.progress}% Complete</span>
            </div>
            <Progress value={state.progress} className="w-full" />
          </div>

          {/* Step Indicator */}
          <KybStepIndicator 
            steps={state.steps}
            currentStep={state.currentStep}
            onStepClick={setCurrentStep}
          />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Current Step Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {currentStepData?.completed ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400" />
                    )}
                    {currentStepData?.title}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{currentStepData?.description}</p>
                </div>
                
                <Badge variant={currentStepData?.required ? "destructive" : "secondary"}>
                  {currentStepData?.required ? "Required" : "Optional"}
                </Badge>
              </div>

              {/* Tax Applicable Toggle */}
              {currentStepData?.id === 'tax' && (
                <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg">
                  <Checkbox
                    id="tax-applicable"
                    checked={state.taxApplicable}
                    onCheckedChange={(checked) => setTaxApplicable(checked === true)}
                  />
                  <Label htmlFor="tax-applicable" className="text-sm">
                    Company is registered for VAT/Tax (makes this step mandatory)
                  </Label>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {currentStepData?.fileKinds.map((fileKind) => (
                <div key={fileKind.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">
                        {fileKind.label}
                        {fileKind.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {fileKind.description && (
                        <p className="text-xs text-gray-500">{fileKind.description}</p>
                      )}
                    </div>
                    
                    <Badge variant="outline" className="text-xs">
                      {fileKind.multiple ? "Multiple files" : "Single file"}
                    </Badge>
                  </div>

                  <KybFileUpload
                    stepId={currentStepData.id}
                    fileKind={fileKind}
                    files={getStepFiles(currentStepData.id).filter(f => f.kind === fileKind.id)}
                    onFilesAdd={addFiles}
                    onFileRemove={removeFile}
                    onFileReplace={replaceFile}
                  />
                </div>
              ))}

              {/* Step Summary */}
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span>Step Completion</span>
                <div className="flex items-center gap-2">
                  {currentStepData?.completed ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Incomplete
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={state.currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <Button variant="ghost" onClick={handleClose}>
              <Save className="h-4 w-4 mr-1" />
              Save & Exit
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {!isLastStep ? (
              <Button
                onClick={handleNext}
                disabled={currentStepData?.required && !canProceedToNextStep()}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit() || isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Submit for Review
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}