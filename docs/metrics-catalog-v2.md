# Catálogo de Métricas v2.0 - Metrics Engine

## 📋 Resumen Ejecutivo

**Metrics Engine v2.0** es un sistema de cálculo de métricas económicas que procesa datos de series temporales para generar indicadores financieros y monetarios clave. El sistema está diseñado para ser **idempotente**, **determinista** y **robusto** ante datos faltantes.

### 🎯 Objetivos
- Calcular métricas económicas derivadas de series temporales
- Proporcionar indicadores de salud financiera y monetaria
- Mantener consistencia temporal y alineación de datos
- Garantizar trazabilidad y auditoría completa

---

## 🏗️ Arquitectura del Sistema

### Flujo de Datos
```
📊 INGESTOR DB (AWS Aurora) → 🔄 METRICS ENGINE → 📈 METRICS DB (AWS Aurora)
     series_points                    ↓                    metrics_points
     (lectura)                   Cálculos                  (escritura)
```

### Componentes Principales
- **Source Database**: Base de datos de ingesta (solo lectura)
- **Target Database**: Base de datos de métricas (lectura/escritura)
- **Use Cases**: Lógica de cálculo modular por tipo de métrica
- **Utilities**: Servicios de soporte (fechas, estadísticas, series)

---

## 📊 Catálogo de Métricas

### 1. Deltas Monetarios (Monetary Deltas)

#### 1.1 Delta Base Monetaria

**Métricas**:
- `delta.base_7d.abs` - Delta absoluto de base monetaria (7 días hábiles)
- `delta.base_7d.pct` - Delta porcentual de base monetaria (7 días hábiles)
- `delta.base_30d.abs` - Delta absoluto de base monetaria (30 días hábiles)
- `delta.base_30d.pct` - Delta porcentual de base monetaria (30 días hábiles)
- `delta.base_90d.abs` - Delta absoluto de base monetaria (90 días hábiles)
- `delta.base_90d.pct` - Delta porcentual de base monetaria (90 días hábiles)

**Fórmulas**:
```
delta.base_7d.abs[t] = BASE[t] - BASE[t-7_business_days]
delta.base_7d.pct[t] = ((BASE[t] / BASE[t-7_business_days]) - 1) × 100

delta.base_30d.abs[t] = BASE[t] - BASE[t-30_business_days]
delta.base_30d.pct[t] = ((BASE[t] / BASE[t-30_business_days]) - 1) × 100

delta.base_90d.abs[t] = BASE[t] - BASE[t-90_business_days]
delta.base_90d.pct[t] = ((BASE[t] / BASE[t-90_business_days]) - 1) × 100
```

**Dependencias**:
- `series_id = "15"` (Base Monetaria en ARS)

**Unidades**:
- `.abs`: ARS (pesos argentinos)
- `.pct`: Porcentaje (%)

**Interpretación**:
- **Valores positivos**: Expansión monetaria
- **Valores negativos**: Contracción monetaria
- **Magnitud**: Velocidad de cambio monetario

**Umbrales de Riesgo**:
| Rango | Color | Interpretación | Acción |
|-------|-------|---------------|--------|
| > 10% | 🔴 ROJO | Expansión excesiva | Alerta inflacionaria |
| 5-10% | 🟡 AMARILLO | Crecimiento moderado | Monitorear tendencia |
| < 5% | 🟢 VERDE | Crecimiento controlado | Normal |

---

#### 1.2 Delta Reservas Internacionales

**Métricas**:
- `delta.reserves_7d.abs` - Delta absoluto de reservas (7 días hábiles)
- `delta.reserves_7d.pct` - Delta porcentual de reservas (7 días hábiles)
- `delta.reserves_30d.abs` - Delta absoluto de reservas (30 días hábiles)
- `delta.reserves_30d.pct` - Delta porcentual de reservas (30 días hábiles)

**Fórmulas**:
```
delta.reserves_7d.abs[t] = RESERVAS[t] - RESERVAS[t-7_business_days]
delta.reserves_7d.pct[t] = ((RESERVAS[t] / RESERVAS[t-7_business_days]) - 1) × 100

delta.reserves_30d.abs[t] = RESERVAS[t] - RESERVAS[t-30_business_days]
delta.reserves_30d.pct[t] = ((RESERVAS[t] / RESERVAS[t-30_business_days]) - 1) × 100
```

**Dependencias**:
- `series_id = "1"` (Reservas Internacionales en USD)

**Unidades**:
- `.abs`: USD (dólares estadounidenses)
- `.pct`: Porcentaje (%)

