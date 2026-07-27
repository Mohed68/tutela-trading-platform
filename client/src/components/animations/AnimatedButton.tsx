import React, { useRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { rippleEffect, scaleOnHover } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface AnimatedButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'sparkle' | 'magnetic';
  size?: 'sm' | 'md' | 'lg';
  animation?: 'ripple' | 'scale' | 'magnetic' | 'sparkle';
  children: React.ReactNode;
}

export function AnimatedButton({ 
  variant = 'default', 
  size = 'md', 
  animation = 'ripple',
  className,
  children,
  onClick,
  ...props 
}: AnimatedButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!buttonRef.current) return;

    if (animation === 'scale') {
      scaleOnHover(buttonRef.current);
    }
  }, [animation]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (animation === 'ripple' && buttonRef.current) {
      rippleEffect(buttonRef.current, e.nativeEvent);
    }
    onClick?.(e);
  };

  const buttonClass = cn(
    'relative overflow-hidden transition-all duration-200',
    animation === 'sparkle' && 'btn-sparkle',
    animation === 'magnetic' && 'hover:shadow-lg',
    className
  );

  const mappedVariant = variant === 'sparkle' || variant === 'magnetic' ? 'default' : variant;
  const mappedSize = size === 'md' ? 'default' : size;

  return (
    <Button
      ref={buttonRef}
      variant={mappedVariant}
      size={mappedSize}
      className={buttonClass}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Button>
  );
}