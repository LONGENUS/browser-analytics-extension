# Browser Analytics Extension

[![CI](https://github.com/LONGENUS/browser-analytics-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/LONGENUS/browser-analytics-extension/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

An AI-powered web intelligence and extraction Chrome Extension paired with an asynchronous FastAPI crawler backend. Extract structured product data, calculate real-time analytics, inspect SEO metadata, and export reports in CSV, Excel, or JSON formats in a single click.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Local Development](#local-development)
- [Build & Run Instructions](#build--run-instructions)
- [API Reference](#api-reference)
- [Git Workflow](#git-workflow)
- [License](#license)

---

## Project Overview

**Browser Analytics Extension** bridges the gap between client-side browser context and server-side automated intelligence. When activated on any webpage (such as Amazon, Flipkart, or any generic e-commerce/content site), the extension interacts with a robust Python backend to extract, aggregate, and analyze page content without locking up browser resources.

---

## Key Features

- **One-Click Page Intelligence**: Instantly identify product listings, pricing distributions, unique ASINs, brands, and ratings.
- **Deep DOM Crawling (Crawl4AI & Playwright)**: Employs headless browser automation tailored to handle JavaScript-heavy platforms like Amazon and Flipkart.
- **SEO & Structure Inspection**: Extracts meta descriptions, headings (H1–H6), canonical URLs, and structured schema tags.
- **Dynamic Summarization**: Automatically produces structured bulleted summaries (or optional GPT-powered contextual overviews).
- **Multi-Format Export**: One-click download of collected data to `.csv`, `.xlsx` (Excel), or `.json`.
- **Historical Runs**: Search and retrieve past analysis sessions stored persistently in SQLite or PostgreSQL.

---

## Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Extension Core** | Chrome Manifest V3 | Modern service worker & isolated content scripts |
| **Extension UI** | HTML5, Vanilla CSS3, JavaScript | Lightweight, zero-dependency responsive popup |
| **Backend API** | FastAPI (Python 3.11+) | Asynchronous REST endpoints |
| **Crawler Engine** | Crawl4AI + Playwright | Anti-detection, headless DOM parsing |
| **Database** | SQLite (`aiosqlite`) / PostgreSQL | Asynchronous ORM via SQLAlchemy |
| **Export Formats** | Pandas, OpenPyXL, CSV | Structured tabular exports |
| **CI/CD** | GitHub Actions | Automated manifest and backend validation |

---

## Folder Structure

```
browser-analytics-extension/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow
├── backend/                     # FastAPI Backend & Crawler Service
│   ├── app.py                   # Application entry point
│   ├── config.py                # Environment configuration
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile               # Container definition
│   ├── models/                  # SQLAlchemy database models
│   ├── routes/                  # API routes (analyze, export, history)
│   ├── schemas/                 # Extraction CSS selectors & schemas
│   └── services/                # Crawler, analytics, and exporter services
├── extension/                   # Chrome Extension (Manifest V3)
│   ├── manifest.json            # Extension manifest configuration
│   ├── popup/                   # Extension popup interface & logic
│   ├── content/                 # Content script for live DOM interaction
│   ├── background/              # Background service worker & API broker
│   ├── utils/                   # Client-side API and export helpers
│   └── assets/                  # Icons and static resources
├── docs/                        # Project documentation
│   ├── ARCHITECTURE.md          # Detailed architectural breakdown
│   └── API.md                   # REST API specification
├── shared/                      # Shared types & JSON schemas
│   ├── README.md
│   └── schemas.json
├── docker-compose.yml           # Multi-container orchestration
├── .gitignore                   # Version control ignore rules
├── LICENSE                      # MIT License
└── README.md                    # Project documentation
```

---

## Installation

### Prerequisites
- **Git**
- **Python 3.11+**
- **Google Chrome** (or Chromium-based browser like Brave/Edge)

### 1. Clone Repository
```bash
git clone https://github.com/LONGENUS/browser-analytics-extension.git
cd browser-analytics-extension
```

### 2. Set Up the Python Backend
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

### 3. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the `extension/` directory from this repository.
5. Pin the **Browser Analytics Extension** to your toolbar.

---

## Local Development

### Running the Backend Locally
Ensure your virtual environment is active in the `backend/` directory:
```bash
python app.py
```
The backend starts at `http://localhost:8000`. You can test endpoints via Swagger UI at `http://localhost:8000/docs`.

### Running with Docker Compose
If you prefer running a full stack with PostgreSQL and Redis:
```bash
docker compose up --build
```

---

## Build & Run Instructions

1. **Verify Extension**:
   - Reload the extension from `chrome://extensions` whenever you modify files in `extension/`.
2. **Backend Syntax Check**:
   ```bash
   python -m compileall backend/
   ```
3. **Database Migrations**:
   The backend automatically initializes tables in `backend/webintel.db` on launch.

---

## Git Workflow

To maintain code quality and keep `main` stable, all developers must adhere to the following workflow:

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

### Step-by-Step Workflow Rules

1. **Pull Latest Main**:
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/<feature-name>
   # or bugfix/<issue-name>
   ```
3. **Implement Feature & Validate**:
   - Make atomic, focused changes.
   - Test locally with extension and backend.
4. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: descriptive summary of change"
   ```
5. **Push Feature Branch**:
   ```bash
   git push origin feature/<feature-name>
   ```
6. **Open a Pull Request**:
   - Open a PR from `feature/<feature-name>` into `main` on GitHub.
   - Review CI checks and merge.
   - **Never commit directly to `main`** unless explicitly instructed (`"push directly to main"`).

---

## License

Distributed under the [MIT License](LICENSE). Copyright (c) 2026 Longenus.
