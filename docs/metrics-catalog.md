# Metrics Catalog

## Overview

This catalog documents all computed metrics in the system, including their mathematical formulas, dependencies, interpretation guidelines, and business meaning.

## Metric Definitions

### 1. Reserves-to-Base Ratio

**ID**: `ratio.reserves_to_base`
**Description**: Ratio of international reserves to monetary base, indicating currency backing strength
**Formula**: `R[t] / BM[t]`
**Unit**: `ratio` (dimensionless)
**Frequency**: `daily`

#### Dependencies
- **Reserves**: Series ID `"1"` (USD)
- **Monetary Base**: Series ID `"15"` (ARS)

#### Mathematical Formula
```
ratio.reserves_to_base[t] = reserves_usd[t] / base_monetaria_ars[t]
```

#### Business Interpretation
- **> 1.0**: Strong backing (reserves exceed monetary base)
- **0.5-1.0**: Adequate backing (yellow zone)
- **< 0.5**: Insufficient backing (red zone)

#### Risk Bands
| Range | Color | Interpretation | Action |
|-------|-------|---------------|--------|
| > 1.0 | 🟢 GREEN | Strong backing | Monitor |
| 0.5-1.0 | 🟡 AMBER | Adequate backing | Watch trends |
| < 0.5 | 🔴 RED | Insufficient backing | Alert |

#### Example Calculation
```
Date: 2024-01-15
Reserves: 45,000 USD
Monetary Base: 53,000 ARS
Official Rate: 1,200 ARS/USD

Base in USD: 53,000 / 1,200 = 44.17 USD
Ratio: 45,000 / 44.17 = 1.02
```

#### Edge Cases
- **Zero Base**: Skip computation (division by zero)
- **Missing Data**: Skip if either input unavailable
- **Holidays**: Use last available data

---

### 2. Reserves 7-Day Delta

**ID**: `delta.reserves_7d`
**Description**: Weekly percentage change in international reserves
**Formula**: `(R[t] - R[t-7]) / R[t-7]`
**Unit**: `ratio` (dimensionless, represents percentage)
**Frequency**: `daily`

#### Dependencies
- **Reserves**: Series ID `"1"` (USD)

#### Mathematical Formula
```
delta.reserves_7d[t] = (R[t] - R[t-7]) / R[t-7]
```

#### Business Interpretation
- **Positive**: Reserves increasing over the week
- **Negative**: Reserves decreasing over the week
- **Magnitude**: Rate of change (e.g., -0.05 = 5% weekly decline)

#### Risk Bands
| Range | Color | Interpretation | Action |
|-------|-------|---------------|--------|
| > 0.05 | 🟢 GREEN | Strong growth | Monitor |
| -0.05 to 0.05 | 🟡 AMBER | Stable | Watch trends |
| < -0.05 | 🔴 RED | Declining | Alert |

#### Example Calculation
```
Date: 2024-01-15
Current Reserves: 45,000 USD
7 days ago: 42,000 USD

Delta: (45,000 - 42,000) / 42,000 = 0.071 (7.1% weekly increase)
```

#### Edge Cases
- **Missing 7-day lag**: Skip computation
- **Zero previous value**: Skip computation (division by zero)
- **Weekends**: Use last business day

---

### 3. Monetary Base 30-Day Delta

**ID**: `delta.base_30d`
**Description**: Monthly percentage change in monetary base
**Formula**: `(BM[t] - BM[t-30]) / BM[t-30]`
**Unit**: `ratio` (dimensionless, represents percentage)
**Frequency**: `daily`

#### Dependencies
- **Monetary Base**: Series ID `"15"` (ARS)

#### Mathematical Formula
```
delta.base_30d[t] = (BM[t] - BM[t-30]) / BM[t-30]
```

#### Business Interpretation
- **Positive**: Monetary expansion over the month
- **Negative**: Monetary contraction over the month
- **Magnitude**: Monthly growth rate

#### Risk Bands
| Range | Color | Interpretation | Action |
|-------|-------|---------------|--------|
| > 0.10 | 🔴 RED | High inflation risk | Alert |
| 0.05 to 0.10 | 🟡 AMBER | Moderate growth | Monitor |
| < 0.05 | 🟢 GREEN | Controlled growth | Normal |

