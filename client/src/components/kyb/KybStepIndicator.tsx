import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Lock } from 'lucide-react';
import { KybStep } from '@/types/kyb';

interface KybStepIndicatorProps {
  steps: KybStep[];
  currentStep: number;
  onStepClick: (stepIndex: number) => void;
}

export default function KybStepIndicator({ steps, currentStep, onStepClick }: KybStepIndicatorProps) {
  const canAccessStep = (stepIndex: number): boolean => {
    // Always allow access to the first step
    if (stepIndex === 0) return true;
    
    // Allow access if all previous required steps are completed
    for (let i = 0; i < stepIndex; i++) {
      const step = steps[i];
      if (step.required && !step.completed) {
        return false;
      }
    }
    return true;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Steps</span>
        <span>{currentStep + 1} of {steps.length}</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isAccessible = canAccessStep(index);
          const isCompleted = step.completed;
          
          return (
            <Button
              key={step.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => isAccessible && onStepClick(index)}
              disabled={!isAccessible}
              className={`justify-start h-auto p-3 ${
                isActive 
                  ? 'ring-2 ring-blue-500 ring-offset-2' 
                  : isCompleted 
                    ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                    : !isAccessible 
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : !isAccessible ? (
                    <Lock className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium truncate">{step.title}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge 
                      variant={step.required ? "destructive" : "secondary"}
                      className="text-xs px-1 py-0"
                    >
                      {step.required ? "Required" : "Optional"}
                    </Badge>
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}