TUTELA – Physical Commodity Trading Platform (V2)

TUTELA is a full-stack web platform designed to digitize and organize physical commodity trading workflows (oil, fuels, metals, and agricultural products).

The platform focuses on solving real operational problems in commodity trading:

Lack of trust between counterparties

Manual and fragmented documentation

Weak verification processes

Poor visibility over trade lifecycle

This version represents an MVP (Minimum Viable Product) intended for pilot usage and further development.

🌍 What Does TUTELA Do?

TUTELA provides a centralized system to manage:

Companies and counterparties

Commodity offers and requests

Trade contracts

Commercial documents

Basic risk and document validation

It is not a crypto exchange and not a DeFi platform.
It targets real-world physical trade operations.

✨ Key Features

Company registration and verification

Commodity and offer listing

Trade contract lifecycle management

Commercial document uploads

AI-assisted document validation (OpenAI)

REST API backend

Modern, responsive React UI

🧱 Technology Stack
Frontend

React 18

TypeScript

Vite

Tailwind CSS

shadcn/ui

TanStack Query

Wouter Router

Backend

Node.js

Express

TypeScript

Multer (file uploads)

Database

PostgreSQL

Drizzle ORM

External Services

OpenAI API

Replit Auth (OIDC)

📂 Project Structure
client/     → Frontend (React)
server/     → Backend (Express API)
shared/     → Shared schemas & types
uploads/    → Uploaded files (local storage)
migrations/ → Database migrations

⚙️ Environment Variables

Create a .env file based on .env.example.

Required variables:

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


The application will be available at:

http://localhost:5000

🏗️ Production Build
npm run build
npm start


Requirements:

A running PostgreSQL database

All environment variables configured

A Node.js runtime (not static hosting)

☁️ Deployment Options

Supported deployment platforms:

Replit Deployments

Render

Railway

Fly.io

VPS (Ubuntu + Node + PM2)

Not suitable for:

Netlify

GitHub Pages

Static-only hosting

📦 File Uploads

Uploaded files are stored locally in the uploads/ directory.

⚠️ On most cloud platforms, local file storage is temporary and can be lost after redeployments.

For production usage:

Use S3 / Cloudflare R2 / Azure Blob Storage

Store only file references in the database

🔐 Security & Limitations

Server-side session handling

No blockchain integration yet

No automated test suite

No CI/CD pipeline

Not hardened for high-risk financial operations

This version is intended for controlled pilots and development only.

🗺️ Roadmap

Planned improvements:

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
