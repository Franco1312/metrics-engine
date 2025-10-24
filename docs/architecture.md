# Architecture Guide

## System Architecture

The Ingestor service follows Clean Architecture principles with clear separation of concerns.

## Clean Architecture Implementation

```
src/
├── domain/           # Business logic and entities
│   ├── entities/     # Core business objects
│   ├── ports/        # Interface definitions
│   ├── services/     # Domain services
│   └── utils/        # Domain utilities
├── application/      # Use cases and business rules
│   └── usecases/     # Application logic
├── infrastructure/   # External concerns
│   ├── config/       # Configuration management
│   ├── db/          # Database layer
│   ├── http/        # HTTP clients
│   ├── providers/   # Provider implementations
│   └── sched/       # Scheduling
└── interfaces/      # External interfaces
    ├── cli/         # Command-line interfaces
    └── rest/        # REST API endpoints
```

## Key Components

### 1. Provider Chain
Orchestrates data fetching with automatic failover between multiple data sources.

### 2. Repository Pattern
Abstracts database operations with clear interfaces and implementations.

### 3. Use Cases
Encapsulates business logic and coordinates between domain and infrastructure layers.

### 4. HTTP Clients
Handle external API communication with retry logic and error handling.

### 5. Scheduler
Manages automated data updates with configurable cron jobs.

## Data Flow

### Daily Update Flow

1. **Scheduler triggers** at 08:05 AM Argentina time
2. **Check database connectivity**
3. **Initialize provider chain** (BCRA Monetarias primary)
4. **For each mapped series**:
   - Get last stored date
   - Fetch new data from BCRA API
   - Perform idempotent upserts
   - Log results
5. **Send summary** with statistics

### Backfill Flow

1. **CLI command** with date range parameters
2. **Validate parameters** and connectivity
3. **For specified series**:
   - Fetch historical data with pagination
   - Normalize data format
   - Store in database
   - Handle duplicates with upserts
4. **Return statistics** and completion status

## Design Patterns

### Repository Pattern
- **Interface**: `ISeriesRepository`, `ISeriesMappingRepository`
- **Implementation**: Database-specific implementations
- **Benefits**: Testability, flexibility, clean separation

### Provider Pattern
- **Interface**: `SeriesProvider`
- **Implementation**: BCRA, DolarApi, INDEC providers
- **Benefits**: Pluggable data sources, fallback support

### Use Case Pattern
- **Application Logic**: `FetchAndStoreSeriesUseCase`, `BackfillSeriesUseCase`
- **Coordination**: Between domain and infrastructure
- **Benefits**: Business logic encapsulation, testability

## Error Handling

- **Retry Logic**: Exponential backoff with jitter
- **Circuit Breaker**: Automatic failover on repeated failures
- **Graceful Degradation**: Continue processing other series on individual failures
- **Comprehensive Logging**: Structured logs for debugging and monitoring

## Monitoring & Observability

### Structured Logging
All operations are logged with structured JSON format for easy parsing and analysis.

### Key Metrics
- **Data Points Processed**: Total points fetched and stored
- **API Response Times**: Latency to external APIs
- **Error Rates**: Failed requests and retry attempts
- **Database Performance**: Query execution times
- **Provider Health**: Availability of external services
