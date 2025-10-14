# TUTELA - Physical Commodity Trading Platform

A comprehensive digital trading platform for physical commodities with AI-powered validation, blockchain integration, and verified partner networks.

![TUTELA Platform](https://img.shields.io/badge/Platform-TUTELA-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-green?style=for-the-badge)

## 🌟 Overview

TUTELA is a full-stack web application for secure physical commodity trading, specializing in:
- **Fuel & Hydrocarbons** (Crude Oil, Natural Gas, Refined Products)
- **Metals & Precious Metals** (Gold, Silver, Copper, Steel)
- **Agricultural Products** (Wheat, Soybeans, Coffee, Cotton)

The platform combines AI-powered document validation, blockchain integration for smart contracts, and comprehensive partner verification systems to create a trusted trading environment.

## 🚀 Key Features

### 🔐 Security & Authentication
- **Replit Auth Integration** with OpenID Connect
- **Session Management** with PostgreSQL storage
- **Role-based Access Control** for verified traders

### 🤖 AI-Powered Validation
- **Document Authentication** using OpenAI GPT-4o
- **Fraud Detection** with advanced pattern recognition
- **Market Insights** and trading recommendations

### ⛓️ Blockchain Integration
- **Smart Contracts** for secure transactions
- **Immutable Transaction Records** on blockchain
- **Automated Contract Execution** with milestone tracking

### 👥 Partner Verification
- **Financial Rating System** with credit score validation
- **Business Credential Verification** for qualified partners
- **Trusted Network** of verified commodity traders

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **shadcn/ui** components built on Radix UI
- **Tailwind CSS** with custom design system
- **TanStack Query** for server state management
- **Wouter** for lightweight routing

### Backend
- **Node.js** with Express.js framework
- **TypeScript** with ES modules
- **RESTful API** design pattern
- **Multer** for document upload handling

### Database
- **PostgreSQL** with Neon serverless hosting
- **Drizzle ORM** for type-safe operations
- **Automated Migrations** with Drizzle Kit

### External Services
- **OpenAI API** for AI validation (GPT-4o)
- **Replit Auth** for authentication
- **Neon Database** for serverless PostgreSQL

## 📊 Demo Data

The platform includes comprehensive demo data featuring:

### 9 Active Trading Offers
- **WTI Crude Oil** - $78.45/barrel (10,000 barrels available)
- **Gold Bullion** - $775,000/400oz bar (100 bars available)
- **Hard Red Winter Wheat** - $285/metric ton (5,000 MT available)
- **Natural Gas** - $2.85/MMBtu (50,000 MMBtu available)
- **Silver Bullion** - $23,500/1000oz bar (500 bars available)
- **Copper Cathode** - $8,450/metric ton (250 MT available)
- **Soybeans** - $445/metric ton (10,000 MT available)
- **Brent Crude Oil** - $82.20/barrel (25,000 barrels available)
- **Arabica Coffee** - $195/60kg bag (100 bags available)

### Total Marketplace Value: $2.1B+

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (Neon recommended)
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/tutela-trading-platform.git
   cd tutela-trading-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy and configure your environment
   cp .env.example .env
   ```

4. **Configure database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 🔧 Environment Variables

```env
DATABASE_URL=your_postgresql_connection_string
OPENAI_API_KEY=your_openai_api_key
SESSION_SECRET=your_session_secret
REPL_ID=your_replit_app_id
ISSUER_URL=https://replit.com/oidc
REPLIT_DOMAINS=your-domain.replit.dev
```

## 📁 Project Structure

```
tutela-trading-platform/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                 # Express.js backend API
│   ├── services/          # Business logic services
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database operations
│   └── seedData.ts        # Demo data seeding
├── shared/                # Common TypeScript schemas
│   └── schema.ts          # Database schema definitions
└── uploads/               # File upload directory
```

## 🚀 Deployment

### Replit Deployment (Recommended)
1. Connect your GitHub repository to Replit
2. Configure environment variables in Replit Secrets
3. Deploy using Replit Deployments

### Manual Deployment
1. Build the application: `npm run build`
2. Set up PostgreSQL database
3. Configure environment variables
4. Start production server: `npm start`

## 🔑 API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user
- `GET /api/login` - Initiate login flow
- `GET /api/logout` - Logout user

### Commodities & Offers
- `GET /api/commodities` - List all commodities
- `GET /api/offers/search` - Search trading offers
- `POST /api/offers` - Create new offer
- `GET /api/offers/:id` - Get offer details

### Contracts & Verification
- `GET /api/contracts` - List user contracts
- `POST /api/contracts` - Create new contract
- `POST /api/verification/documents` - Upload verification documents
- `GET /api/verification/pending` - Get pending verifications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Contact the development team
- Check the documentation in `/docs`

## 🎯 Future Roadmap

- [ ] Multi-currency support with real-time exchange rates
- [ ] Advanced analytics dashboard with market trends
- [ ] Mobile application for iOS and Android
- [ ] Integration with major commodity exchanges
- [ ] Advanced AI trading recommendations
- [ ] Multi-language support for global markets

---

**TUTELA** - Transforming Physical Commodity Trading with Technology