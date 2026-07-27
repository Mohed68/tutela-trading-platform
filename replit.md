# TUTELA - Physical Commodity Trading Platform

## Overview

TUTELA is a full-stack web application for secure physical commodity trading across Fuel & Hydrocarbons, Metals & Precious Metals, and Agricultural products. Its core purpose is to provide a trusted trading environment by integrating AI-powered document validation, blockchain for smart contracts, comprehensive partner verification, and complete orders management with payment processing. The platform aims to facilitate secure, efficient, and transparent commodity trades.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite.
- **UI/UX**: shadcn/ui components based on Radix UI primitives, styled with Tailwind CSS.
- **State Management**: TanStack Query for server state.
- **Routing**: Wouter for client-side routing.
- **Forms**: React Hook Form with Zod validation.
- **Animations**: Framer Motion for animations, featuring global motion freeze during typing, jitter elimination through transform/opacity properties, accessibility support for reduced motion, and GPU optimization.
- **Design Elements**: Gradient backgrounds, enhanced shadows, improved typography, and interactive elements like buttons with gradients and hover effects.
- **Security Headers**: Comprehensive security header configuration including CSP, HSTS, XFO, Referrer-Policy, and Permissions-Policy.
- **Error Handling**: Global ErrorBoundary component and intelligent NotFound page with recovery options.
- **Performance**: Static HTML prerendering for public pages and advanced SEO infrastructure.
- **Visuals**: Official green 3D TUTELA logo integration.

### Backend Architecture
- **Runtime**: Node.js with Express.js framework, written in TypeScript.
- **API**: RESTful API design.
- **Authentication**: Replit Auth integration with OpenID Connect for user authentication and session management using Express sessions with PostgreSQL storage.
- **File Handling**: Secure cloud-based object storage for sensitive documents (e.g., KYB documents) using presigned URLs, replacing local file storage. Comprehensive ACL system for document access control.

### Database Architecture
- **Primary Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM for type-safe operations.
- **Schema Management**: Drizzle Kit for migrations.

### Key Features and Implementations
- **Authentication**: Replit Auth, PostgreSQL-backed sessions, HTTP-only cookies.
- **Trading**: Support for three commodity categories, offer listings, smart contract generation, and partner verification.
- **AI Integration**: OpenAI GPT-4o for document validation and data extraction; AI-powered insights dashboard.
- **Blockchain**: Mock blockchain service for smart contract deployment, transaction tracking, and lifecycle management.
- **Orders Management**: Comprehensive order tracking with smart contract integration and payment status monitoring.
- **Data Consistency**: Unified DatabaseStorage across all endpoints to ensure data consistency in the marketplace.

## External Dependencies

### Core Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **OpenAI API**: GPT-4o for AI-powered document validation and insights.
- **Replit Auth**: Authentication and user management.
- **Sentry Monitoring**: Real-time error tracking and performance monitoring for both frontend (`VITE_SENTRY_DSN`) and backend (`SENTRY_BACKEND_DSN`).
- **Stripe**: Payment processing (configured for deferred activation).

### Development Tools
- **Vite**: Frontend build tool.
- **TypeScript**: Language for full-stack development.
- **Tailwind CSS**: Styling framework.
- **Drizzle**: ORM and database toolkit.

### UI Components
- **Radix UI**: Unstyled component primitives.
- **shadcn/ui**: Pre-built component library.
- **Lucide React**: Icon library.