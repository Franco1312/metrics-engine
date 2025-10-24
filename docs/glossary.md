# Glossary - Domain Terminology

## Core Concepts

### **Series**
A time-ordered collection of data points representing a specific economic indicator over time. Each series has a unique identifier and metadata describing its source, frequency, and units.

**Example**: "Reservas Internacionales" (International Reserves) published daily by BCRA.

### **Series Points**
Individual data points within a time series, each containing a timestamp (`ts`) and a numeric value (`value`). Points are stored in chronological order and represent the raw data as published by official sources.

**Example**: `{ts: "2024-01-15", value: 45000.50}` for reserves in USD.

### **Metric**
A computed economic indicator derived from one or more raw time series through mathematical operations. Metrics provide analytical insights beyond raw data.

**Example**: "Reserves-to-Base Ratio" computed from reserves and monetary base series.

### **Metric Point**
A single computed value for a specific metric at a specific date. Represents the result of applying a mathematical formula to raw series data.

**Example**: `{metric_id: "ratio.reserves_to_base", ts: "2024-01-15", value: 0.85}`.

## Data Management Terms

### **Frequency**
The update frequency of a time series, indicating how often new data points are published.

- **`daily`**: Updated every business day
- **`monthly`**: Updated once per month
- **`weekly`**: Updated once per week

### **Unit**
The measurement unit for a series or metric value.

- **`USD`**: US Dollars
- **`ARS`**: Argentine Pesos  
- **`ARS/USD`**: Exchange rate (Pesos per Dollar)
- **`ratio`**: Dimensionless ratio
- **`index`**: Index value (base = 100)

### **Lag**
The time difference between data availability and computation. Some metrics require historical data to compute current values.

**Example**: 7-day delta requires data from 7 days ago to compute today's change.

### **Backfill**
The process of computing historical metrics for past dates, typically used when:
- New metrics are introduced
- Historical data becomes available
- Data corrections require recomputation

### **Idempotent Upsert**
A database operation that can be safely repeated without side effects. If a record exists, it's updated; if not, it's created.

**SQL Pattern**: `ON CONFLICT (metric_id, ts) DO UPDATE SET value = EXCLUDED.value`

## Economic Indicators

### **Reserves (Reservas Internacionales)**
Argentina's international reserves held by the Central Bank, denominated in USD. Represents the country's foreign currency liquidity.

**Source**: BCRA Monetarias API
**Series ID**: `"1"`
**Unit**: `USD`
**Frequency**: `daily`

### **Monetary Base (Base Monetaria)**
The total amount of currency in circulation plus bank reserves held by the Central Bank, denominated in ARS.

**Source**: BCRA Monetarias API  
**Series ID**: `"15"`
**Unit**: `ARS`
**Frequency**: `daily`

### **Official Exchange Rate (Tipo de Cambio Oficial)**
The official USD/ARS exchange rate set by the Central Bank for official transactions.

**Source**: BCRA Cambiarias API
**Series ID**: `"bcra.usd_official_ars"`
**Unit**: `ARS/USD`
**Frequency**: `daily`

### **MEP Rate (Dólar MEP)**
The "Mercado Electrónico de Pagos" exchange rate, representing the implicit USD/ARS rate from bond transactions.

**Source**: DolarAPI
**Series ID**: `"dolarapi.mep_ars"`
**Unit**: `ARS/USD`
**Frequency**: `daily`

### **Brecha (Exchange Rate Gap)**
The percentage difference between parallel market rates (MEP/CCL) and the official exchange rate, indicating market pressure.

**Formula**: `(parallel_rate - official_rate) / official_rate`

## Technical Terms

### **Provider**
The external data source that publishes the raw time series data.

- **`bcra`**: Banco Central de la República Argentina
- **`indec`**: Instituto Nacional de Estadística y Censos
- **`dolarapi`**: Third-party financial data provider

### **Normalization**
The process of standardizing data from different sources into a consistent format:
- Date formats (ISO 8601)
- Numeric precision
- Unit conversions
- Missing value handling

### **Metadata**
Additional information stored alongside data points, including:
- Source URLs and API references
- Provider-specific identifiers
- Data quality flags
- Computation context (for metrics)

### **Timezone Handling**
- **Storage**: All timestamps stored in UTC
- **Processing**: Jobs run in Argentina timezone (America/Argentina/Buenos_Aires)
- **Display**: Converted to local timezone for user interfaces

## Data Quality Terms

### **Missing Days**
Dates where expected data is not available, typically due to:
- Weekends and holidays
- Provider system outages
- Data publication delays

**Policy**: Do not interpolate or pad missing data; compute metrics only when all required inputs are available.

### **Data Revisions**
Updates to previously published data points, common in official statistics.

**Handling**: Metrics are recomputed when source data changes, maintaining full audit trail.

### **Edge Cases**
Special conditions that require careful handling:
- Zero denominators in ratio calculations
- Missing historical data for delta computations
- Holiday effects on daily series

## Business Interpretation

### **Reserves-to-Base Ratio**
**Formula**: `reserves_usd / base_monetaria_ars`

**Interpretation**:
- **> 1.0**: Reserves exceed monetary base (strong backing)
- **0.5-1.0**: Adequate backing (yellow zone)
- **< 0.5**: Insufficient backing (red zone)

**Business Meaning**: Indicates the Central Bank's ability to defend the currency with available reserves.

### **7-Day Delta (Reserves)**
**Formula**: `(R[t] - R[t-7]) / R[t-7]`

**Interpretation**:
- **Positive**: Reserves increasing over the week
- **Negative**: Reserves decreasing over the week
- **Magnitude**: Rate of change (e.g., -0.05 = 5% weekly decline)

### **30-Day Delta (Monetary Base)**
**Formula**: `(BM[t] - BM[t-30]) / BM[t-30]`

**Interpretation**:
- **Positive**: Monetary expansion over the month
- **Negative**: Monetary contraction over the month
- **Magnitude**: Monthly growth rate

## References

### **Official Sources**
- **BCRA**: [Banco Central de la República Argentina](https://www.bcra.gob.ar/)
- **INDEC**: [Instituto Nacional de Estadística y Censos](https://www.indec.gob.ar/)
- **BCRA APIs**: [Sistema de Información Financiera](https://www.bcra.gob.ar/BCRAyVos/Herramientas/InformacionFinanciera.asp)

### **Data Providers**
- **DolarAPI**: [Real-time exchange rates](https://dolarapi.com/)
- **Datos Argentina**: [Government data portal](https://datos.gob.ar/)

### **Methodology References**
- **BCRA Methodology**: [Monetary Statistics Manual](https://www.bcra.gob.ar/BCRAyVos/Herramientas/InformacionFinanciera.asp)
- **IMF Standards**: [Monetary and Financial Statistics Manual](https://www.imf.org/external/pubs/ft/mfs/manual/index.htm)
