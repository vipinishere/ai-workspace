# AI Workspace — Production SaaS Platform

A production-grade, multi-tenant AI workspace SaaS platform with modular AI model subscriptions, real-time token tracking, team collaboration, and a marketplace architecture.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | Clerk |
| Payments | Stripe |
| AI Routing | OpenRouter + Direct Providers |
| Deployment | Vercel (frontend) + Railway (backend) |

## Project Structure

```
ai-workspace/
├── frontend/          # Next.js 15 App Router
├── backend/           # FastAPI Python backend
├── docker-compose.yml # Local development
└── README.md
```

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+

### 1. Clone and setup environment

```bash
# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Fill in your API keys in both .env files
```

### 2. Start infrastructure

```bash
docker-compose up -d postgres redis
```

### 3. Start backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at: http://localhost:3000

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql+asyncpg://aiworkspace:aiworkspace_secret@localhost:5432/aiworkspace
REDIS_URL=redis://localhost:6379/0
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
ENCRYPTION_KEY=<generate with: python -c "import os; print(os.urandom(32).hex())">
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
OPENROUTER_API_KEY=sk-or-...
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Features

- 🤖 **Multi-Model AI Chat** — Chat with GPT-4o, Claude 3.5, Gemini 2.0, Grok, DeepSeek
- 💳 **Modular Subscriptions** — Pay only for the AI models you select
- 📊 **Real-Time Token Tracking** — Live usage dashboard with cost analytics  
- 🔑 **BYOK Support** — Bring Your Own API Keys with AES-256 encryption
- 🏢 **Team Workspaces** — Collaborate with role-based access control
- 🛒 **AI Marketplace** — Browse and deploy pre-built AI agents
- ⚡ **Streaming Responses** — SSE-powered real-time AI responses
- 📈 **Usage Analytics** — Detailed charts and exportable reports

## API Documentation

Backend API docs available at: http://localhost:8000/docs

## Deployment

### Vercel (Frontend)
```bash
cd frontend
npx vercel --prod
```

### Railway (Backend + PostgreSQL + Redis)
1. Create new project on Railway
2. Add PostgreSQL and Redis plugins
3. Deploy from `backend/` directory
4. Set all environment variables

## Security

- AES-256-GCM encryption for stored API keys
- Clerk JWT verification on all protected endpoints
- Redis-based rate limiting
- CORS protection
- Webhook signature verification (Clerk + Stripe)

## License

MIT
