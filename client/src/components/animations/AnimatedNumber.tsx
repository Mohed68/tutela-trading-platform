import React, { useEffect, useRef, useState } from 'react';
import { animateNumber } from '@/lib/animations';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trigger?: boolean; // When to start animation
}

export function AnimatedNumber({ 
  value, 
  duration = 2000, 
  className,
  prefix = '',
  suffix = '',
  decimals = 0,
  trigger = true
}: AnimatedNumberProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!elementRef.current || !trigger || hasAnimated) return;

    const formatValue = (num: number) => {
      const formatted = num.toFixed(decimals);
      return `${prefix}${formatted}${suffix}`;
    };

    const startValue = 0;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (value - startValue) * easeOutQuart;
      
      if (elementRef.current) {
        elementRef.current.textContent = formatValue(current);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (elementRef.current) {
          elementRef.current.textContent = formatValue(value);
        }
        setHasAnimated(true);
      }
    };

    animate();
  }, [value, duration, prefix, suffix, decimals, trigger, hasAnimated]);

  return <span ref={elementRef} className={className}>0</span>;
}