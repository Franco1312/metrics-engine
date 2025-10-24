# SQL Cookbook - Ready-to-Run Queries

## Overview

This cookbook provides copy-paste-ready SQL queries for common data analysis tasks. All queries are tested and optimized for the metrics-engine database schema.

## Connection Information

### Source Database (Ingestor)
```bash
# Connection string
postgres://user:pass@localhost:5433/ingestor

# Direct connection
psql -h localhost -p 5433 -U user -d ingestor
```

### Target Database (Metrics Engine)
```bash
# Connection string
postgres://metrics_user:metrics_password@localhost:5434/metrics_engine

# Direct connection
psql -h localhost -p 5434 -U metrics_user -d metrics_engine
```

## Series Data Queries

### 1. Show Last 30 Days of a Series

```sql
-- Get reserves data for the last 30 days
SELECT 
    ts,
    value,
    created_at
FROM series.series_points 
WHERE series_id = '1'  -- Reserves series
    AND ts >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ts DESC;
```

**Expected Output:**
```
    ts     |  value   |        created_at
-----------+----------+------------------------
2024-01-15| 45000.50 | 2024-01-15 08:05:00+00
2024-01-14| 44800.25 | 2024-01-14 08:05:00+00
...
```

### 2. Check Data Gaps or Missing Days

```sql
-- Find gaps in reserves data (missing business days)
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE,
        '1 day'::interval
    )::date AS expected_date
),
actual_data AS (
    SELECT ts FROM series.series_points 
    WHERE series_id = '1' 
        AND ts >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT 
    expected_date,
    CASE WHEN actual_data.ts IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM date_series
LEFT JOIN actual_data ON date_series.expected_date = actual_data.ts
WHERE EXTRACT(DOW FROM expected_date) BETWEEN 1 AND 5  -- Business days only
ORDER BY expected_date;
```

### 3. Get Series Metadata and Statistics

```sql
-- Series information with basic statistics
SELECT 
    s.id,
    s.source,
    s.frequency,
    s.unit,
    s.metadata,
    COUNT(sp.ts) AS point_count,
    MIN(sp.ts) AS first_date,
    MAX(sp.ts) AS last_date,
    AVG(sp.value) AS avg_value,
    MIN(sp.value) AS min_value,
    MAX(sp.value) AS max_value
FROM series.series s
LEFT JOIN series.series_points sp ON s.id = sp.series_id
WHERE s.id = '1'  -- Reserves series
GROUP BY s.id, s.source, s.frequency, s.unit, s.metadata;
```

## Metrics Data Queries

### 4. Read Last Computed Metrics

```sql
-- Get latest computed metrics for all metric types
SELECT 
    mp.metric_id,
    mp.ts,
    mp.value,
    mp.metadata,
    m.description,
    m.unit
FROM metrics.metrics_points mp
JOIN metrics.metrics m ON mp.metric_id = m.id
WHERE mp.ts = (
    SELECT MAX(ts) FROM metrics.metrics_points 
    WHERE metric_id = mp.metric_id
)
ORDER BY mp.metric_id, mp.ts DESC;
```

### 5. Compute Reserves-to-Base Ratio On-the-Fly

```sql
-- Calculate reserves-to-base ratio manually
WITH reserves_data AS (
    SELECT ts, value AS reserves_usd
    FROM series.series_points 
    WHERE series_id = '1'  -- Reserves
        AND ts >= CURRENT_DATE - INTERVAL '7 days'
),
base_data AS (
    SELECT ts, value AS base_ars
    FROM series.series_points 
    WHERE series_id = '15'  -- Monetary base
        AND ts >= CURRENT_DATE - INTERVAL '7 days'
),
official_rate AS (
    SELECT ts, value AS rate_ars_usd
    FROM series.series_points 
    WHERE series_id = 'bcra.usd_official_ars'  -- Official rate
        AND ts >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
    r.ts,
    r.reserves_usd,
    b.base_ars,
    o.rate_ars_usd,
    b.base_ars / o.rate_ars_usd AS base_usd,
    r.reserves_usd / (b.base_ars / o.rate_ars_usd) AS ratio
FROM reserves_data r
JOIN base_data b ON r.ts = b.ts
JOIN official_rate o ON r.ts = o.ts
ORDER BY r.ts DESC;
```

### 6. Verify Idempotency (Check for Duplicates)

```sql
-- Check for duplicate metric points (should return empty)
SELECT 
    metric_id,
    ts,
    COUNT(*) AS duplicate_count
FROM metrics.metrics_points
GROUP BY metric_id, ts
HAVING COUNT(*) > 1;
```

### 7. Compare Computed vs Manual Calculations

```sql
-- Compare stored metrics with manual calculations
WITH manual_calc AS (
    SELECT 
        r.ts,
        r.value AS reserves,
        b.value AS base,
        o.value AS official_rate,
        r.value / (b.value / o.value) AS manual_ratio
    FROM series.series_points r
    JOIN series.series_points b ON r.ts = b.ts
    JOIN series.series_points o ON r.ts = o.ts
    WHERE r.series_id = '1'
        AND b.series_id = '15'
        AND o.series_id = 'bcra.usd_official_ars'
        AND r.ts >= CURRENT_DATE - INTERVAL '7 days'
),
stored_metrics AS (
    SELECT ts, value AS stored_ratio
    FROM metrics.metrics_points
    WHERE metric_id = 'ratio.reserves_to_base'
        AND ts >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
    m.ts,
    m.manual_ratio,
    s.stored_ratio,
    ABS(m.manual_ratio - s.stored_ratio) AS difference,
    CASE 
        WHEN ABS(m.manual_ratio - s.stored_ratio) < 0.001 THEN 'MATCH'
        ELSE 'DIFFERENCE'
    END AS status
FROM manual_calc m
JOIN stored_metrics s ON m.ts = s.ts
ORDER BY m.ts DESC;
```

