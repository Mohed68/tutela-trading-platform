# TUTELA - Physical Commodity Trading Platform

## Overview

TUTELA is a full-stack web application for secure physical commodity trading, specializing in Fuel & Hydrocarbons, Metals & Precious Metals, and Agricultural products. The platform combines AI-powered document validation, blockchain integration for smart contracts, and comprehensive partner verification systems to create a trusted trading environment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API design
- **Authentication**: Replit Auth integration with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **File Handling**: Multer for document uploads with local storage

### Database Architecture
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Neon serverless PostgreSQL with WebSocket support

## Key Components

### Authentication System
- **Provider**: Replit Auth with OIDC integration
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **User Management**: Mandatory user and session tables for Replit compatibility
- **Security**: HTTP-only cookies with secure session handling

### Trading Components
- **Commodities**: Three main categories (fuel_hydrocarbons, metals_precious, agricultural)
- **Offers**: Buy/sell listings with quantity, pricing, and delivery terms
- **Contracts**: Smart contract generation with blockchain integration
- **Partners**: Verification system for trusted trading relationships

### AI Integration
- **Document Validation**: OpenAI GPT-4o for authenticity verification
- **Extraction Services**: Automated data extraction from trading documents
- **Insights Dashboard**: AI-powered market analysis and recommendations

### Blockchain Services
- **Smart Contracts**: Mock blockchain service for contract deployment
- **Transaction Tracking**: Status monitoring and event logging
- **Contract Lifecycle**: From draft to execution with automated milestones

## Data Flow

1. **User Authentication**: Replit Auth → Session Creation → User Profile
2. **Commodity Trading**: Browse Offers → Create Contracts → Blockchain Deployment
3. **Document Verification**: Upload → AI Validation → Partner Approval
4. **Partner Management**: Discovery → Request → Verification → Trading

## External Dependencies

### Core Services
- **Neon Database**: Serverless PostgreSQL hosting
- **OpenAI API**: GPT-4o for document validation and AI insights
- **Replit Auth**: Authentication and user management

### Development Tools
- **Vite**: Frontend build tool with React plugin
- **TypeScript**: Type safety across the full stack
- **Tailwind CSS**: Utility-first styling framework
- **Drizzle**: Type-safe ORM and database toolkit

### UI Components
- **Radix UI**: Unstyled, accessible component primitives
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library for consistent iconography

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: esbuild bundles Node.js server to `dist/index.js`
- **Database**: Drizzle Kit manages schema migrations

### Environment Configuration
- **Development**: Local development with hot reload via Vite
- **Production**: Single Node.js process serving both API and static files
- **Database**: Environment-based connection strings for different stages

### File Structure
- **Client**: `/client` contains React frontend application
- **Server**: `/server` contains Express.js backend API
- **Shared**: `/shared` contains common TypeScript schemas and types
- **Database**: PostgreSQL schema defined in `/shared/schema.ts`

The application follows a monorepo structure with clear separation between client, server, and shared code, enabling efficient development and deployment while maintaining type safety across the entire stack.