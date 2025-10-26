# Resumen de Métricas - Metrics Engine v2.0

## 🎯 Métricas Implementadas

### 📊 **Deltas Monetarios** (84 métricas)
- **Base Monetaria**: 7d, 30d, 90d (abs + pct)
- **Reservas**: 7d, 30d (abs + pct)
- **Fórmula**: `(actual - referencia) / referencia × 100`

### 🏦 **Agregados Monetarios** (58 métricas)
- **Base Ampliada**: `BASE + LELIQ + PASES_ACTIVOS + PASES_PASIVOS`
- **Ratio Base/Ampliada**: `BASE / BASE_AMPLIADA`

### 💰 **Respaldo del Peso** (58 métricas)
- **Reservas/Base**: `RESERVAS / (BASE / USD_OFFICIAL)`
- **Pasivos/Reservas**: `PASIVOS_TOTALES / (RESERVAS × USD_OFFICIAL)`

### 📈 **Volatilidad FX** (27 métricas)
- **Volatilidad USD**: 7d, 30d (desviación estándar de retornos log)
- **Tendencia USD**: Diferencia MA14 - MA30

### 🌍 **Presión Local FX** (0 métricas - datos insuficientes)
- **Presión Local**: `USD_NORM - BASKET_NORM` (requiere 30+ puntos)

### 🔍 **Calidad de Datos** (18 métricas)
- **Freshness**: Datos <24h = 1, >24h = 0
- **Coverage**: Días con datos / 30 días
- **Gaps**: Número de huecos en serie

---

## 📋 **Total: 245 métricas calculadas**

### ✅ **Use Cases Exitosos**: 6/7
- Delta Base ✅
- Delta Reserves ✅  
- Aggregate Monetary ✅
- Reserves Backing ✅
- FX Volatility ✅
- Data Health ✅

### ⚠️ **Use Case Limitado**: 1/7
- FX Local Pressure (requiere más datos históricos)

---

## 🔧 **Características Técnicas**

### **Arquitectura Modular**
- Use cases independientes y reutilizables
- Métodos descriptivos y legibles
- Separación clara de responsabilidades

### **Robustez**
- Manejo de datos faltantes
- Validaciones post-cálculo
- Logging estructurado completo

### **Escalabilidad**
- Cálculos paralelos
- Conexiones optimizadas para AWS Aurora
- Procesamiento eficiente de grandes volúmenes

---

## 🚀 **Comandos de Uso**

```bash
# Calcular métricas para hoy
NODE_ENV=production npm run metrics:today

# Recomputar últimos 30 días
NODE_ENV=production npm run metrics:recompute

# Migrar base de datos
NODE_ENV=production npm run migrate
```

---

## 📊 **Datos de Prueba**

- **Período procesado**: 2025-09-11 a 2025-10-26
- **Puntos de datos**: 20 días hábiles
- **Base de datos**: AWS Aurora RDS
- **Tiempo de procesamiento**: ~2 segundos

---

*Última actualización: 2025-10-26*
