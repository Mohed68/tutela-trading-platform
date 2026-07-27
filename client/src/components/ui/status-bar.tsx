import React from 'react';
import { cn } from '@/lib/utils';
import { X, CreditCard, Shield, Zap, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface StatusChip {
  id: string;
  label: string;
  type: 'payment' | 'security' | 'status' | 'feature' | 'success' | 'info';
  variant: 'success' | 'warning' | 'info' | 'error';
  icon?: React.ReactNode;
  dismissible?: boolean;
}

interface StatusBarProps {
  className?: string;
}

export function StatusBar({ className }: StatusBarProps) {
  const [chips, setChips] = React.useState<StatusChip[]>([]);

  // Listen for tutela_* events to show status chips
  React.useEffect(() => {
    const handleTutelaEvent = (event: CustomEvent) => {
      const { type, data } = event.detail;
      
      let newChip: StatusChip | null = null;

      switch (type) {
        case 'tutela_payment_activated':
          newChip = {
            id: `payment_${Date.now()}`,
            label: 'Payment System Active',
            type: 'payment',
            variant: 'success',
            icon: <CreditCard className="w-3 h-3" />,
            dismissible: true,
          };
          break;

        case 'tutela_verification_complete':
          newChip = {
            id: `verification_${Date.now()}`,
            label: 'KYB Verification Complete',
            type: 'security',
            variant: 'success',
            icon: <Shield className="w-3 h-3" />,
            dismissible: true,
          };
          break;

        case 'tutela_demo_active':
          newChip = {
            id: `demo_${Date.now()}`,
            label: 'Demo Mode Active',
            type: 'status',
            variant: 'info',
            icon: <Zap className="w-3 h-3" />,
            dismissible: true,
          };
          break;

        case 'tutela_contract_executed':
          newChip = {
            id: `contract_${Date.now()}`,
            label: data?.contractType ? `${data.contractType} Contract Executed` : 'Smart Contract Executed',
            type: 'feature',
            variant: 'success',
            icon: <Shield className="w-3 h-3" />,
            dismissible: true,
          };
          break;

        case 'tutela_error':
          newChip = {
            id: `error_${Date.now()}`,
            label: data?.message || 'System Error',
            type: 'status',
            variant: 'error',
            dismissible: true,
          };
          break;

        case 'tutela_warning':
          newChip = {
            id: `warning_${Date.now()}`,
            label: data?.message || 'System Warning',
            type: 'status',
            variant: 'warning',
            dismissible: true,
          };
          break;

        case 'tutela_success':
          newChip = {
            id: `success_${Date.now()}`,
            label: data?.message || 'Operation Successful',
            type: 'success',
            variant: 'success',
            icon: <CheckCircle className="w-3 h-3" />,
            dismissible: true,
          };
          break;

        case 'tutela_info':
          newChip = {
            id: `info_${Date.now()}`,
            label: data?.message || 'Information',
            type: 'info',
            variant: 'info',
            icon: <Info className="w-3 h-3" />,
            dismissible: true,
          };
          break;
      }

      if (newChip) {
        setChips(prev => [...prev, newChip]);
        
        // Auto-dismiss success and info chips after 5 seconds
        if (newChip.variant === 'success' || newChip.variant === 'info') {
          setTimeout(() => {
            setChips(prev => prev.filter(chip => chip.id !== newChip.id));
          }, 5000);
        }
      }
    };

    // Listen for all tutela_* events
    const events = [
      'tutela_payment_activated',
      'tutela_verification_complete', 
      'tutela_demo_active',
      'tutela_contract_executed',
      'tutela_error',
      'tutela_warning',
      'tutela_success',
      'tutela_info'
    ];

    events.forEach(eventType => {
      window.addEventListener(eventType, handleTutelaEvent as EventListener);
    });

    return () => {
      events.forEach(eventType => {
        window.removeEventListener(eventType, handleTutelaEvent as EventListener);
      });
    };
  }, []);

  const dismissChip = (chipId: string) => {
    setChips(prev => prev.filter(chip => chip.id !== chipId));
  };

  const getChipVariantStyles = (variant: StatusChip['variant']) => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      'fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-neutral-200',
      'h-12 flex items-center justify-center px-4',
      'transition-all duration-300 ease-in-out',
      className
    )}>
      <div className="flex items-center gap-2 overflow-x-auto max-w-full">
        {chips.map((chip) => (
          <div
            key={chip.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium',
              'whitespace-nowrap shrink-0 transition-all duration-200',
              getChipVariantStyles(chip.variant)
            )}
          >
            {chip.icon && (
              <span className="shrink-0">
                {chip.icon}
              </span>
            )}
            <span>{chip.label}</span>
            {chip.dismissible && (
              <button
                onClick={() => dismissChip(chip.id)}
                className="shrink-0 hover:opacity-70 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Re-export from lib for backwards compatibility
export { tutelaEvents, triggerTutelaEvent } from '@/lib/tutela-events';