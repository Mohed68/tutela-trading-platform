🚀 TUTELA – Physical Commodity Trading Platform (V2)

A comprehensive digital trading platform for physical commodities with AI-powered validation and structured trade workflows.

Designed to support real-world trading of:

🛢️ Oil, fuels, and refined products

⚙️ Metals and minerals

🌾 Agricultural commodities

TUTELA focuses on improving trust, verification, and operational control in physical commodity trading.

🌍 Overview

TUTELA is a full-stack web application built to manage and organize physical commodity trading workflows (off-chain).

It addresses key operational challenges:

Lack of trust between counterparties

Manual and fragmented documentation

Weak verification processes

Poor visibility over trade lifecycle

This version represents an MVP (Minimum Viable Product) intended for pilot usage and further development.

✨ Key Features
🔐 Security & Authentication

Secure user authentication

Session management

Role-based access (buyer / seller)

🤖 AI-Powered Validation

Document analysis using OpenAI

Basic fraud and anomaly detection

Contract and document consistency checks

📄 Trade & Document Management

Commodity and offer listing

Trade contract lifecycle management

Commercial document uploads

Centralized trade data view

🏗️ (Planned) Blockchain Integration

Smart contract execution (roadmap)

Immutable transaction records (roadmap)

Transparent contract status tracking (roadmap)

🧩 Partner Verification

Company registration and verification

Business document validation

Trade history and activity logs

🧱 Technology Stack
Frontend

⚛️ React 18

🟦 TypeScript

⚡ Vite

🎨 Tailwind CSS

🧩 shadcn/ui

🔄 TanStack Query

🧭 Wouter Router

Backend

🟢 Node.js

🚀 Express

🟦 TypeScript

📤 Multer (file uploads)

Database

🐘 PostgreSQL

🧬 Drizzle ORM

External Services

🤖 OpenAI API

🔑 Replit Auth (OIDC)

📂 Project Structure
client/     → Frontend (React)
server/     → Backend (Express API)
shared/     → Shared schemas & types
uploads/    → Uploaded files (local storage)
migrations/ → Database migrations

⚙️ Environment Variables

Create a .env file based on .env.example.

Required:

DATABASE_URL=
OPENAI_API_KEY=
SESSION_SECRET=
REPL_ID=
ISSUER_URL=
REPLIT_DOMAINS=
PORT=5000


⚠️ When deploying outside Replit, authentication callback URLs and allowed domains must be configured correctly.

🧪 Local Development

Install dependencies:

npm install


Run database migrations:

npm run db:push


Start development server:

npm run dev


Application runs at:

http://localhost:5000

🏗️ Build & Run (Production)
npm run build
npm start


Requirements:

PostgreSQL database

All environment variables configured

Node.js runtime (not static hosting)

☁️ Deployment Options
✅ Supported

Replit Deployments

Render

Railway

Fly.io

VPS (Ubuntu + Node + PM2)

❌ Not Suitable

Netlify

GitHub Pages

Static-only hosting

📦 File Uploads

Uploaded files are stored locally in the uploads/ directory.

⚠️ On most cloud platforms, local file storage is temporary.

For production:

Use S3 / Cloudflare R2 / Azure Blob Storage

Store file references in the database

🔐 Security & Limitations

Server-side session handling

No active blockchain layer yet

No automated test suite

No CI/CD pipeline

Not hardened for high-risk financial operations

This version is intended for controlled pilots and development.

🗺️ Roadmap

Independent authentication provider

External file storage

Smart contract integration

Role-based permissions

Audit logging

CI/CD pipeline

Automated tests

Compliance modules

🧠 Design Principles

TUTELA is built around:

Real-world commodity workflows

Operational trust

Document-driven processes

Trade transparency

Gradual technical hardening

It focuses on practical trade operations, not speculation.

📜 License

MIT License

👤 Author

Mohamed Emad
Founder – TUTELA Platform
