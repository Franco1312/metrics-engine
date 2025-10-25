# Motor de Métricas v0 - Documentación

## ¿Qué es Metrics Engine?

**Metrics Engine** es un servicio independiente que calcula y persiste métricas económicas derivadas utilizando únicamente los datos ya ingeridos en las tablas `series` y `series_points` del sistema de ingesta. **NO ingiere APIs externas** - solo lee de las tablas existentes y escribe a `metrics_points`.

## Arquitectura

### Flujo de Datos
```
series + series_points (lectura) → Metrics Engine → metrics_points (escritura)
```

### Fuentes de Datos
- **series**: Catálogo de series disponibles
- **series_points**: Puntos de datos temporales
- **metrics_points**: Métricas calculadas (salida)

## Métricas Calculadas

### Métricas FX (Foreign Exchange)

#### `fx.brecha_mep`
- **Fórmula**: `(MEP - OFICIAL) / OFICIAL`
- **Unidad**: Ratio (decimal)
- **Interpretación**: Brecha entre dólar MEP y tipo oficial como porcentaje
- **Dependencias**: 
  - `dolarapi.mep_ars` (MEP ARS/USD)
  - `bcra.usd_official_ars` (preferido) o `168.1_T_CAMBIOR_D_0_0_26` (fallback)
- **Política de faltantes**: Sin forward-fill en v0
  - Si falta MEP o OFICIAL → se omite el cálculo para esa fecha
- **Interpretación de negocio**:
  - **Valores positivos**: MEP > OFICIAL (brecha cambiaria)
  - **Valores negativos**: MEP < OFICIAL (situación atípica)
  - **Valores cercanos a 0**: MEP ≈ OFICIAL (mercado equilibrado)
- **Ejemplo de cálculo**:
  ```
  MEP[2025-10-24] = 1000 ARS/USD
  OFICIAL[2025-10-24] = 1000 ARS/USD
  fx.brecha_mep = (1000 - 1000) / 1000 = 0.0 (0%)
  ```

### Métricas Monetarias

#### `mon.base_usd`
- **Fórmula**: `BASE / OFICIAL`
- **Unidad**: USD
- **Interpretación**: Base monetaria convertida a dólares

#### `mon.respaldo`
- **Fórmula**: `RESERVAS / (BASE / OFICIAL)`
- **Unidad**: Ratio (adimensional)
- **Interpretación**: Reservas como porcentaje de la base monetaria en USD

#### `mon.pasivos_rem_ars`
- **Fórmula**: `LELIQ + PASES_PASIVOS + PASES_ACTIVOS`
- **Unidad**: ARS
- **Interpretación**: Total de pasivos remunerados en pesos

#### `mon.base_ampliada_ars`
- **Fórmula**: `BASE + mon.pasivos_rem_ars`
- **Unidad**: ARS
- **Interpretación**: Base monetaria ampliada incluyendo pasivos remunerados

#### `mon.respaldo_real`
- **Fórmula**: `RESERVAS / (mon.base_ampliada_ars / OFICIAL)`
- **Unidad**: Ratio (adimensional)
- **Interpretación**: Reservas como porcentaje de la base ampliada en USD

### Métricas de Ratio

#### `ratio.reserves_to_base`
- **Fórmula**: `RESERVAS / BASE`
- **Unidad**: Ratio (adimensional)
- **Interpretación**: Reservas como porcentaje de la base monetaria
- **Rango esperado**: [0.001, 0.1]
- **Interpretación de negocio**: 
  - **Valores altos (>0.05)**: Reservas sólidas, respaldo fuerte
  - **Valores medios (0.01-0.05)**: Reservas moderadas, respaldo adecuado
  - **Valores bajos (<0.01)**: Reservas bajas, respaldo débil

## Delta 7 días (Reservas)

#### `delta.reserves_7d`
- **Fórmula**: `(RESERVAS[t] - RESERVAS[t-7]) / RESERVAS[t-7]`
- **Unidad**: Ratio (decimal)
- **Interpretación**: Cambio porcentual de reservas en 7 días
- **Dependencias**: 
  - `series_id = "1"` (RESERVAS USD, BCRA Monetarias)
- **Política de faltantes**: Sin forward-fill en v0
  - Si falta el punto `t-7` → se omite el cálculo para esa fecha
  - Se registra en logs como "skipped"
- **Interpretación de negocio**:
  - **Valores positivos**: Aumento de reservas (favorable)
  - **Valores negativos**: Disminución de reservas (desfavorable)
  - **Valores cercanos a 0**: Estabilidad en reservas
