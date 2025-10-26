# 🧮 Metrics Engine - Economic Metrics Computation Service

> **Standalone service** that computes and persists derived economic metrics using Argentina's time-series data from the ingestor service.

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Development](#development)
- [Deployment](#deployment)

## 🎯 Overview

The **Metrics Engine** is a specialized service that calculates derived economic metrics using data from the existing `series` and `series_points` tables. It does **NOT** ingest external APIs - it only reads from existing data and writes computed metrics to `metrics_points`.

### Key Features

- ✅ **245+ Economic Metrics** computed from time-series data
- ✅ **Monetary Deltas** (base & reserves: 7d, 30d, 90d)
- ✅ **Monetary Aggregates** (base ampliada, liquidity ratios)
- ✅ **Peso Backing** (reserves vs base, passives vs reserves)
- ✅ **FX Volatility & Trends** (USD volatility, moving averages)
- ✅ **Data Quality Metrics** (freshness, coverage, gaps)
- ✅ **Modular Use Cases** with descriptive methods
- ✅ **AWS Aurora RDS** optimized connections
- ✅ **CLI tools** for computation and monitoring
- ✅ **Clean Architecture** with separation of concerns

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- AWS Aurora RDS access
- Access to `ingestordb` (series & series_points tables)
- Access to `metricsdb` (metrics_points table)

### Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd metrics-engine

# Install dependencies
npm install

# Set environment variables
export NODE_ENV=production
export SOURCE_DB_URL="postgres://user:pass@hostname:5432/ingestordb"
export TARGET_DB_URL="postgres://user:pass@hostname:5432/metricsdb"
# Build and run
npm run build
npm start

# Check service health
curl http://localhost:3000/api/health
```

### Local Development Setup

```bash
# Install dependencies
pnpm install

# Copy environment configuration
cp docker.env.example .env

# Edit .env with your database URLs
# SOURCE_DB_URL=postgres://username:password@hostname:5432/ingestordb
# TARGET_DB_URL=postgres://username:password@hostname:5432/metricsdb

# Run database migrations
pnpm migrate

# Start development server
pnpm dev
```

### Environment Configuration

The service requires two database connections:

- **SOURCE_DB_URL**: Read-only connection to INGESTOR database (contains `series` and `series_points`)
- **TARGET_DB_URL**: Read-write connection to METRICS database (contains `metrics_points`)

Copy `docker.env.example` to `docker.env` (for Docker) or `.env` (for local development) and configure:

```bash
# Required variables
NODE_ENV=production
SOURCE_DB_URL=postgres://username:password@hostname:5432/ingestordb
TARGET_DB_URL=postgres://username:password@hostname:5432/metricsdb

# Optional variables
APP_TIMEZONE=America/Argentina/Buenos_Aires
LOG_LEVEL=info
HTTP_PORT=3000
ENABLE_SCHEDULER=false
```

### Available Scripts

```bash
pnpm dev                    # Start development server
pnpm build                 # Build for production
pnpm start                 # Start production server
pnpm migrate               # Run database migrations
pnpm metrics:recompute    # Recompute metrics for date range
pnpm metrics:today         # Compute metrics for today
pnpm lint                  # Run ESLint
pnpm format                # Format code with Prettier
pnpm typecheck             # Run TypeScript type checking
```

## 📚 Documentation

## HTTP API

### API Documentation
Interactive API documentation is available at:
- **Swagger UI**: http://localhost:3000/api/docs

### Health Check
```bash
GET /api/health
```

### Get Historical Metric Values
```bash
GET /api/v1/metrics/{metricId}?from=2025-01-01&to=2025-01-31&limit=100
```

**Example:**
```bash
curl "http://localhost:3000/api/v1/metrics/ratio.reserves_to_base?from=2025-01-01&to=2025-01-31&limit=50"
```

**Response:**
```json
{
  "metric_id": "ratio.reserves_to_base",
  "points": [
    { "ts": "2025-01-31", "value": 0.0012 },
    { "ts": "2025-01-30", "value": 0.0011 }
  ],
  "count": 2
}
```

### Get Latest Values for Multiple Metrics
```bash
GET /api/v1/metrics/summary?ids=ratio.reserves_to_base,delta.reserves_7d,delta.base_30d
```

**Example:**
```bash
curl "http://localhost:3000/api/v1/metrics/summary?ids=ratio.reserves_to_base,delta.reserves_7d"
```

**Response:**
```json
{
  "items": [
    { "metric_id": "ratio.reserves_to_base", "ts": "2025-01-31", "value": 0.0012 },
    { "metric_id": "delta.reserves_7d", "ts": "2025-01-31", "value": 0.05 }
  ],
  "missing": []
}
```

### Input Validation
All API endpoints include comprehensive input validation using Zod:
- **Date format**: YYYY-MM-DD for `from` and `to` parameters
- **Limit range**: 1-5000 for `limit` parameter
- **Required fields**: `metricId` and `ids` parameters are required
- **Error responses**: Detailed validation error messages with field-specific details

### Core Documentation

- **[Metrics Catalog v2.0](docs/metrics-catalog-v2.md)** - Complete metrics documentation with formulas
- **[Metrics Summary](docs/metrics-summary.md)** - Quick reference of implemented metrics
- **[Overview](docs/overview.md)** - Platform overview, data flow, and architecture
- **[Data Model](docs/data-model.md)** - Complete database schema documentation
- **[Glossary](docs/glossary.md)** - Domain terminology and business definitions
- **[Methodology](docs/methodology.md)** - Data processing methodology and quality standards
- **[SQL Cookbook](docs/sql-cookbook.md)** - Ready-to-run SQL queries for data analysis
- **[Code Guidelines](CODE_GUIDELINES.md)** - Development standards and architectural patterns

### Business Context

The documentation is designed for:
- **Data Scientists** - Understanding computed metrics and their interpretation
- **Developers** - Following code guidelines and architectural patterns
- **Business Users** - Understanding economic indicators and their significance
- **DevOps** - Deployment and monitoring considerations

## 🛠️ Development

### Prerequisites

- Node.js 20+
- PostgreSQL with existing ingestor data
- Access to `series` and `series_points` tables

### Setup

```bash
# Clone repository
git clone <repository-url>
cd metrics-engine

# Install dependencies
pnpm install

# Run database migrations
pnpm migrate

# Backfill historical metrics
pnpm metrics:backfill -- --from=2024-01-01 --to=2024-12-31

# Update recent metrics
pnpm metrics:update
```

## 🚢 Deployment

### Docker Deployment (Recommended)

```bash
# Start all services with Docker Compose
docker-compose up -d

# Check service health
curl http://localhost:3000/api/health

# View logs
docker-compose logs -f metrics-engine-app

# Stop services
docker-compose down
```

### Production Deployment

```bash
# Build the application
pnpm build

# Start the service
pnpm start
```

### Health Monitoring

```bash
# Check service health
curl http://localhost:3000/api/health

# Check API documentation
open http://localhost:3000/api/docs
```

### Daily Automation

```bash
# Add to crontab for daily updates at 08:20 ART
20 8 * * * cd /path/to/metrics-engine && pnpm metrics:recompute -- --days 30
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following CODE_GUIDELINES.md
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for Argentina's economic data community**