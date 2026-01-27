TUTELA – Physical Commodity Trading Platform (V2)

TUTELA is a full-stack web platform for managing and securing physical commodity trading workflows such as oil, fuels, metals, and agricultural products.

The platform focuses on:

Company verification

Offer and contract management

Document handling

AI-assisted validation

Centralized trade data

This project is currently an MVP intended for controlled pilots and further development.

🧩 Features

Company registration & verification

Commodity and offer listings

Trade contract workflow

File upload for commercial documents

AI-assisted document validation (OpenAI)

REST API backend

Modern React UI

🏗️ Tech Stack
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

Required:

DATABASE_URL=
OPENAI_API_KEY=
SESSION_SECRET=
REPL_ID=
ISSUER_URL=
REPLIT_DOMAINS=
PORT=5000


If deploying outside Replit, authentication callback URLs and domains must be updated accordingly.

🖥️ Local Development

Install dependencies:

npm install


Run database migrations:

npm run db:push


Start development server:

npm run dev


Application runs on:

http://localhost:5000

🏗️ Build & Run (Production)
npm run build
npm start


Requirements:

PostgreSQL database

All environment variables configured

Node.js runtime (not static hosting)

☁️ Deployment

Supported platforms:

Replit Deployments

Render

Railway

Fly.io

VPS (Ubuntu + Node + PM2)

Not suitable for:

Netlify (static only)

GitHub Pages

Static-only hosting

📦 File Uploads

Files are stored locally in the uploads/ directory.

⚠️ On many cloud platforms, local storage is temporary.

For production:

Use S3 / Cloudflare R2 / Blob storage

Store file references in the database

🔐 Security & Limitations

Server-side sessions

No blockchain integration yet

No automated tests

No CI/CD pipeline

Not production-hardened

This version is intended as an MVP.

🗺️ Roadmap

Independent authentication provider

External file storage

Smart contract integration

Role-based permissions

Audit logging

CI/CD

Automated testing

Compliance modules

📜 License

MIT License

👤 Author

Mohamed Emad
Founder – TUTELA Platform
