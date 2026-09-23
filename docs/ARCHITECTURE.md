# System Architecture

## Overview
Browser Analytics Extension (WebIntel) is an end-to-end web intelligence and scraping platform composed of two primary layers:
1. **Chrome Extension (Manifest V3)**: Provides in-browser interaction, page contextual DOM extraction, background messaging, and interactive analytics reporting.
2. **FastAPI Backend (Crawl4AI + SQLite/PostgreSQL + Redis)**: High-performance asynchronous crawler engine powered by Playwright and Crawl4AI, providing deep DOM parsing, automated metrics computation, dynamic summaries, and exports.

## High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                   Chrome Browser                       │
│                                                        │
│  ┌──────────────┐    chrome.runtime   ┌─────────────┐  │
│  │  Content     │ ──────────────────▶ │ Background  │  │
│  │  Script      │                     │ Service     │  │
│  │  (DOM Probe) │ ◀────────────────── │ Worker      │  │
│  └──────────────┘                     └──────┬──────┘  │
│         ▲                                    │         │
│         │ user click                         │ HTTP    │
│  ┌──────┴───────┐                            │ JSON    │
│  │ Popup UI     │ ◀──────────────────────────┘         │
│  │ (Dashboard)  │                                      │
│  └──────────────┘                                      │
└───────────────────────────────────┬────────────────────┘
                                    │
                                    ▼ HTTP REST API
┌────────────────────────────────────────────────────────┐
│                FastAPI Backend (app.py)                │
│                                                        │
│  ┌──────────────┐   ┌───────────────┐  ┌─────────────┐ │
│  │ /analyze     │   │ /export/{fmt} │  │ /history    │ │
│  └──────┬───────┘   └───────┬───────┘  └──────┬──────┘ │
│         │                   │                 │        │
│  ┌──────▼───────────────────▼─────────────────▼──────┐ │
│  │                  Service Layer                    │ │
│  │  • crawler.py (Crawl4AI + Playwright headless)    │ │
│  │  • analytics.py (Pricing, ASINs, Brands metrics)  │ │
│  │  • summarizer.py (Template & LLM Summaries)       │ │
│  │  • exporter.py (CSV, Excel XLSX, JSON)            │ │
│  └──────────────────────────┬────────────────────────┘ │
│                             │                          │
│  ┌──────────────────────────▼────────────────────────┐ │
│  │              Storage / Persistence                │ │
│  │  • SQLite (default: webintel.db via aiosqlite)    │ │
│  │  • PostgreSQL + Redis (production Docker profile) │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

## Security & Privacy
- Analysis is explicitly user-triggered.
- Crawler execution runs headless asynchronously with custom headers and selectors.
- No personal user credentials or private browsing sessions are harvested.
