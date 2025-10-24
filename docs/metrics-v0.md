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
- **Unidad**: Ratio (adimensional)
- **Interpretación**: Brecha entre dólar MEP y oficial como porcentaje
- **Rango esperado**: [-0.5, 5.0]

#### `fx.brecha_ccl`
- **Fórmula**: `(CCL - OFICIAL) / OFICIAL`
- **Unidad**: Ratio (adimensional)
- **Interpretación**: Brecha entre dólar CCL y oficial como porcentaje
- **Rango esperado**: [-0.5, 5.0]

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

### Métricas de Flujo

#### `flow.delta_reservas`
- **Fórmula**: `RESERVAS(ts) - RESERVAS(ts-1)`
- **Unidad**: USD
- **Interpretación**: Cambio diario en reservas internacionales

#### `flow.delta_base`
- **Fórmula**: `BASE(ts) - BASE(ts-1)`
- **Unidad**: ARS
- **Interpretación**: Cambio diario en base monetaria

#### `flow.delta_leliq`
- **Fórmula**: `LELIQ(ts) - LELIQ(ts-1)`
- **Unidad**: ARS
- **Interpretación**: Cambio diario en Leliq

#### `flow.delta_pases`
- **Fórmula**: `(PASES_PASIVOS + PASES_ACTIVOS)ts - (...)ts-1`
- **Unidad**: ARS
- **Interpretación**: Cambio diario en pases

### Métricas de Tendencia

#### `trend.ma7_reservas`, `trend.ma30_reservas`
- **Fórmula**: Media móvil de 7/30 días
- **Unidad**: USD
- **Interpretación**: Tendencia suavizada de reservas

#### `trend.ma7_base`, `trend.ma30_base`
- **Fórmula**: Media móvil de 7/30 días
- **Unidad**: ARS
- **Interpretación**: Tendencia suavizada de base monetaria

#### `trend.ma7_tc_oficial`, `trend.ma30_tc_oficial`
- **Fórmula**: Media móvil de 7/30 días
- **Unidad**: ARS/USD
- **Interpretación**: Tendencia suavizada del tipo de cambio oficial

### Métricas de Riesgo

#### `risk.vol_7d_mep`, `risk.vol_7d_ccl`
- **Fórmula**: `stddev(values_7d) / mean(values_7d)`
- **Unidad**: Ratio (adimensional)
- **Interpretación**: Volatilidad relativa de 7 días

## Política de Tipo de Cambio Oficial

### Selección por Fecha
```
OFICIAL(ts) = TC_OFICIAL_PREF en ts (preferido)
               else TC_OFICIAL_FBK en ts (fallback)
               else NULL (saltar métricas dependientes)
```

### Fuentes
1. **BCRA Cambiarias** (`bcra.usd_official_ars`) - Preferida
2. **Datos Argentina** (`168.1_T_CAMBIOR_D_0_0_26`) - Fallback

## Política de Datos Faltantes

### Reglas
- Si cualquier componente falta para un `ts`, **saltar** esa métrica para ese día
- **NO** se hace forward-fill en v0
- Para `mon.pasivos_rem_ars`: permitir suma parcial, notar componentes faltantes en `metadata.missing_components`

### Componentes Requeridos
- **Mínimo**: `RESERVAS` y `BASE` para métricas básicas
- **FX**: `TC_OFICIAL_PREF` o `TC_OFICIAL_FBK` para métricas de brecha
- **Pasivos**: `LELIQ`, `PASES_PASIVOS`, `PASES_ACTIVOS` para métricas ampliadas

## Uso del Sistema

### Comandos CLI

#### Backfill Histórico
```bash
pnpm metrics:backfill -- --from=2024-01-01 --to=2024-12-31
```
- Calcula métricas para un rango de fechas específico
- Idempotente: re-ejecutar solo actualiza si hay cambios en inputs

#### Actualización Diaria
```bash
pnpm metrics:update
```
- Recalcula últimos 30 días + hoy
- Comando para ejecución diaria automatizada

### Orden de Ejecución Diaria
1. **08:00** - Ingestor ejecuta `discover`, `backfill`, `update`
2. **08:20** - Metrics Engine ejecuta `metrics:update`
3. **08:30** - Dashboard/API consume métricas actualizadas

### Health Check
```bash
curl http://localhost:3000/health
```

**Respuesta**:
```json
{
  "status": "healthy",
  "timestamp": "2024-10-24T20:00:00Z",
  "timezone": "America/Argentina/Buenos_Aires",
  "db": true,
  "lastMetricTs": "2024-10-24"
}
```

## Configuración

### Variables de Entorno
```bash
NODE_ENV=development
APP_TIMEZONE=America/Argentina/Buenos_Aires
LOG_LEVEL=info

# Base de datos (misma que ingestor)
PGHOST=localhost
PGPORT=5432
PGDATABASE=macrodb
PGUSER=metrics_readwrite
PGPASSWORD=please-change

# Usuario read-only (opcional)
PGUSER_RO=metrics_readonly
PGPASSWORD_RO=please-change
```

### Roles de Base de Datos

#### `metrics_readonly`
- `SELECT` en `series`, `series_points`
- Para validación y debugging

#### `metrics_readwrite`
- `SELECT` en `series`, `series_points`
- `INSERT/UPDATE` en `metrics_points` únicamente
- **NO** `TRUNCATE/DELETE`

## Interpretación de Métricas

### Señales de Alerta
- **`fx.brecha_*` fuera de [-0.5, 5.0]**: Brecha anormal
- **`mon.respaldo` < 0**: Reservas insuficientes
- **`mon.respaldo_real` < 0**: Base ampliada sin respaldo
- **`flow.delta_reservas` < 0**: Pérdida de reservas
- **`risk.vol_7d_*` > 0.1**: Alta volatilidad

### Contexto Económico
- **Brechas altas**: Presión cambiaria, expectativas devaluatorias
- **Respaldo bajo**: Vulnerabilidad monetaria
- **Flujos negativos**: Contracción monetaria
- **Volatilidad alta**: Inestabilidad cambiaria

## Limitaciones v0

- **NO forward-fill**: Datos faltantes = métricas saltadas
- **NO alineación temporal**: Solo joins por fecha exacta
- **NO métricas avanzadas**: Solo cálculos básicos
- **NO UI**: Solo API/CLI (dashboard en otro servicio)

## Próximas Versiones

### v1 (Planeado)
- Forward-fill inteligente
- Alineación temporal avanzada
- Métricas de correlación
- Alertas automáticas

### v2 (Futuro)
- Machine learning para predicciones
- Métricas de riesgo avanzadas
- Integración con dashboards
- API REST completa