#### Example Calculation
```
Date: 2024-01-15
Current Base: 53,000 ARS
30 days ago: 50,000 ARS

Delta: (53,000 - 50,000) / 50,000 = 0.06 (6% monthly increase)
```

#### Edge Cases
- **Missing 30-day lag**: Skip computation
- **Zero previous value**: Skip computation (division by zero)
- **Month boundaries**: Use exact 30-day lag

---

### 4. MEP-Official Exchange Rate Gap

**ID**: `brecha.mep_oficial`
**Description**: Percentage difference between MEP and official exchange rates
**Formula**: `(MEP[t] - OFICIAL[t]) / OFICIAL[t]`
**Unit**: `ratio` (dimensionless, represents percentage)
**Frequency**: `daily`

#### Dependencies
- **MEP Rate**: Series ID `"dolarapi.mep_ars"` (ARS/USD)
- **Official Rate**: Series ID `"bcra.usd_official_ars"` (ARS/USD)

#### Mathematical Formula
```
brecha.mep_oficial[t] = (MEP[t] - OFICIAL[t]) / OFICIAL[t]
```

#### Business Interpretation
- **Positive**: MEP rate higher than official (parallel market premium)
- **Negative**: MEP rate lower than official (rare)
- **Magnitude**: Market pressure indicator

#### Risk Bands
| Range | Color | Interpretation | Action |
|-------|-------|---------------|--------|
| > 0.20 | 🔴 RED | High parallel premium | Alert |
| 0.10 to 0.20 | 🟡 AMBER | Moderate premium | Monitor |
| < 0.10 | 🟢 GREEN | Low premium | Normal |

#### Example Calculation
```
Date: 2024-01-15
MEP Rate: 1,440 ARS/USD
Official Rate: 1,200 ARS/USD

Gap: (1,440 - 1,200) / 1,200 = 0.20 (20% premium)
```

#### Edge Cases
- **Missing either rate**: Skip computation
- **Zero official rate**: Skip computation (division by zero)
- **Market holidays**: Use last available data

## Versioning Policy

### Metric Versioning
- **Version 1**: Initial implementation
- **Version 2+**: Formula changes, dependency updates, or business logic modifications

### Backward Compatibility
- New versions maintain the same metric ID
- Historical data remains unchanged
- Version information stored in `metrics.metrics.version`

### Migration Strategy
- **Soft migration**: New computations use updated formula
- **Historical recomputation**: Optional backfill with new formula
- **Audit trail**: Version changes logged in metadata

## Data Quality Standards

### Input Validation
- **Numeric values**: Must be finite numbers
- **Date alignment**: All inputs must have data for the same date
- **Unit consistency**: Dependencies must have compatible units

### Output Validation
- **Range checks**: Values within expected business ranges
- **Outlier detection**: Flag unusual or suspicious computations
- **Consistency checks**: Cross-validate related metrics

### Error Handling
- **Missing data**: Skip computation, log warning
- **Invalid inputs**: Skip computation, log error
- **Computation errors**: Skip computation, log error with context

## Monitoring and Alerting

### Key Metrics to Monitor
1. **Data freshness**: Time since last update
2. **Computation success rate**: Percentage of successful computations
3. **Data quality**: Percentage of valid vs. invalid computations
4. **Performance**: Computation time and resource usage

### Alert Thresholds
- **Data staleness**: > 2 hours since last update
- **Computation failures**: > 5% failure rate
- **Data quality issues**: > 10% invalid computations
- **Performance degradation**: > 2x normal computation time

## Business Rules

### Computation Schedule
- **Daily**: All metrics computed at 08:15 ART
- **Manual**: Available via CLI commands
- **Backfill**: Historical recomputation available

### Data Retention
- **Raw data**: Permanent retention
- **Computed metrics**: Permanent retention with compression
- **Audit logs**: 90-day retention for debugging

### Access Control
- **Read-only**: Source database access
- **Read-write**: Target database access
- **CLI access**: Development and operations teams
