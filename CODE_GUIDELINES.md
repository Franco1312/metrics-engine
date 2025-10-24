# Code Guidelines - Ingestor Project

## Overview
This document defines the coding standards, patterns, and architectural guidelines for the Ingestor project. These guidelines ensure consistency, maintainability, and readability across the codebase.

## Core Principles

### 1. **Simplicity Over Complexity**
- Avoid over-engineering
- Prefer direct functions over classes when possible
- Eliminate unnecessary abstractions
- Keep methods focused and single-purpose

### 2. **Consistent Logging**
- Use only essential logs: `INIT`, `FINISHED`, `ERROR`
- Avoid verbose logging and intermediate steps
- Include minimal but relevant data in logs
- Use structured logging with `event`, `msg`, `data`, `err` fields

### 3. **Date Handling**
- Always use `DateService` for date operations
- Never implement custom date parsing
- Centralize date validation and formatting
- Use `DateService.formatDate()`, `DateService.validateDateRange()`, etc.

### 4. **Error Handling**
- Never instantiate `Error` objects solely for logging
- Pass strings directly to logger when possible
- Use early returns to reduce nesting
- Handle errors at the appropriate level

## Architecture Patterns

### **Provider Pattern**
All data providers must implement the `SeriesProvider` interface:

```typescript
export interface SeriesProvider {
  readonly name: string;
  health(): Promise<ProviderHealth>;
  fetchRange(params: FetchRangeParams): Promise<FetchRangeResult>;
  getAvailableSeries?(): Promise<Array<{...}>>;
}
```

### **HTTP Client Pattern**
- Extend `BaseHttpClient` for all external API clients
- Use configuration from `config.externalServices`
- Implement health checks and proper error handling
- Follow the pattern: `BcraClient`, `DolarApiClient`, etc.

### **Repository Pattern**
- Domain services MUST access data through repository interfaces
- NEVER access database clients directly from domain services
- Repository interfaces belong in `domain/ports/`
- Repository implementations belong in `infrastructure/db/`
- Domain services receive repository instances via dependency injection
- Use singleton pattern for repository instances to reuse database connections
- Repository singletons should be exported from `infrastructure/db/` modules

### **Import Management**
- ALWAYS use absolute imports, never relative imports
- Use `@/` prefix for all imports from the `src/` directory
- Examples: `import { DateService } from '@/domain/utils/dateService.js'`
- This ensures consistency and makes refactoring easier

### **Configuration Management**
- All external service URLs and timeouts go in config files
- Use environment-specific configurations
- Never hardcode URLs or timeouts in providers/clients
- Follow the pattern: `config.externalServices.{serviceName}`

## Code Structure

### **File Organization**
```
src/
├── domain/           # Business logic and entities
├── application/      # Use cases
├── infrastructure/   # External concerns
│   ├── config/       # Configuration
│   ├── http/         # HTTP clients
│   ├── providers/    # Data providers
│   └── db/          # Database
└── interfaces/       # Entry points (CLI, REST)
```

### **Provider Implementation**
```typescript
export class ExampleProvider implements SeriesProvider {
  readonly name = 'EXAMPLE_PROVIDER';
  private readonly httpClient: ExampleClient;

  constructor() {
    this.httpClient = new ExampleClient();
  }

  async health(): Promise<ProviderHealth> {
    // Health check implementation
  }

  async fetchRange(params: FetchRangeParams): Promise<FetchRangeResult> {
    // Fetch implementation with minimal logging
  }

  private normalizeResponse(response: unknown, seriesId: string): SeriesPoint[] {
    // Normalization using DateService
  }
}
```

### **HTTP Client Implementation**
```typescript
export class ExampleClient extends BaseHttpClient {
  constructor() {
    super(config.externalServices.example.baseUrl, config.externalServices.example.timeout);
  }

  async getData(): Promise<unknown> {
    // Implementation using this.axiosInstance
  }
}
```

## Logging Standards

### **Essential Logs Only**
```typescript
// ✅ Good - Essential logs
logger.info({
  event: events.FETCH_RANGE,
  msg: 'Starting data fetch',
  data: { externalId, from, to },
});

logger.info({
  event: events.FETCH_RANGE,
  msg: 'Data fetch completed',
  data: { externalId, totalPointsFetched: points.length },
});

// ❌ Bad - Verbose logging
logger.info({
  event: events.FETCH_RANGE,
  msg: 'Fetched page',
  data: {
    externalId,
    pageOffset: currentOffset - limit,
    pagePointsCount: pagePoints.length,
    totalPointsSoFar: allPoints.length,
    hasMore,
  },
});
```

### **Error Logging**
```typescript
// ✅ Good - Direct string logging
logger.error({
  event: events.FETCH_RANGE,
  msg: 'Data fetch failed',
  err: error instanceof Error ? error.message : String(error),
  data: { externalId },
});

// ❌ Bad - Unnecessary Error instantiation
logger.error({
  event: events.FETCH_RANGE,
  msg: 'Data fetch failed',
  err: new Error('Custom error message'),
});
```

