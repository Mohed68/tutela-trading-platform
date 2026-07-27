import React from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'scale' | 'none';
  delay?: number;
  duration?: number;
  threshold?: number;
  triggerOnce?: boolean;
}

export function ScrollReveal({
  children,
  className,
  animation = 'fade-up',
  delay = 0,
  duration = 600,
  threshold = 0.1,
  triggerOnce = true
}: ScrollRevealProps) {
  const { elementRef, hasIntersected } = useIntersectionObserver({
    threshold,
    triggerOnce
  });

  const animationClasses = {
    'fade-up': hasIntersected ? 'fade-in-up' : 'opacity-0 translate-y-8',
    'fade-in': hasIntersected ? 'fade-in-scale' : 'opacity-0',
    'slide-left': hasIntersected ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8',
    'slide-right': hasIntersected ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8',
    'scale': hasIntersected ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
    'none': ''
  } as const;

  return (
    <div
      ref={elementRef}
      className={cn(
        'transition-all ease-out',
        animationClasses[animation],
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}