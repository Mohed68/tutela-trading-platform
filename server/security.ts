/**
 * Security Configuration for TUTELA Platform
 * 
 * This file contains comprehensive security header configurations
 * for protecting against common web vulnerabilities.
 */

export const securityHeaders = {
  // Content Security Policy configuration
  contentSecurityPolicy: {
    directives: {
      // Default fallback for all resource types
      defaultSrc: ["'self'"],
      
      // Script sources - allow Vite dev tools and required services
      scriptSrc: [
        "'self'",
        "'unsafe-eval'", // Required for Vite dev mode and dynamic imports
        "'unsafe-inline'", // Required for React inline scripts and Vite
        "https://js.stripe.com", // Stripe payment processing
        "https://apis.google.com", // Google services (analytics, fonts)
        "blob:", // For dynamic imports and worker scripts
      ],
      
      // CSS and style sources
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for CSS-in-JS, Tailwind, and component styles
        "https://fonts.googleapis.com", // Google Fonts CSS
      ],
      
      // Font sources
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com", // Google Fonts files
        "data:", // Base64 encoded fonts
      ],
      
      // Image sources - allow broad image loading for commodity trading
      imgSrc: [
        "'self'",
        "data:", // Base64 images and SVG data URIs
        "blob:", // Canvas-generated images
        "https:", // External commodity images and charts
      ],
      
      // Network connection sources
      connectSrc: [
        "'self'",
        "https://api.openai.com", // AI document validation
        "https://api.stripe.com", // Payment processing
        "wss://localhost:*", // Vite HMR WebSocket (dev only)
        "ws://localhost:*", // Vite HMR WebSocket (dev only)
        "https:", // External APIs for commodity data
      ],
      
      // Frame sources for embedded content
      frameSrc: [
        "'self'",
        "https://js.stripe.com", // Stripe payment forms
      ],
      
      // Media sources
      mediaSrc: ["'self'", "data:", "blob:"],
      
      // Object sources (disabled for security)
      objectSrc: ["'none'"],
      
      // Base URI restrictions
      baseUri: ["'self'"],
      
      // Form action restrictions
      formAction: ["'self'"],
      
      // Frame ancestors (prevent clickjacking)
      frameAncestors: ["'none'"],
      
      // Upgrade insecure requests in production
      upgradeInsecureRequests: [],
    },
    reportOnly: false, // Set to true for testing, false for enforcement
  },

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true, // Include in HSTS preload list
  },

  // X-Frame-Options (defense in depth against clickjacking)
  frameguard: {
    action: 'deny' // Completely prevent framing
  },

  // X-Content-Type-Options
  noSniff: true, // Prevent MIME type sniffing

  // Referrer Policy
  referrerPolicy: {
    policy: ["strict-origin-when-cross-origin"] // Balance privacy and functionality
  },

  // Cross-domain policies
  permittedCrossDomainPolicies: false,

  // Cross-Origin policies
  crossOriginEmbedderPolicy: false, // Allow third-party resources
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
};

// Permissions Policy (Feature Policy) configuration
export const permissionsPolicy = [
  'camera=()', // Block camera access
  'microphone=()', // Block microphone access
  'geolocation=(self)', // Allow geolocation for shipping
  'payment=(self)', // Allow payment API for Stripe
  'usb=()', // Block USB access
  'magnetometer=()', // Block magnetometer
  'gyroscope=()', // Block gyroscope
  'accelerometer=()', // Block accelerometer
  'fullscreen=(self)', // Allow fullscreen for charts
  'autoplay=()', // Block autoplay
  'picture-in-picture=()', // Block picture-in-picture
].join(', ');

// Additional security headers
export const additionalHeaders = {
  'X-DNS-Prefetch-Control': 'off', // Disable DNS prefetching
  'X-Download-Options': 'noopen', // Prevent IE from opening downloads
  'X-Permitted-Cross-Domain-Policies': 'none', // Block cross-domain policies
};

// Production-only headers
export const productionHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

/**
 * Security checklist for deployment:
 * 
 * ✓ Content Security Policy (CSP) - Prevents XSS attacks
 * ✓ HTTP Strict Transport Security (HSTS) - Enforces HTTPS
 * ✓ X-Frame-Options - Prevents clickjacking
 * ✓ X-Content-Type-Options - Prevents MIME sniffing
 * ✓ Referrer Policy - Controls referrer information
 * ✓ Permissions Policy - Controls browser features
 * ✓ X-DNS-Prefetch-Control - Prevents DNS leaks
 * ✓ Cross-Origin policies - Controls cross-origin requests
 * 
 * Additional production considerations:
 * - Ensure HTTPS is properly configured
 * - Monitor CSP violation reports
 * - Regular security header audits
 * - Update CSP directives as needed
 */