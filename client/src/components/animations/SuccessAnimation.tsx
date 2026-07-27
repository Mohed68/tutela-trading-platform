import React, { useEffect, useRef } from 'react';
import { createConfetti, bounceIn } from '@/lib/animations';
import { CheckCircle } from 'lucide-react';

interface SuccessAnimationProps {
  show: boolean;
  message?: string;
  showConfetti?: boolean;
  onComplete?: () => void;
}

export function SuccessAnimation({ 
  show, 
  message = 'Success!', 
  showConfetti = true,
  onComplete 
}: SuccessAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show || !containerRef.current || !iconRef.current) return;

    // Animate the success icon
    bounceIn(iconRef.current, { duration: 800 });

    // Create confetti effect
    if (showConfetti) {
      setTimeout(() => {
        if (containerRef.current) {
          createConfetti(containerRef.current, {
            count: 30,
            colors: ['#10b981', '#059669', '#34d399', '#6ee7b7'],
            velocity: { min: 50, max: 150 }
          });
        }
      }, 400);
    }

    // Call onComplete after animation
    if (onComplete) {
      setTimeout(onComplete, 2000);
    }
  }, [show, showConfetti, onComplete]);

  if (!show) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-4">
        <div 
          ref={iconRef}
          className="mx-auto mb-4 w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center opacity-0"
        >
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        
        <h3 className="text-xl font-semibold text-neutral-900 mb-2 fade-in-up">
          {message}
        </h3>
        
        <p className="text-neutral-600 fade-in-up" style={{ animationDelay: '0.2s' }}>
          Your action was completed successfully
        </p>
      </div>
    </div>
  );
}