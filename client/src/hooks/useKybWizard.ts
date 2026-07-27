import { useState, useEffect, useCallback } from 'react';
import { KybState, KybFile, KYB_STEPS, FILE_SIZE_LIMIT, ALLOWED_MIME_TYPES } from '@/types/kyb';
import { nanoid } from 'nanoid';

const STORAGE_KEY = 'tutela_kyb_draft';

export function useKybWizard() {
  const [state, setState] = useState<KybState>({
    steps: KYB_STEPS.map(step => ({ ...step })),
    files: [],
    progress: 0,
    submitted: false,
    currentStep: 0,
    taxApplicable: false
  });

  // Load draft from localStorage on mount
  useEffect(() => {
    loadDraft();
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveDraft();
  }, [state]);

  // Update tax step requirement based on taxApplicable
  useEffect(() => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === 'tax' ? { ...step, required: prev.taxApplicable } : step
      )
    }));
  }, [state.taxApplicable]);

  // Recalculate progress and step completion
  useEffect(() => {
    const updatedSteps = state.steps.map(step => {
      const completed = validateFilesForStep(step.id);
      return { ...step, completed };
    });

    const requiredSteps = updatedSteps.filter(step => step.required);
    const completedRequiredSteps = requiredSteps.filter(step => step.completed);
    const progress = requiredSteps.length > 0 ? (completedRequiredSteps.length / requiredSteps.length) * 100 : 0;

    setState(prev => ({
      ...prev,
      steps: updatedSteps,
      progress: Math.round(progress)
    }));
  }, [state.files, state.taxApplicable]);

  const validateFilesForStep = useCallback((stepId: string): boolean => {
    const step = state.steps.find(s => s.id === stepId);
    if (!step) return false;

    return step.fileKinds.every(fileKind => {
      if (!fileKind.required) return true;
      const files = state.files.filter(f => f.step === stepId && f.kind === fileKind.id && f.valid);
      return files.length > 0;
    });
  }, [state.steps, state.files]);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > FILE_SIZE_LIMIT) {
      return { valid: false, error: `File size must be less than ${FILE_SIZE_LIMIT / 1024 / 1024}MB` };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { valid: false, error: 'Only PDF, JPG, JPEG, and PNG files are allowed' };
    }

    return { valid: true };
  };

  const addFiles = useCallback((stepId: string, kind: string, fileList: FileList) => {
    const newFiles: KybFile[] = [];

    Array.from(fileList).forEach(file => {
      const validation = validateFile(file);
      const kybFile: KybFile = {
        id: nanoid(),
        step: stepId,
        kind,
        name: file.name,
        mime: file.type,
        size: file.size,
        valid: validation.valid,
        error: validation.error
      };

      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        kybFile.previewUrl = URL.createObjectURL(file);
      }

      newFiles.push(kybFile);
    });

    setState(prev => ({
      ...prev,
      files: [...prev.files, ...newFiles]
    }));

    return newFiles;
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setState(prev => {
      const fileToRemove = prev.files.find(f => f.id === fileId);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      
      return {
        ...prev,
        files: prev.files.filter(f => f.id !== fileId)
      };
    });
  }, []);

  const replaceFile = useCallback((fileId: string, newFile: File) => {
    const validation = validateFile(newFile);
    
    setState(prev => {
      const oldFile = prev.files.find(f => f.id === fileId);
      if (!oldFile) return prev;

      // Revoke old preview URL
      if (oldFile.previewUrl) {
        URL.revokeObjectURL(oldFile.previewUrl);
      }

      const updatedFile: KybFile = {
        ...oldFile,
        name: newFile.name,
        mime: newFile.type,
        size: newFile.size,
        valid: validation.valid,
        error: validation.error,
        previewUrl: newFile.type.startsWith('image/') ? URL.createObjectURL(newFile) : undefined
      };

      return {
        ...prev,
        files: prev.files.map(f => f.id === fileId ? updatedFile : f)
      };
    });
  }, []);

  const setCurrentStep = useCallback((stepIndex: number) => {
    setState(prev => ({ ...prev, currentStep: stepIndex }));
  }, []);

  const setTaxApplicable = useCallback((applicable: boolean) => {
    setState(prev => ({ ...prev, taxApplicable: applicable }));
  }, []);

  const canProceedToNextStep = useCallback((): boolean => {
    const currentStepData = state.steps[state.currentStep];
    if (!currentStepData?.required) return true;
    return validateFilesForStep(currentStepData.id);
  }, [state.currentStep, state.steps, validateFilesForStep]);

  const canSubmit = useCallback((): boolean => {
    const requiredSteps = state.steps.filter(step => step.required);
    return requiredSteps.every(step => step.completed);
  }, [state.steps]);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save KYB draft:', error);
    }
  }, [state]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        setState(prev => ({
          ...prev,
          ...draft,
          steps: KYB_STEPS.map(step => ({ ...step })) // Always use fresh step definitions
        }));
      }
    } catch (error) {
      console.warn('Failed to load KYB draft:', error);
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      // Revoke all preview URLs
      state.files.forEach(file => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
      setState({
        steps: KYB_STEPS.map(step => ({ ...step })),
        files: [],
        progress: 0,
        submitted: false,
        currentStep: 0,
        taxApplicable: false
      });
    } catch (error) {
      console.warn('Failed to clear KYB draft:', error);
    }
  }, [state.files]);

  const submitKyb = useCallback(async () => {
    if (!canSubmit()) return false;

    setState(prev => ({ ...prev, submitted: true }));
    
    // TODO: Send files to backend
    // For now, simulate submission
    
    clearDraft();
    return true;
  }, [canSubmit, clearDraft]);

  return {
    state,
    addFiles,
    removeFile,
    replaceFile,
    setCurrentStep,
    setTaxApplicable,
    canProceedToNextStep,
    canSubmit,
    submitKyb,
    clearDraft,
    validateFilesForStep
  };
}