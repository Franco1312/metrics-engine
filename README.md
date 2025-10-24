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

- ✅ **Derived metrics computation** from existing time-series data
- ✅ **FX gap analysis** (MEP, CCL vs Official)
- ✅ **Monetary metrics** (base, reserves, coverage ratios)
- ✅ **Flow metrics** (daily changes, trends)
- ✅ **Risk metrics** (volatility, stability indicators)
- ✅ **CLI tools** for backfill and daily updates
- ✅ **Health monitoring** with database connectivity checks
- ✅ **Clean Architecture** following ingestor patterns

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL with existing `series` and `series_points` tables
- Access to the same database as the ingestor service

### Setup

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm migrate

# Backfill historical metrics (last 180 days)
pnpm metrics:backfill

# Update recent metrics (last 30 days)
pnpm metrics:update

# Start the service
pnpm start
```

### Available Scripts

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm migrate          # Run database migrations
pnpm metrics:backfill # Backfill historical metrics
pnpm metrics:update   # Update recent metrics
pnpm test             # Run tests
pnpm lint             # Run ESLint
pnpm format           # Format code with Prettier
```

## 📚 Documentation

### Core Documentation

- **[Overview](docs/overview.md)** - Platform overview, data flow, and architecture
- **[Data Model](docs/data-model.md)** - Complete database schema documentation
- **[Metrics Catalog](docs/metrics-catalog.md)** - All computed metrics with formulas and interpretation
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
curl http://localhost:3000/health
```

### Daily Automation

```bash
# Add to crontab for daily updates at 08:20 ART
20 8 * * * cd /path/to/metrics-engine && pnpm metrics:update
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