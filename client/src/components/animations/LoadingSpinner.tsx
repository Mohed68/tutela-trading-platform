import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'morphing' | 'pulse';
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  variant = 'spinner',
  className 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center space-x-1', className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-full bg-emerald-600 animate-pulse',
              size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
            )}
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1.4s'
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'morphing') {
    return (
      <div 
        className={cn(
          'bg-gradient-to-r from-emerald-600 to-blue-600 rounded-full',
          sizeClasses[size],
          className
        )}
        style={{ animation: 'morphing 2s ease-in-out infinite' }}
      />
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('relative', sizeClasses[size], className)}>
        <div className="absolute inset-0 rounded-full bg-emerald-600 animate-ping opacity-75" />
        <div className="relative rounded-full bg-emerald-600 h-full w-full" />
      </div>
    );
  }

  // Default spinner
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600',
        sizeClasses[size],
        className
      )}
    />
  );
}