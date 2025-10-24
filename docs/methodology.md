# Data Methodology and Processing

## Data Provenance

### Primary Sources

#### BCRA (Banco Central de la República Argentina)
- **API Endpoint**: BCRA Monetarias and Cambiarias APIs
- **Data Types**: Reserves, monetary base, exchange rates
- **Update Schedule**: Daily at ~08:00 ART
- **Authentication**: API key required
- **Rate Limits**: 100 requests/hour
- **Known Issues**: 
  - SSL certificate chain issues (520 gateway errors)
  - Occasional 30-minute delays in data publication
  - Weekend data may be delayed until Monday

#### DolarAPI
- **API Endpoint**: Real-time exchange rate API
- **Data Types**: MEP, CCL, and other parallel market rates
- **Update Schedule**: Real-time during market hours
- **Authentication**: API key required
- **Rate Limits**: 1000 requests/day
- **Known Issues**:
  - Market hours only (no weekend data)
  - Occasional API timeouts during high volatility

#### Datos Argentina (Fallback)
- **API Endpoint**: Government data portal
- **Data Types**: Official statistics and economic indicators
- **Update Schedule**: Variable (monthly/quarterly)
- **Authentication**: Public API
- **Rate Limits**: 100 requests/hour
- **Known Issues**:
  - Less frequent updates
  - Data may be published with delays

### Data Quality Assurance

#### Source Validation
- **API Health Checks**: Daily monitoring of all endpoints
- **Data Freshness**: Alert if data is > 2 hours stale
- **Format Validation**: JSON schema validation for all responses
- **Range Checks**: Values within expected business ranges

#### Fallback Strategy
1. **Primary**: BCRA APIs (preferred)
2. **Secondary**: DolarAPI for exchange rates
3. **Tertiary**: Datos Argentina for official statistics
4. **Manual**: CSV upload for critical data gaps

## Data Normalization

### Date Handling
- **Storage Format**: ISO 8601 (YYYY-MM-DD)
- **Timezone**: All dates stored in UTC
- **Business Days**: Only weekdays included (no weekend padding)
- **Holidays**: Argentina national holidays excluded from daily series

### Numeric Precision
- **Storage**: NUMERIC(20,6) for high precision
- **Display**: 2 decimal places for currency, 4 for ratios
- **Rounding**: Banker's rounding (round half to even)
- **Scientific Notation**: Avoided in favor of decimal notation

### Unit Standardization
- **Currency**: USD for reserves, ARS for monetary base
- **Exchange Rates**: ARS/USD (pesos per dollar)
- **Ratios**: Dimensionless (no units)
- **Percentages**: Stored as decimals (0.05 = 5%)

### Missing Value Policy
- **No Interpolation**: Missing values remain missing
- **No Padding**: Weekends and holidays not filled
- **No Extrapolation**: Future values not estimated
- **Explicit Nulls**: Use NULL for truly missing data

## Idempotency Strategy

### Database Design
- **Primary Keys**: Composite keys prevent duplicates
- **Upsert Operations**: `ON CONFLICT DO UPDATE` for safe re-runs
- **Timestamp Tracking**: `created_at` and `updated_at` for audit
- **Version Control**: Metric formula versioning

### Computation Idempotency
```sql
-- Safe upsert pattern
INSERT INTO metrics.metrics_points (metric_id, ts, value, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, NOW(), NOW())
ON CONFLICT (metric_id, ts) 
DO UPDATE SET 
  value = EXCLUDED.value,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
```

### Recompute Policy
- **Recent Window**: Last 30 days recomputed daily
- **Historical**: Manual backfill available
- **Corrections**: Source data changes trigger recomputation
- **Version Updates**: New formula versions require full recomputation

## Data Processing Pipeline

### Ingestion Flow
1. **Source APIs**: Fetch raw data from providers
2. **Validation**: Check data quality and format
3. **Normalization**: Standardize dates, units, precision
4. **Storage**: Insert into `series.series_points`
5. **Catalog Update**: Update `series.series` metadata

### Computation Flow
1. **Dependency Check**: Verify all required series available
2. **Data Alignment**: Match dates across input series
3. **Formula Application**: Apply mathematical formulas
4. **Validation**: Check computed values within expected ranges
5. **Storage**: Upsert into `metrics.metrics_points`

### Error Handling
- **Retry Logic**: 3 attempts with exponential backoff
- **Circuit Breaker**: Stop processing if > 50% failures
- **Dead Letter Queue**: Failed computations logged for manual review
- **Graceful Degradation**: Partial results if some dependencies missing

## Recompute Policy

### Automatic Recompute
- **Daily Schedule**: 08:15 ART (after data ingestion)
- **Window Size**: 30 days (configurable)
- **Overlap**: 1.5x window size to handle data corrections
- **Frequency**: Once per day maximum

### Manual Recompute
- **CLI Commands**: Available for operations team
- **Date Ranges**: Custom start/end dates
- **Single Metrics**: Compute specific metrics only
- **Full Backfill**: Historical recomputation

### Trigger Conditions
- **Data Corrections**: Source data revisions
- **Formula Updates**: New metric versions
- **System Recovery**: After outages or errors
- **Quality Issues**: Data validation failures

## Thresholds and Interpretation

### Reserves-to-Base Ratio
- **Green Zone**: > 1.0 (strong backing)
- **Yellow Zone**: 0.5-1.0 (adequate backing)
- **Red Zone**: < 0.5 (insufficient backing)
- **Critical**: < 0.3 (emergency levels)

### Delta Metrics
- **Reserves 7d**: 
  - Growth: > 0.05 (5% weekly increase)
  - Stable: -0.05 to 0.05
  - Decline: < -0.05 (5% weekly decrease)
- **Base 30d**:
  - Controlled: < 0.05 (5% monthly growth)
  - Moderate: 0.05-0.10 (5-10% monthly growth)
  - High Risk: > 0.10 (10% monthly growth)

### Exchange Rate Gap
- **Normal**: < 0.10 (10% premium)
- **Elevated**: 0.10-0.20 (10-20% premium)
- **High**: > 0.20 (20% premium)

## Data Lineage and Audit

### Provenance Tracking
- **Source URLs**: Stored in series metadata
- **API References**: Request/response IDs logged
- **Computation Context**: Input values stored in metric metadata
- **Version History**: Formula changes tracked

### Audit Trail
- **Creation Timestamps**: When data first ingested
- **Update Timestamps**: When data last modified
- **User Actions**: CLI commands and manual operations
- **System Events**: Errors, warnings, and status changes

### Compliance
- **Data Retention**: 7 years for financial data
- **Privacy**: No personal information collected
- **Security**: Encrypted connections, API key rotation
- **Backup**: Daily automated backups

## Performance Optimization

### Database Tuning
- **Indexes**: Optimized for time-series queries
- **Partitioning**: Time-based partitioning for large tables
- **Compression**: TimescaleDB compression for historical data
- **Connection Pooling**: Separate pools for source/target databases

### Computation Optimization
- **Parallel Processing**: Multiple metrics computed simultaneously
- **Caching**: Frequently accessed data cached in memory
- **Batch Operations**: Bulk inserts/updates for efficiency
- **Resource Limits**: CPU and memory constraints

### Monitoring
- **Query Performance**: Slow query detection and optimization
- **Resource Usage**: CPU, memory, and disk utilization
- **Error Rates**: Success/failure ratios
- **Data Freshness**: Time since last successful update