- **Ejemplo de cálculo**:
  ```
  RESERVAS[2025-10-22] = 45,000 USD
  RESERVAS[2025-10-15] = 47,000 USD
  delta.reserves_7d = (45,000 - 47,000) / 47,000 = -0.0426 (-4.26%)
  ```

## Delta 30 días (Base Monetaria)

#### `delta.base_30d`
- **Fórmula**: `(BASE[t] - BASE[t-30]) / BASE[t-30]`
- **Unidad**: Ratio (decimal)
- **Interpretación**: Cambio porcentual de base monetaria en 30 días
- **Dependencias**: 
  - `series_id = "15"` (BASE ARS, BCRA Monetarias)
- **Política de faltantes**: Sin forward-fill en v0
  - Si falta el punto `t-30` → se omite el cálculo para esa fecha
  - Se registra en logs como "skipped"
- **Interpretación de negocio**:
  - **Valores positivos**: Expansión monetaria (inflacionario)
  - **Valores negativos**: Contracción monetaria (deflacionario)
  - **Valores cercanos a 0**: Estabilidad monetaria
- **Ejemplo de cálculo**:
  ```
  BASE[2025-10-22] = 5,300,000 ARS
  BASE[2025-09-22] = 5,500,000 ARS
  delta.base_30d = (5,300,000 - 5,500,000) / 5,500,000 = -0.0364 (-3.64%)
  ```

## Delta 5 días (Reservas)

#### `delta.reserves_5d`
- **Fórmula**: `(RESERVAS[t] - RESERVAS[t-5]) / RESERVAS[t-5]`
- **Unidad**: Ratio (decimal)
- **Interpretación**: Cambio porcentual de reservas en 5 días
- **Dependencias**: 
  - `series_id = "1"` (RESERVAS USD, BCRA Monetarias)
- **Política de faltantes**: Sin forward-fill en v0
  - Si falta el punto `t-5` → se omite el cálculo para esa fecha
  - Se registra en logs como "skipped"
- **Interpretación de negocio**:
  - **Valores positivos**: Aumento de reservas (favorable)
  - **Valores negativos**: Disminución de reservas (desfavorable)
  - **Valores cercanos a 0**: Estabilidad en reservas
- **Ejemplo de cálculo**:
  ```
  RESERVAS[2025-10-22] = 45,000 USD
  RESERVAS[2025-10-17] = 46,200 USD
  delta.reserves_5d = (45,000 - 46,200) / 46,200 = -0.026 (-2.6%)
  ```

## Métricas Monetarias Tácticas

#### `mon.pasivos_rem_ars`
- **Fórmula**: `LELIQ + PASES_PASIVOS + PASES_ACTIVOS`
- **Unidad**: ARS
- **Interpretación**: Total de pasivos remunerados en pesos
- **Dependencias**: 
  - `bcra.leliq_total_ars` (LELIQ ARS)
  - `bcra.pases_pasivos_total_ars` (PASES PASIVOS ARS)
  - `bcra.pases_activos_total_ars` (PASES ACTIVOS ARS)
- **Política de faltantes**: Suma componentes disponibles
  - Si falta un componente → suma los disponibles y registra faltantes en metadata
- **Interpretación de negocio**:
  - **Valores altos**: Mayor presión sobre la base monetaria
  - **Valores bajos**: Menor presión monetaria
- **Ejemplo de cálculo**:
  ```
  LELIQ[2025-10-22] = 50,000,000 ARS
  PASES_PASIVOS[2025-10-22] = 30,000,000 ARS
  PASES_ACTIVOS[2025-10-22] = 20,000,000 ARS
  mon.pasivos_rem_ars = 50,000,000 + 30,000,000 + 20,000,000 = 100,000,000 ARS
  ```

#### `mon.base_ampliada_ars`
- **Fórmula**: `BASE + mon.pasivos_rem_ars`
- **Unidad**: ARS
- **Interpretación**: Base monetaria ampliada incluyendo pasivos remunerados
- **Dependencias**: 
  - `series_id = "15"` (BASE ARS)
  - `mon.pasivos_rem_ars` (pasivos remunerados)
- **Política de faltantes**: Si falta pasivos → usa solo base
  - Registra componentes faltantes en metadata
- **Interpretación de negocio**:
  - **Valores altos**: Mayor liquidez en el sistema
  - **Valores bajos**: Menor liquidez
- **Ejemplo de cálculo**:
  ```
  BASE[2025-10-22] = 300,000,000 ARS
  mon.pasivos_rem_ars[2025-10-22] = 100,000,000 ARS
  mon.base_ampliada_ars = 300,000,000 + 100,000,000 = 400,000,000 ARS
  ```