**Interpretación**:
- **Valores positivos**: Aumento de reservas (favorable)
- **Valores negativos**: Disminución de reservas (desfavorable)
- **Magnitud**: Velocidad de cambio de reservas

**Umbrales de Riesgo**:
| Rango | Color | Interpretación | Acción |
|-------|-------|---------------|--------|
| < -5% | 🔴 ROJO | Pérdida significativa | Alerta crítica |
| -2% a -5% | 🟡 AMARILLO | Deterioro moderado | Monitorear |
| > -2% | 🟢 VERDE | Estabilidad | Normal |

---

### 2. Agregados Monetarios y Ratios de Liquidez

#### 2.1 Base Ampliada

**Métrica**:
- `mon.base_ampliada_ars` - Base monetaria ampliada en pesos

**Fórmula**:
```
mon.base_ampliada_ars[t] = BASE[t] + LELIQ[t] + PASES_ACTIVOS[t] + PASES_PASIVOS[t]
```

**Dependencias**:
- `series_id = "15"` (Base Monetaria)
- `series_id = "bcra.leliq_total_ars"` (LELIQ)
- `series_id = "bcra.pases_activos_total_ars"` (Pases Activos)
- `series_id = "bcra.pases_pasivos_total_ars"` (Pases Pasivos)

**Unidad**: ARS (pesos argentinos)

**Interpretación**:
- **Valores altos**: Mayor liquidez en el sistema
- **Valores bajos**: Menor liquidez
- **Tendencia creciente**: Presión inflacionaria potencial

---

#### 2.2 Ratio Base vs Base Ampliada

**Métrica**:
- `ratio.base_vs_base_ampliada` - Proporción de base monetaria en la base ampliada

**Fórmula**:
```
ratio.base_vs_base_ampliada[t] = BASE[t] / mon.base_ampliada_ars[t]
```

**Dependencias**:
- `series_id = "15"` (Base Monetaria)
- `mon.base_ampliada_ars` (Base Ampliada)

**Unidad**: Ratio (adimensional)

**Interpretación**:
- **Valores altos (>0.8)**: Base monetaria domina la liquidez
- **Valores medios (0.5-0.8)**: Equilibrio entre base y pasivos
- **Valores bajos (<0.5)**: Pasivos remunerados dominan

---

### 3. Respaldo del Peso (Peso Backing)

#### 3.1 Ratio Reservas a Base

**Métrica**:
- `ratio.reserves_to_base` - Ratio de reservas a base monetaria

**Fórmula**:
```
ratio.reserves_to_base[t] = RESERVAS[t] / (BASE[t] / USD_OFFICIAL[t])
```

**Dependencias**:
- `series_id = "1"` (Reservas en USD)
- `series_id = "15"` (Base Monetaria en ARS)
- `series_id = "bcra.cambiarias.usd"` (Tipo de Cambio Oficial)

**Unidad**: Ratio (adimensional)

**Interpretación**:
- **Valores > 1.0**: Respaldo fuerte (reservas exceden base en USD)
- **Valores 0.5-1.0**: Respaldo adecuado
- **Valores < 0.5**: Respaldo insuficiente

**Umbrales de Riesgo**:
| Rango | Color | Interpretación | Acción |
|-------|-------|---------------|--------|
| > 1.0 | 🟢 VERDE | Respaldo fuerte | Monitorear |
| 0.5-1.0 | 🟡 AMARILLO | Respaldo adecuado | Vigilar tendencia |
| < 0.5 | 🔴 ROJO | Respaldo insuficiente | Alerta crítica |

---

#### 3.2 Ratio Pasivos vs Reservas

**Métrica**:
- `ratio.passives_vs_reserves` - Ratio de pasivos totales a reservas

**Fórmula**:
```
ratio.passives_vs_reserves[t] = (LELIQ[t] + PASES_ACTIVOS[t] + PASES_PASIVOS[t]) / (RESERVAS[t] × USD_OFFICIAL[t])
```

**Dependencias**:
- `series_id = "1"` (Reservas en USD)
- `series_id = "bcra.cambiarias.usd"` (Tipo de Cambio Oficial)
- `series_id = "bcra.leliq_total_ars"` (LELIQ)
- `series_id = "bcra.pases_activos_total_ars"` (Pases Activos)
- `series_id = "bcra.pases_pasivos_total_ars"` (Pases Pasivos)

**Unidad**: Ratio (adimensional)

**Interpretación**:
- **Valores altos**: Mayor presión sobre las reservas
- **Valores bajos**: Menor presión sobre las reservas
- **Tendencia creciente**: Riesgo de desequilibrio

---

### 4. Volatilidad y Tendencia FX

#### 4.1 Volatilidad USD

