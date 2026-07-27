import React from 'react';

interface TutelaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export default function TutelaLogo({ size = 'md', showText = false, className = '' }: TutelaLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img 
        src="/tutela-logo.png" 
        alt="TUTELA Logo" 
        className={`object-contain transition-transform duration-200 hover:scale-105 ${sizeClasses[size]}`}
        onError={(e) => {
          // Fallback to text-based logo if image fails
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          target.nextElementSibling?.classList.remove('hidden');
        }}
      />
      {/* Fallback logo */}
      <div 
        className={`${sizeClasses[size]} rounded-lg flex items-center justify-center hidden bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-sm`}
      >
        <span className="text-white font-bold text-xl">T</span>
      </div>
      
      {showText && (
        <div>
          <h1 className={`font-bold text-neutral-900 ${textSizeClasses[size]}`}>
            TUTELA
          </h1>
          {size === 'lg' && (
            <p className="text-sm text-neutral-600 font-medium">Physical Commodity Trading</p>
          )}
        </div>
      )}
    </div>
  );
}