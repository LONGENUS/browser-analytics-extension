# Browser Analytics Extension

[![CI](https://github.com/LONGENUS/browser-analytics-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/LONGENUS/browser-analytics-extension/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vercel](https://img.shields.io/badge/Deployment-Vercel-black.svg)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg)](https://supabase.com)

An AI-powered web intelligence and extraction Chrome Extension paired with an asynchronous FastAPI backend, ready for local development and cloud production deployment on **Vercel** and **Supabase**. Extract structured product data, calculate real-time analytics, inspect SEO metadata, and export reports in CSV, Excel, or JSON formats in a single click.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Client["Client Tier"]
        CE["Chrome Extension (Manifest V3)\n• Popup UI (Vanilla JS + CSS)\n• Background Service Worker\n• Dynamic Config (config.js)"]
    end

    subgraph Hosting["Hosting & API Tier"]
        Vercel["Vercel Serverless Platform\n• ASGI Entrypoint (api/index.py)\n• Route Rewrites (vercel.json)\n• Edge CDN & CORS Headers"]
        Local["Localhost:8000\n• FastAPI Core (backend/app.py)\n• Crawl4AI + Playwright"]
    end

    subgraph Database["Persistence & Auth Tier"]
        SupaDB[("Supabase PostgreSQL\n• Tables: users, analyses, exports\n• Row Level Security (RLS)\n• JSONB Metrics & Indexes")]
        SQLite[("Local SQLite\n(backend/webintel.db)")]
    end

    CE -- "Production (HTTPS)" --> Vercel
    CE -- "Development (HTTP)" --> Local
    Vercel -- "asyncpg / Transaction Pooler (6543)" --> SupaDB
    Local -- "aiosqlite" --> SQLite
    Local -.-> SupaDB
```

---

## Table of Contents
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Production Deployment](#production-deployment)
  - [1. Supabase Setup](#1-supabase-setup)
  - [2. Vercel Deployment](#2-vercel-deployment)
  - [3. Chrome Extension Configuration](#3-chrome-extension-configuration)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [CI/CD Pipeline](#cicd-pipeline)
- [Git Workflow](#git-workflow)
- [Security Checklist](#security-checklist)
- [License](#license)

---

## Key Features

- **One-Click Page Intelligence**: Instantly identify product listings, pricing distributions, unique ASINs, brands, and ratings.
- **Deep DOM Crawling (Crawl4AI & Playwright)**: Employs headless browser automation tailored to handle JavaScript-heavy platforms like Amazon and Flipkart.
- **SEO & Structure Inspection**: Extracts meta descriptions, headings (H1–H6), canonical URLs, and structured schema tags.
- **Dynamic Summarization**: Automatically produces structured bulleted summaries (or optional GPT-powered contextual overviews).
- **Multi-Format Export**: One-click download of collected data to `.csv`, `.xlsx` (Excel), or `.json`.
- **Hybrid Cloud Storage**: Historical runs persisted to Supabase PostgreSQL in production or SQLite in local development.
- **Serverless Ready**: Configured for zero-config ASGI deployment on Vercel with automated GitHub CI integration.

---

## Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Extension Core** | Chrome Manifest V3 | Modern service worker & isolated content scripts |
| **Extension UI** | HTML5, Vanilla CSS3, JavaScript | Lightweight, zero-dependency responsive popup |
| **Cloud Hosting** | Vercel Serverless | ASGI serverless execution with `/api/index.py` |
| **Production DB** | Supabase (PostgreSQL 15+) | Managed PostgreSQL, Row Level Security, JSONB |
| **Local Backend** | FastAPI (Python 3.11+) | Asynchronous REST endpoints |
| **Crawler Engine** | Crawl4AI + Playwright | Anti-detection, headless DOM parsing |
| **ORM & Drivers** | SQLAlchemy 2.0 + asyncpg | Async connection pooling & automatic dialect detection |
| **Export Formats** | Pandas, OpenPyXL, CSV | Structured tabular exports |
| **CI/CD** | GitHub Actions | Automated manifest, JS syntax, and Python compilation |

---

## Folder Structure

```
browser-analytics-extension/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow (Extension + Backend + Migrations)
├── api/
│   └── index.py                 # Vercel ASGI serverless wrapper
├── backend/                     # FastAPI Backend & Crawler Service
│   ├── app.py                   # Application entry point
│   ├── config.py                # Environment configuration & asyncpg normalizer
│   ├── requirements.txt         # Backend Python dependencies
│   ├── Dockerfile               # Container definition
│   ├── models/                  # SQLAlchemy database models (PostgreSQL & SQLite)
│   ├── routes/                  # API routes (analyze, export, history)
│   ├── schemas/                 # Extraction CSS selectors & schemas
│   └── services/                # Crawler, analytics, and exporter services
├── extension/                   # Chrome Extension (Manifest V3)
│   ├── manifest.json            # Extension manifest configuration
│   ├── config.js                # Centralized environment & API configuration
│   ├── popup/                   # Extension popup interface & logic
│   ├── content/                 # Content script for live DOM interaction
│   ├── background/              # Background service worker & API broker
│   ├── utils/                   # Client-side API and export helpers
│   └── assets/                  # Icons and static resources
├── supabase/
│   └── migrations/
│       └── 20260923000001_create_schema.sql  # PostgreSQL schema, tables & RLS policies
├── docs/                        # Project documentation
│   ├── ARCHITECTURE.md          # Detailed architectural breakdown
│   └── API.md                   # REST API specification
├── shared/                      # Shared types & JSON schemas
├── .env.example                 # Root environment variables template
├── requirements.txt             # Root Python requirements for Vercel builder
├── vercel.json                  # Vercel routing rewrites & security headers
├── docker-compose.yml           # Multi-container orchestration
├── .gitignore                   # Version control ignore rules
├── LICENSE                      # MIT License
└── README.md                    # Project documentation
```

---

## Production Deployment

### 1. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in the Supabase Dashboard.
3. Open `supabase/migrations/20260923000001_create_schema.sql`, copy its content, and execute it.
   - This creates `users`, `analyses`, and `exports` tables with indexing and Row Level Security (RLS).
4. Navigate to **Project Settings -> Database** and copy the **Connection string** (URI). Select **Transaction Pooler** (port `6543`) for serverless environments.
5. Navigate to **Project Settings -> API** to retrieve your `SUPABASE_URL`, `anon public key`, and `service_role secret`.

### 2. Vercel Deployment

1. Push your repository to GitHub: `https://github.com/LONGENUS/browser-analytics-extension`.
2. Log in to [Vercel](https://vercel.com) and click **Add New -> Project**.
3. Import the `browser-analytics-extension` GitHub repository.
4. Set the **Framework Preset** to **Other** (Root directory `./`).
5. Configure the following **Environment Variables** in the Vercel dashboard:
   - `DATABASE_URL`: `postgresql+asyncpg://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
   - `SUPABASE_URL`: `https://[PROJECT-REF].supabase.co`
   - `SUPABASE_ANON_KEY`: `eyJhbGciOi...`
   - `SUPABASE_SERVICE_ROLE_KEY`: `eyJhbGciOi...`
   - `API_BASE_URL`: `https://your-vercel-project.vercel.app`
   - `DEBUG`: `false`
6. Click **Deploy**. Vercel will build the ASGI function at `/api/index.py` using `requirements.txt`.

### 3. Chrome Extension Configuration

1. In `extension/config.js`, set `ENVIRONMENT: 'production'` and verify your Vercel deployment URL:
   ```javascript
   ENVIRONMENTS: {
     production: {
       API_BASE_URL: 'https://your-vercel-project.vercel.app',
       SUPABASE_URL: 'https://your-project-ref.supabase.co',
       TIMEOUT_MS: 60000,
     }
   }
   ```
2. In Google Chrome:
   - Navigate to `chrome://extensions`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `extension/` directory.
3. You can also override the API endpoint at runtime in the extension settings without modifying code.

---

## Local Development

### 1. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
playwright install chromium
```

### 2. Running Local Backend
```bash
python app.py
```
The local server runs on `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.

### 3. Extension Local Testing
In `extension/config.js`, set `ENVIRONMENT: 'development'` to route extension calls to `http://localhost:8000`.

---

## Environment Variables

| Variable | Required in Prod | Description | Default / Example |
|---|---|---|---|
| `API_BASE_URL` | Yes | Base URL used by clients | `https://your-project.vercel.app` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql+asyncpg://postgres:...@pooler.supabase.com:6543/postgres` |
| `SUPABASE_URL` | Yes | Supabase project API URL | `https://[ref].supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Supabase client anon key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase admin key | `eyJhbGciOi...` |
| `DEBUG` | No | FastAPI debug mode | `false` |
| `REDIS_URL` | No | Redis caching endpoint | Empty (disabled) |
| `OPENAI_API_KEY` | No | OpenAI key for AI summaries | Optional |

---

## CI/CD Pipeline

The project uses GitHub Actions (`.github/workflows/ci.yml`) to enforce code standards before any merge:
- **Chrome Extension**: Validates Manifest V3 specifications and validates JavaScript syntax on all extension scripts (`config.js`, `api.js`, `service-worker.js`, `popup.js`).
- **Backend & Serverless API**: Compiles Python backend modules and the `api/index.py` Vercel ASGI gateway.
- **Deployment Specs**: Validates `vercel.json` routing structure and ensures Supabase SQL schema migrations syntax is intact.

---

## Git Workflow

To maintain code quality and keep `main` stable, all changes follow a strict pull-request workflow:

```
           git checkout -b feature/xyz
(main) ──────────────────────────────────▶ (feature/xyz)
  │                                            │
  │                                            │ Make atomic commits
  │                                            ▼
  │                                      Push branch to GitHub
  │                                            │
  │◀───────────────────────────────────────────┘
               Open Pull Request & Merge
```

1. **Create Branch**: `git checkout -b feature/<name>`
2. **Commit Changes**: `git commit -m "feat: description"`
3. **Push Branch**: `git push origin feature/<name>`
4. **Open PR**: Create a Pull Request into `main` on GitHub and verify CI passes.
5. **Never commit directly to `main`**.

---

## Security Checklist

- [x] **No Secrets in Source**: `.env` is gitignored; `.env.example` provides templates.
- [x] **Row Level Security (RLS)**: Supabase tables enforce user-isolated data access.
- [x] **HTTPS Host Permissions**: Manifest V3 scopes permissions strictly to verified origins.
- [x] **CORS Whitelist**: Configured in `backend/config.py` and `vercel.json` for extension and production origins.

---

## License

Distributed under the [MIT License](LICENSE). Copyright (c) 2026 Longenus.
