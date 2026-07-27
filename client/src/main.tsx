import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";
import { initializeClientMonitoring } from "./lib/monitoring";

function Root() {
  const [typing, setTyping] = React.useState(false);

  // Initialize Sentry monitoring once
  React.useEffect(() => {
    // Prevent double initialization
    if (!(window as any).__SENTRY_INITIALIZED__) {
      initializeClientMonitoring();
      (window as any).__SENTRY_INITIALIZED__ = true;
    }
  }, []);

  // Global setter used by inputs via the useTypingFreeze hook
  React.useEffect(() => {
    (window as any).__TUTELA_SET_TYPING__ = (value: boolean) => setTyping(value);
    
    // Cleanup on unmount
    return () => {
      delete (window as any).__TUTELA_SET_TYPING__;
    };
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig
        reducedMotion="user"
        transition={
          typing
            ? { duration: 0 } // freeze animations while typing
            : { type: "spring", damping: 22, stiffness: 240, mass: 0.9 }
        }
      >
        <App />
      </MotionConfig>
    </LazyMotion>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
