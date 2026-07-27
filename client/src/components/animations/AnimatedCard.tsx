import React, { useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { floatingAnimation, slideIn, magneticEffect } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'floating' | 'slideIn' | 'magnetic' | 'hover-lift' | 'none';
  slideDirection?: 'left' | 'right' | 'top' | 'bottom';
  delay?: number;
  floating?: boolean;
  magnetic?: boolean;
}

export function AnimatedCard({ 
  children, 
  className,
  animation = 'hover-lift',
  slideDirection = 'left',
  delay = 0,
  floating = false,
  magnetic = false
}: AnimatedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;

    if (animation === 'floating' || floating) {
      floatingAnimation(cardRef.current, { delay });
    }

    if (animation === 'slideIn') {
      slideIn(cardRef.current, slideDirection, { delay });
    }

    if (animation === 'magnetic' || magnetic) {
      magneticEffect(cardRef.current, 0.2);
    }
  }, [animation, slideDirection, delay, floating, magnetic]);

  const cardClass = cn(
    'transition-all duration-300',
    animation === 'hover-lift' && 'hover:-translate-y-2 hover:shadow-xl',
    animation === 'magnetic' && 'cursor-pointer',
    className
  );

  return (
    <Card ref={cardRef} className={cardClass}>
      {children}
    </Card>
  );
}