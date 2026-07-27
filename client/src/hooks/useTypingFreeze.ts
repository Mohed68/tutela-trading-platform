import React from "react";

/**
 * Hook to freeze animations while typing to prevent layout jitter
 * Call this in any input that triggers re-renders or list updates
 */
export function useTypingFreeze(delayMs = 140) {
  const timeoutRef = React.useRef<number | null>(null);

  return React.useCallback(() => {
    // Set typing state globally
    (window as any).__TUTELA_SET_TYPING__?.(true);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    
    // Set timeout to unfreeze animations after typing stops
    timeoutRef.current = window.setTimeout(() => {
      (window as any).__TUTELA_SET_TYPING__?.(false);
    }, delayMs);
  }, [delayMs]);
}