**Métricas**:
- `fx.vol_7d.usd` - Volatilidad del USD oficial (7 días)
- `fx.vol_30d.usd` - Volatilidad del USD oficial (30 días)

**Fórmulas**:
```
fx.vol_7d.usd[t] = σ(log_returns[USD_OFFICIAL[t-6:t]])
fx.vol_30d.usd[t] = σ(log_returns[USD_OFFICIAL[t-29:t]])

donde log_returns[t] = ln(USD_OFFICIAL[t] / USD_OFFICIAL[t-1])
```

**Dependencias**:
- `series_id = "bcra.cambiarias.usd"` (Tipo de Cambio Oficial)

**Unidad**: Ratio (adimensional)

**Interpretación**:
- **Valores altos**: Alta volatilidad cambiaria
- **Valores bajos**: Baja volatilidad cambiaria
- **Tendencia creciente**: Mayor incertidumbre cambiaria

---

#### 4.2 Tendencia USD

**Métrica**:
- `fx.trend_14v30.usd` - Tendencia del USD (diferencia de medias móviles)

**Fórmula**:
```
fx.trend_14v30.usd[t] = MA_14[USD_OFFICIAL[t]] - MA_30[USD_OFFICIAL[t]]

donde MA_n[t] = (1/n) × Σ(USD_OFFICIAL[t-n+1:t])
```

**Dependencias**:
- `series_id = "bcra.cambiarias.usd"` (Tipo de Cambio Oficial)

**Unidad**: ARS (pesos por dólar)

**Interpretación**:
- **Valores positivos**: Tendencia alcista (depreciación del peso)
- **Valores negativos**: Tendencia bajista (apreciación del peso)
- **Valores cercanos a 0**: Tendencia lateral

---

### 5. Presión Local vs Externa FX

#### 5.1 Presión Local USD

**Métrica**:
- `fx.local_pressure_30d.usd` - Presión local vs externa del USD (30 días)

**Fórmula**:
```
fx.local_pressure_30d.usd[t] = USD_normalization[t] - BASKET_normalization[t]

donde:
USD_normalization[t] = (USD[t] / USD[t-30]) - 1
BASKET_normalization[t] = promedio((CURRENCY[t] / CURRENCY[t-30]) - 1) para CURRENCY ∈ {BRL, CLP, MXN, COP}
```

**Dependencias**:
- `series_id = "bcra.cambiarias.usd"` (USD Oficial)
- `series_id = "bcra.cambiarias.brl"` (Real Brasileño)
- `series_id = "bcra.cambiarias.clp"` (Peso Chileno)
- `series_id = "bcra.cambiarias.mxn"` (Peso Mexicano)
- `series_id = "bcra.cambiarias.cop"` (Peso Colombiano)

**Unidad**: Ratio (adimensional)

**Interpretación**:
- **Valores positivos**: Presión local mayor que externa
- **Valores negativos**: Presión externa mayor que local
- **Valores cercanos a 0**: Presiones equilibradas

---

### 6. Métricas de Calidad de Datos

#### 6.1 Freshness (Frescura)

**Métricas**:
- `data.freshness.{series_id}` - Indicador de frescura de datos

**Fórmula**:
```
data.freshness.{series_id}[t] = {
  1 si horas_desde_última_actualización ≤ 24
  0 si horas_desde_última_actualización > 24
}
```

**Dependencias**:
- Cualquier `series_id` disponible

**Unidad**: Booleano (0 o 1)

**Interpretación**:
- **1**: Datos frescos (≤24 horas)
- **0**: Datos obsoletos (>24 horas)

---

#### 6.2 Coverage (Cobertura)

**Métricas**:
- `data.coverage.{series_id}` - Cobertura de datos en ventana de 30 días

**Fórmula**:
```
data.coverage.{series_id}[t] = días_con_datos_en_30_días / 30
```

**Dependencias**:
- Cualquier `series_id` disponible

**Unidad**: Ratio (0 a 1)

**Interpretación**:
- **1.0**: Cobertura completa (30/30 días)
- **0.5**: Cobertura parcial (15/30 días)
- **0.0**: Sin datos en la ventana

---

#### 6.3 Gaps (Huecos)

**Métricas**:
- `data.gaps.{series_id}` - Número de huecos en los datos

**Fórmula**:
```
data.gaps.{series_id}[t] = número_de_huecos_en_serie
```

**Dependencias**:
- Cualquier `series_id` disponible

**Unidad**: Conteo (número entero)

**Interpretación**:
- **0**: Sin huecos
- **1-5**: Pocos huecos
- **>5**: Muchos huecos

---

## 🔧 Reglas de Cálculo

### Principios Generales

