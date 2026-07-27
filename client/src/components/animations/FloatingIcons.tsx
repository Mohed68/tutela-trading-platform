import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Shield, Zap, Globe, Star, Lock } from 'lucide-react';

interface FloatingIconsProps {
  className?: string;
}

export function FloatingIcons({ className }: FloatingIconsProps) {
  const icons = [
    { Icon: TrendingUp, color: 'text-emerald-500', x: '10%', y: '20%' },
    { Icon: Shield, color: 'text-blue-500', x: '80%', y: '15%' },
    { Icon: Zap, color: 'text-yellow-500', x: '15%', y: '70%' },
    { Icon: Globe, color: 'text-purple-500', x: '85%', y: '60%' },
    { Icon: Star, color: 'text-pink-500', x: '50%', y: '80%' },
    { Icon: Lock, color: 'text-red-500', x: '70%', y: '30%' },
  ];

  const iconVariants = {
    float: {
      y: [0, -6, 0],
      transition: {
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  // Don't render if user prefers reduced motion
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null;
  }

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {icons.map((iconData, index) => {
        const Icon = iconData.Icon;
        return (
          <motion.div
            key={index}
            className={`absolute opacity-10 ${iconData.color}`}
            style={{ 
              left: iconData.x,
              top: iconData.y,
              transform: 'translate(-50%, -50%)'
            }}
            variants={iconVariants}
            animate="float"
            transition={{ delay: index * 1 }}
          >
            <Icon size={24} />
          </motion.div>
        );
      })}
    </div>
  );
}