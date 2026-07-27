/**
 * Tutela Event System
 * 
 * This module provides utilities for triggering and managing tutela_* events
 * that control the global StatusBar component.
 */

// Event types
export type TutelaEventType = 
  | 'tutela_payment_activated'
  | 'tutela_verification_complete'
  | 'tutela_demo_active'
  | 'tutela_contract_executed'
  | 'tutela_error'
  | 'tutela_warning'
  | 'tutela_success'
  | 'tutela_info';

// Event data interfaces
export interface TutelaEventData {
  message?: string;
  contractType?: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
}

// Helper function to trigger tutela events
export const triggerTutelaEvent = (type: TutelaEventType, data?: TutelaEventData) => {
  const event = new CustomEvent(type, {
    detail: { type, data }
  });
  window.dispatchEvent(event);
  
  // Store event in localStorage with tutela_ prefix for persistence
  const eventLog = JSON.parse(localStorage.getItem('tutela_events') || '[]');
  eventLog.push({
    type,
    data,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 50 events
  if (eventLog.length > 50) {
    eventLog.splice(0, eventLog.length - 50);
  }
  
  localStorage.setItem('tutela_events', JSON.stringify(eventLog));
};

// Convenience functions for common events
export const tutelaEvents = {
  // Payment system events
  paymentActivated: (data?: { transactionId?: string }) => {
    localStorage.setItem('tutela_payment_active', 'true');
    localStorage.setItem('tutela_payment_activated_at', new Date().toISOString());
    triggerTutelaEvent('tutela_payment_activated', data);
  },

  // Verification events
  verificationComplete: (data?: { userId?: string }) => {
    localStorage.setItem('tutela_kyb_verified', 'true');
    localStorage.setItem('tutela_verification_date', new Date().toISOString());
    triggerTutelaEvent('tutela_verification_complete', data);
  },

  // Demo mode events
  demoActive: (data?: { sessionId?: string }) => {
    localStorage.setItem('tutela_demo_mode', 'true');
    localStorage.setItem('tutela_demo_started_at', new Date().toISOString());
    triggerTutelaEvent('tutela_demo_active', data);
  },

  // Contract execution events
  contractExecuted: (contractType?: string, data?: TutelaEventData) => {
    const contractData = {
      contractType: contractType || 'Smart Contract',
      ...data
    };
    localStorage.setItem(`tutela_contract_${Date.now()}`, JSON.stringify(contractData));
    triggerTutelaEvent('tutela_contract_executed', contractData);
  },

  // Status messages
  error: (message: string, data?: TutelaEventData) => {
    triggerTutelaEvent('tutela_error', { message, ...data });
  },

  warning: (message: string, data?: TutelaEventData) => {
    triggerTutelaEvent('tutela_warning', { message, ...data });
  },

  success: (message: string, data?: TutelaEventData) => {
    triggerTutelaEvent('tutela_success', { message, ...data });
  },

  info: (message: string, data?: TutelaEventData) => {
    triggerTutelaEvent('tutela_info', { message, ...data });
  },
};

// Helper functions to manage tutela_ localStorage keys
export const tutelaStorage = {
  // Get all tutela_ keys
  getAll: (): Record<string, any> => {
    const tutela: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tutela_')) {
        try {
          tutela[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          tutela[key] = localStorage.getItem(key);
        }
      }
    }
    return tutela;
  },

  // Get specific tutela_ key
  get: (key: string): any => {
    const fullKey = key.startsWith('tutela_') ? key : `tutela_${key}`;
    try {
      return JSON.parse(localStorage.getItem(fullKey) || '');
    } catch {
      return localStorage.getItem(fullKey);
    }
  },

  // Set tutela_ key
  set: (key: string, value: any): void => {
    const fullKey = key.startsWith('tutela_') ? key : `tutela_${key}`;
    localStorage.setItem(fullKey, typeof value === 'string' ? value : JSON.stringify(value));
  },

  // Remove tutela_ key
  remove: (key: string): void => {
    const fullKey = key.startsWith('tutela_') ? key : `tutela_${key}`;
    localStorage.removeItem(fullKey);
  },

  // Clear all tutela_ keys
  clear: (): void => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tutela_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  // Check system status
  getStatus: () => ({
    paymentActive: localStorage.getItem('tutela_payment_active') === 'true',
    kybVerified: localStorage.getItem('tutela_kyb_verified') === 'true',
    demoMode: localStorage.getItem('tutela_demo_mode') === 'true',
    paymentActivatedAt: localStorage.getItem('tutela_payment_activated_at'),
    verificationDate: localStorage.getItem('tutela_verification_date'),
    demoStartedAt: localStorage.getItem('tutela_demo_started_at'),
  }),
};

// Initialize system on module load
if (typeof window !== 'undefined') {
  // Auto-activate demo mode if in demo context
  const isDemoContext = window.location.pathname.includes('/demo') || 
                       localStorage.getItem('tutela_demo_mode') === 'true';
  
  if (isDemoContext && localStorage.getItem('tutela_demo_mode') !== 'true') {
    tutelaEvents.demoActive();
  }
}

export default tutelaEvents;