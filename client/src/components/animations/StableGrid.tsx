import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface StableGridProps {
  children: ReactNode[];
  className?: string;
}

/**
 * Grid container that uses stable animations
 * Items animate in with transform/opacity only
 * No layout animations to prevent jitter
 */
export function StableGrid({ children, className = "" }: StableGridProps) {
  return (
    <div className={`grid ${className}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {children.map((child, index) => (
          <motion.div
            key={index}
            className="animated-layer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.2,
              delay: index * 0.05,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}