## Data Quality Queries

### 8. Check Data Freshness

```sql
-- Check when data was last updated
SELECT 
    'series_points' AS table_name,
    MAX(updated_at) AS last_update,
    NOW() - MAX(updated_at) AS age
FROM series.series_points
UNION ALL
SELECT 
    'metrics_points' AS table_name,
    MAX(updated_at) AS last_update,
    NOW() - MAX(updated_at) AS age
FROM metrics.metrics_points;
```

### 9. Find Outliers in Metrics

```sql
-- Detect unusual values in reserves-to-base ratio
WITH ratio_stats AS (
    SELECT 
        AVG(value) AS mean_ratio,
        STDDEV(value) AS std_ratio
    FROM metrics.metrics_points
    WHERE metric_id = 'ratio.reserves_to_base'
        AND ts >= CURRENT_DATE - INTERVAL '90 days'
)
SELECT 
    mp.ts,
    mp.value,
    ABS(mp.value - rs.mean_ratio) / rs.std_ratio AS z_score,
    CASE 
        WHEN ABS(mp.value - rs.mean_ratio) / rs.std_ratio > 2 THEN 'OUTLIER'
        ELSE 'NORMAL'
    END AS status
FROM metrics.metrics_points mp
CROSS JOIN ratio_stats rs
WHERE mp.metric_id = 'ratio.reserves_to_base'
    AND mp.ts >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY z_score DESC;
```

### 10. Data Completeness Report

```sql
-- Check data completeness for all series
SELECT 
    s.id,
    s.source,
    s.frequency,
    COUNT(sp.ts) AS total_points,
    MIN(sp.ts) AS first_date,
    MAX(sp.ts) AS last_date,
    COUNT(sp.ts) FILTER (WHERE sp.ts >= CURRENT_DATE - INTERVAL '30 days') AS recent_points,
    ROUND(
        COUNT(sp.ts) FILTER (WHERE sp.ts >= CURRENT_DATE - INTERVAL '30 days')::numeric / 
        NULLIF(COUNT(sp.ts), 0) * 100, 
        2
    ) AS completeness_pct
FROM series.series s
LEFT JOIN series.series_points sp ON s.id = sp.series_id
GROUP BY s.id, s.source, s.frequency
ORDER BY completeness_pct DESC;
```

## Performance Queries

### 11. Index Usage Analysis

```sql
-- Check index usage for time-series queries
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname IN ('series', 'metrics')
ORDER BY idx_scan DESC;
```

### 12. Table Sizes and Growth

```sql
-- Check table sizes and row counts
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes
FROM pg_stat_user_tables
WHERE schemaname IN ('series', 'metrics')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Troubleshooting Queries

### 13. Find Failed Computations

```sql
-- Find dates where metrics computation may have failed
SELECT 
    expected_dates.ts,
    CASE 
        WHEN mp.metric_id IS NULL THEN 'MISSING'
        ELSE 'COMPUTED'
    END AS status
FROM (
    SELECT DISTINCT ts 
    FROM series.series_points 
    WHERE series_id = '1'  -- Reserves
        AND ts >= CURRENT_DATE - INTERVAL '30 days'
) expected_dates
LEFT JOIN metrics.metrics_points mp ON expected_dates.ts = mp.ts 
    AND mp.metric_id = 'ratio.reserves_to_base'
ORDER BY expected_dates.ts DESC;
```

### 14. Check Dependencies for Metrics

```sql
-- Verify all required series are available for metric computation
SELECT 
    mp.ts,
    mp.metric_id,
    CASE 
        WHEN r.value IS NULL THEN 'MISSING_RESERVES'
        WHEN b.value IS NULL THEN 'MISSING_BASE'
        WHEN o.value IS NULL THEN 'MISSING_RATE'
        ELSE 'ALL_PRESENT'
    END AS dependency_status
FROM metrics.metrics_points mp
LEFT JOIN series.series_points r ON mp.ts = r.ts AND r.series_id = '1'
LEFT JOIN series.series_points b ON mp.ts = b.ts AND b.series_id = '15'
LEFT JOIN series.series_points o ON mp.ts = o.ts AND o.series_id = 'bcra.usd_official_ars'
WHERE mp.metric_id = 'ratio.reserves_to_base'
    AND mp.ts >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY mp.ts DESC;
```

## Tips and Best Practices

### Query Performance
- **Use indexes**: Always filter on `series_id` and `ts` for time-series queries
- **Limit results**: Use `LIMIT` for large result sets
- **Avoid SELECT \***: Specify only needed columns
- **Use EXPLAIN**: Analyze query plans for optimization

### Data Analysis
- **Business days**: Filter weekends using `EXTRACT(DOW FROM ts) BETWEEN 1 AND 5`
- **Date ranges**: Use `INTERVAL` for relative date calculations
- **Null handling**: Use `COALESCE` or `CASE` for missing data
- **Aggregations**: Use window functions for time-series analysis

### Common Patterns
- **Latest values**: `WHERE ts = (SELECT MAX(ts) FROM ...)`
- **Time windows**: `WHERE ts >= CURRENT_DATE - INTERVAL 'N days'`
- **Gap detection**: Use `generate_series()` with `LEFT JOIN`
- **Outlier detection**: Use statistical functions like `STDDEV()`