#### `mon.respaldo_real`
- **Fórmula**: `RESERVAS / (mon.base_ampliada_ars / OFICIAL)`
- **Unidad**: Ratio (decimal)
- **Interpretación**: Reservas como porcentaje de la base ampliada en USD
- **Dependencias**: 
  - `series_id = "1"` (RESERVAS USD)
  - `mon.base_ampliada_ars` (base ampliada)
  - `bcra.usd_official_ars` (preferido) o `168.1_T_CAMBIOR_D_0_0_26` (fallback)
- **Política de faltantes**: Si falta cualquier componente → se omite
- **Interpretación de negocio**:
  - **Valores altos (>0.1)**: Respaldo sólido
  - **Valores medios (0.01-0.1)**: Respaldo moderado
  - **Valores bajos (<0.01)**: Respaldo débil
- **Ejemplo de cálculo**:
  ```
  RESERVAS[2025-10-22] = 45,000 USD
  mon.base_ampliada_ars[2025-10-22] = 400,000,000 ARS
  OFICIAL[2025-10-22] = 1000 ARS/USD
  mon.respaldo_real = 45,000 / (400,000,000 / 1000) = 0.1125 (11.25%)
  ```

## Orden de Ejecución Diario

### Cronograma de Procesamiento
1. **08:05 ART**: Ingestor actualiza datos de `series_points`
2. **08:15 ART**: Metrics Engine calcula métricas derivadas
3. **08:30 ART**: Sistema de alertas procesa métricas actualizadas

### Orden de Cálculo de Métricas
1. **mon.pasivos_rem_ars** (dependencia base)
2. **mon.base_ampliada_ars** (depende de pasivos)
3. **fx.brecha_mep** (independiente)
4. **delta.reserves_5d** (independiente)
5. **mon.respaldo_real** (depende de base_ampliada + reservas + oficial)

### Política de Recomputación
- **Ventana de recomputación**: Últimos 60 días (cubre lag de 30 días)
- **Idempotencia**: Re-ejecutar no duplica datos, solo actualiza si hay cambios
- **Logs estructurados**: JSON con métricas por métrica (computed/inserted/updated/skipped)

## Metadatos por Punto

Cada punto de métrica incluye metadatos para auditoría:

### Métricas Delta
```json
{
  "window": "5d" | "7d" | "30d",
  "base_ts": "YYYY-MM-DD",
  "inputs": ["series:1","series:15"],
  "current": 45000,
  "previous": 47000,
  "lag_days": 5
}
```

### Métricas FX
```json
{
  "inputs": ["mep", "oficial"],
  "oficial_fx_source": "bcra|datos",
  "units": "ratio",
  "mep": 1000,
  "oficial": 1000
}
```

### Métricas Monetarias
```json
{
  "inputs": ["leliq", "pases_pasivos", "pases_activos"],
  "missing_components": [],
  "leliq": 50000000,
  "pases_pasivos": 30000000,
  "pases_activos": 20000000
}
```

### Métricas de Respaldo
```json
{
  "inputs": ["reservas", "base", "pasivos", "oficial"],
  "oficial_fx_source": "bcra|datos",
  "units": "ratio",
  "reservas": 45000,
  "base_ampliada": 400000000,
  "oficial": 1000
}
```

## Comandos CLI

### Recomputación de Ventana
```bash
# Recomputar últimos 30 días
pnpm metrics:recompute -- --days 30

# Recomputar últimos 60 días (para delta.base_30d)
pnpm metrics:recompute -- --days 60
```

### Actualización Diaria
```bash
# Recomputar últimos 45 días + hoy
pnpm metrics:update
```

## Endpoints HTTP

### Health Check
```
GET /api/health
```

Respuesta:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-25",
  "timezone": "America/Argentina/Buenos_Aires",
  "databases": {
    "source": true,
    "target": true
  }
}
```

### Obtener Métricas Delta
```
GET /api/v1/metrics/delta.reserves_7d?limit=10
GET /api/v1/metrics/delta.base_30d?limit=10
```

### Resumen de Métricas
```
GET /api/v1/metrics/summary?ids=delta.reserves_7d,delta.base_30d
```

## Troubleshooting

### Métricas Faltantes
- **delta.reserves_7d**: Verificar que hay datos de reservas con al menos 7 días de lag
- **delta.base_30d**: Verificar que hay datos de base monetaria con al menos 30 días de lag

### Logs de Skipped
- Revisar logs para identificar fechas omitidas y razones
- Verificar disponibilidad de datos en `series_points`

### Conectividad de Bases de Datos
- SOURCE DB (ingestor): Puerto 5433, solo lectura
- TARGET DB (metrics_engine): Puerto 5434, lectura/escritura