## Date Handling

### **Always Use DateService**
```typescript
// ✅ Good
const date = DateService.formatDate(new Date(dateString));
const isValid = DateService.validateDateRange(from, to);

// ❌ Bad
const date = new Date(dateString).toISOString().split('T')[0];
```

### **Centralized Date Operations**
- Use `DateService.formatDate()` for date formatting
- Use `DateService.validateDateRange()` for validation
- Use `DateService.getYesterday()` instead of custom implementations
- Never implement custom date parsing logic

## Configuration Standards

### **External Services**
```typescript
// types.ts
export interface ExternalServicesConfig {
  bcra: ExternalServiceConfig;
  bcraCambiarias: ExternalServiceConfig;
  datosArgentina: ExternalServiceConfig;
  dolarApi: ExternalServiceConfig;
}

// environments/local.ts
export const localConfig: EnvironmentConfig = {
  externalServices: {
    bcra: {
      baseUrl: 'https://api.bcra.gob.ar',
      timeout: 30000,
      retries: 3,
      caBundlePath: process.env.BCRA_CA_BUNDLE_PATH,
    },
    dolarApi: {
      baseUrl: 'https://dolarapi.com/v1',
      timeout: 15000,
      retries: 3,
    },
  },
};
```

### **HTTP Client Configuration**
```typescript
export class ExampleClient extends BaseHttpClient {
  constructor() {
    super(config.externalServices.example.baseUrl, config.externalServices.example.timeout);
    
    if (config.externalServices.example.caBundlePath) {
      this.axiosInstance.defaults.httpsAgent = this.createHttpsAgent(
        config.externalServices.example.caBundlePath
      );
    }
  }
}
```

## Code Quality

### **Function Complexity**
- Keep functions under 20 lines when possible
- Use early returns to reduce nesting
- Extract complex logic into private methods
- Prefer functional programming patterns (`map`, `filter`, `some`, `find`)

### **Type Safety**
- Use proper TypeScript types
- Avoid `any` types
- Use type guards for runtime checks
- Leverage optional chaining (`?.`) for safe property access

### **Error Handling**
- Use try-catch blocks appropriately
- Don't catch errors just to re-throw them
- Provide meaningful error messages
- Handle errors at the right level of abstraction

## Testing Standards

### **Test Organization**
```
src/
├── {feature}/
│   └── tests/
│       ├── unit/
│       │   └── {name}.spec.ts
│       └── e2e/
│           └── {name}.e2e.spec.ts
```

### **Test Naming**
- Use `.spec.ts` extension
- Organize by feature and type (unit/e2e)
- Use descriptive test names

## Documentation

### **Code Documentation**
- No JSDoc comments (ultra-clean code)
- No single-line comments (`//`)
- Self-documenting code through clear naming
- Business documentation in separate `.md` files

### **Business Documentation**
- Create comprehensive docs for data models
- Include examples with real data
- Document data sources and caveats
- Use Spanish for business context, English for technical terms

## Migration and Database

### **Database Migrations**
- Use numbered migration files: `001_schema.sql`, `002_add_timestamps.sql`
- Include automatic timestamp columns (`created_at`, `updated_at`)
- Create triggers for automatic `updated_at` updates
- Document schema changes

### **Data Model Documentation**
- Document each table and column with business meaning
- Include real examples from the system
- Explain data sources and update frequencies
- Provide FAQ for common questions

## Environment Configuration

### **Environment Variables**
```bash
# HTTP Configuration
HTTP_TIMEOUT_MS=20000
HTTP_RETRIES=3
HTTP_BACKOFF_BASE_MS=250
HTTP_BACKOFF_FACTOR=2
HTTP_BACKOFF_MAX_MS=8000

# External Services
BCRA_CA_BUNDLE_PATH=/app/certs/bcra-chain.pem
DATABASE_URL=postgresql://user:pass@localhost:5433/ingestor

# Provider Configuration
PRIMARY_PROVIDER=BCRA_MONETARIAS
FALLBACK_PROVIDER=DATOS_SERIES
```

## Code Review Checklist

### **Before Committing**
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code follows provider pattern
- [ ] Uses `DateService` for date operations
- [ ] Minimal logging (INIT, FINISHED, ERROR only)
- [ ] Configuration externalized
- [ ] No unnecessary Error instantiation
- [ ] No JSDoc or single-line comments
- [ ] Self-documenting code

### **Provider Review**
- [ ] Implements `SeriesProvider` interface
- [ ] Uses HTTP client pattern
- [ ] Configuration from external services
- [ ] Health check implementation
- [ ] Proper error handling
- [ ] Uses `DateService` for date operations

