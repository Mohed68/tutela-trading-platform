import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  onClick?: () => void;
}

/**
 * Stable card animation using only transform/opacity
 * No layout animations that cause jitter
 */
export function MotionCard({ children, className = "", delay = 0, onClick }: MotionCardProps) {
  return (
    <motion.div
      className={`animated-layer stable-card ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.3,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{
        y: -2,
        transition: { duration: 0.2 }
      }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}