1. **Idempotencia**: Ejecutar el cálculo múltiples veces produce el mismo resultado
2. **Determinismo**: Mismos inputs producen mismos outputs
3. **Alineación Temporal**: Todos los inputs deben estar disponibles para la fecha `t`
4. **Manejo de Gaps**: Omitir cálculos cuando hay datos faltantes
5. **Días Hábiles**: Usar calendario de días hábiles para ventanas temporales

### Políticas de Datos Faltantes

- **Datos faltantes**: Omitir cálculo para esa fecha
- **División por cero**: Omitir cálculo
- **Datos inválidos**: Omitir cálculo y registrar en logs
- **Series incompletas**: Omitir métricas que requieren alineación completa

### Validaciones Post-Cálculo

- **Rangos esperados**: Verificar que los valores están en rangos razonables
- **Consistencia temporal**: Verificar que las fechas son coherentes
- **Integridad de metadatos**: Verificar que los metadatos están completos

---

## 📊 Metadatos y Trazabilidad

### Estructura de Metadatos

Cada punto de métrica incluye metadatos estructurados:

```json
{
  "depends_on": ["series_id_1", "series_id_2"],
  "window": "7d|30d|90d",
  "mode": "abs|pct",
  "current": valor_actual,
  "reference": valor_referencia,
  "reference_date": "YYYY-MM-DD",
  "units": "ars|usd|percent|ratio|boolean|count",
  "fx_official": "A3500",
  "computation_timestamp": "2025-10-26T18:07:00Z"
}
```

### Auditoría y Logging

- **Logs estructurados**: JSON con información detallada
- **Eventos de métricas**: Inicio, finalización, errores, omisiones
- **Trazabilidad completa**: Desde inputs hasta outputs
- **Métricas de rendimiento**: Tiempo de cálculo, memoria utilizada

---

## 🚀 Uso del Sistema

### Comandos CLI

```bash
# Calcular métricas para hoy
NODE_ENV=production npm run metrics:today

# Recomputar ventana de 30 días
NODE_ENV=production npm run metrics:recompute

# Migrar base de datos
NODE_ENV=production npm run migrate
```

### Variables de Entorno

```bash
# Configuración AWS
NODE_ENV=production
SOURCE_DB_URL=postgres://user:pass@host:5432/ingestordb
TARGET_DB_URL=postgres://user:pass@host:5432/metricsdb
```

### API REST

```bash
# Health check
GET /api/health

# Obtener métricas
GET /api/v1/metrics/{metric_id}?from=2025-01-01&to=2025-12-31

# Resumen de métricas
GET /api/v1/metrics/summary?ids=delta.base_7d.pct,ratio.reserves_to_base
```

---

## 📈 Monitoreo y Alertas

### Métricas Clave a Monitorear

1. **Tasa de éxito de cálculos**: >95%
2. **Frescura de datos**: <24 horas
3. **Cobertura de datos**: >80%
4. **Tiempo de procesamiento**: <5 minutos
5. **Errores de conexión**: <1%

### Umbrales de Alerta

- **Datos obsoletos**: >2 horas sin actualización
- **Fallos de cálculo**: >5% de fallos
- **Problemas de calidad**: >10% de datos inválidos
- **Degradación de rendimiento**: >2x tiempo normal

---

## 🔄 Versionado y Evolución

### Política de Versionado

- **v2.0**: Implementación actual con use cases modulares
- **Cambios breaking**: Nueva versión mayor
- **Mejoras**: Nueva versión menor
- **Fixes**: Nueva versión patch

### Migración de Datos

- **Compatibilidad hacia atrás**: Mantener IDs de métricas
- **Recomputación histórica**: Opcional para nuevas fórmulas
- **Auditoría de cambios**: Log de modificaciones en metadatos

---

## 📚 Referencias Técnicas

### Dependencias del Sistema

- **Node.js**: >=20.0.0
- **PostgreSQL**: >=13.0
- **TypeScript**: >=5.0.0
- **AWS Aurora RDS**: Compatible

### Arquitectura de Archivos

```
src/
├── application/usecases/     # Lógica de cálculo por métrica
├── domain/                   # Entidades y utilidades
├── infrastructure/           # Conexiones y configuración
└── interfaces/              # CLI y API REST
```

### Patrones de Diseño

- **Use Case Pattern**: Separación de responsabilidades
- **Repository Pattern**: Abstracción de acceso a datos
- **Factory Pattern**: Creación de instancias
- **Strategy Pattern**: Diferentes algoritmos de cálculo

---

*Documentación actualizada: 2025-10-26*
*Versión del sistema: 2.0.0*
*Autor: Metrics Engine Team*