### **HTTP Client Review**
- [ ] Extends `BaseHttpClient`
- [ ] Uses configuration from config files
- [ ] Implements health check
- [ ] Proper error handling and logging
- [ ] No hardcoded URLs or timeouts

## Examples

### **Good Provider Implementation**
```typescript
export class BcraCambiariasProvider implements SeriesProvider {
  readonly name = 'BCRA_CAMBIARIAS';
  private readonly bcraCambiariasClient: BcraCambiariasClient;

  constructor() {
    this.bcraCambiariasClient = new BcraCambiariasClient();
  }

  async health(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const healthResult = await this.bcraCambiariasClient.healthCheck();
      return {
        isHealthy: healthResult.isHealthy,
        responseTime: Date.now() - startTime,
        error: healthResult.error,
      };
    } catch (error) {
      return {
        isHealthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async fetchRange(params: FetchRangeParams): Promise<FetchRangeResult> {
    const { externalId, from, to, limit = 1000, offset = 0 } = params;

    logger.info({
      event: events.FETCH_RANGE,
      msg: 'Starting BCRA Cambiarias data fetch',
      data: { externalId, from, to },
    });

    try {
      const allPoints: SeriesPoint[] = [];
      let currentOffset = offset;
      let hasMore = true;

      while (hasMore) {
        const responseBody = await this.bcraCambiariasClient.getSeriesData({
          seriesId: externalId,
          from,
          to,
          limit,
          offset: currentOffset,
        });

        const pagePoints = this.normalizeResponse(responseBody, externalId);
        allPoints.push(...pagePoints);

        hasMore = pagePoints.length === limit;
        currentOffset += limit;
      }

      logger.info({
        event: events.FETCH_RANGE,
        msg: 'BCRA Cambiarias data fetch completed',
        data: { externalId, totalPointsFetched: allPoints.length },
      });

      return {
        points: allPoints,
        totalCount: allPoints.length,
        hasMore: false,
        provider: this.name,
      };
    } catch (error) {
      logger.error({
        event: events.FETCH_RANGE,
        msg: 'BCRA Cambiarias data fetch failed',
        err: error as Error,
        data: { externalId },
      });
      throw error;
    }
  }

  private normalizeResponse(response: unknown, seriesId: string): SeriesPoint[] {
    const points: SeriesPoint[] = [];
    const responseData = response as Record<string, unknown>;
    
    if (responseData?.results) {
      const results = responseData.results as unknown[];
      for (const item of results) {
        const itemData = item as Record<string, unknown>;
        const date = DateService.formatDate(new Date(itemData.fecha as string));
        const value = this.parseValue(itemData.valor);

        if (date && value !== null) {
          points.push({ seriesId, ts: date, value });
        }
      }
    }
    return points;
  }

  private parseValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsedValue = Number(value);
    return isNaN(parsedValue) ? null : parsedValue;
  }
}
```

### **Good HTTP Client Implementation**
```typescript
export class DolarApiClient extends BaseHttpClient {
  constructor() {
    super(config.externalServices.dolarApi.baseUrl, config.externalServices.dolarApi.timeout);
  }

  async getMEPData(): Promise<unknown> {
    logger.info({
      event: events.GET_SERIES_DATA,
      msg: 'Fetching MEP data from DolarApi',
    });

    try {
      const response = await this.axiosInstance.get('/dolares/bolsa');
      
      logger.info({
        event: events.GET_SERIES_DATA,
        msg: 'Successfully fetched MEP data from DolarApi',
      });

      return response.data;
    } catch (error) {
      logger.error({
        event: events.GET_SERIES_DATA,
        msg: 'Failed to fetch MEP data from DolarApi',
        err: error as Error,
      });
      throw new Error(
        `Failed to fetch MEP data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async healthCheck(): Promise<{ isHealthy: boolean; error?: string; responseTime?: number }> {
    const startTime = Date.now();

    logger.info({
      event: events.HEALTH_CHECK,
      msg: 'Checking DolarApi health',
    });

    try {
      await this.axiosInstance.get('/dolares/blue');
      const responseTime = Date.now() - startTime;

      logger.info({
        event: events.HEALTH_CHECK,
        msg: 'DolarApi health check successful',
        data: { responseTime },
      });

      return { isHealthy: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        event: events.HEALTH_CHECK,
        msg: 'DolarApi health check failed',
        err: error as Error,
        data: { responseTime },
      });

      return {
        isHealthy: false,
        error: errorMessage,
        responseTime,
      };
    }
  }
}
```

---

## Summary

These guidelines ensure:
- **Consistency** across all providers and HTTP clients
- **Maintainability** through clear patterns and standards
- **Readability** with minimal logging and self-documenting code
- **Reliability** through proper error handling and configuration management
- **Scalability** through standardized patterns for new providers

Follow these guidelines for all new code and refactor existing code to match these standards.
