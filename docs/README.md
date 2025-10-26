# 📚 Documentación - Metrics Engine v2.0

## 🎯 Documentación Principal

### 📊 **Métricas y Cálculos**
- **[Catálogo de Métricas v2.0](metrics-catalog-v2.md)** - Documentación completa de todas las métricas implementadas
- **[Resumen de Métricas](metrics-summary.md)** - Vista rápida de métricas y resultados

### 🏗️ **Arquitectura y Diseño**
- **[Overview](overview.md)** - Visión general de la plataforma y flujo de datos
- **[Data Model](data-model.md)** - Esquema completo de base de datos
- **[Architecture](architecture.md)** - Patrones arquitectónicos y diseño del sistema

### 📖 **Referencias**
- **[Glossary](glossary.md)** - Terminología del dominio y definiciones de negocio
- **[Methodology](methodology.md)** - Metodología de procesamiento de datos y estándares de calidad
- **[SQL Cookbook](sql-cookbook.md)** - Consultas SQL listas para usar

---

## 🚀 **Guías de Uso**

### **Para Desarrolladores**
1. Lee [Code Guidelines](../../CODE_GUIDELINES.md) para estándares de desarrollo
2. Revisa [Architecture](architecture.md) para entender los patrones
3. Consulta [Data Model](data-model.md) para el esquema de base de datos

### **Para Analistas de Datos**
1. Comienza con [Metrics Summary](metrics-summary.md) para una vista general
2. Profundiza en [Metrics Catalog v2.0](metrics-catalog-v2.md) para fórmulas detalladas
3. Usa [SQL Cookbook](sql-cookbook.md) para consultas de análisis

### **Para Usuarios de Negocio**
1. Lee [Overview](overview.md) para entender el contexto
2. Revisa [Metrics Summary](metrics-summary.md) para métricas clave
3. Consulta [Glossary](glossary.md) para definiciones de términos

---

## 📋 **Métricas Implementadas (Resumen)**

### **✅ Deltas Monetarios (84 métricas)**
- Base Monetaria: 7d, 30d, 90d (abs + pct)
- Reservas: 7d, 30d (abs + pct)

### **✅ Agregados Monetarios (58 métricas)**
- Base Ampliada y ratios de liquidez

### **✅ Respaldo del Peso (58 métricas)**
- Ratios de reservas vs base y pasivos

### **✅ Volatilidad FX (27 métricas)**
- Volatilidad y tendencia del USD

### **✅ Calidad de Datos (18 métricas)**
- Freshness, coverage y gaps

### **⚠️ Presión Local FX (0 métricas)**
- Requiere más datos históricos

---

## 🔧 **Comandos Útiles**

```bash
# Ver métricas calculadas
NODE_ENV=production npm run metrics:recompute

# Calcular para hoy
NODE_ENV=production npm run metrics:today

# Migrar base de datos
NODE_ENV=production npm run migrate
```

---

## 📞 **Soporte**

Para preguntas sobre:
- **Métricas**: Consulta [Metrics Catalog v2.0](metrics-catalog-v2.md)
- **Desarrollo**: Revisa [Code Guidelines](../../CODE_GUIDELINES.md)
- **Datos**: Usa [SQL Cookbook](sql-cookbook.md)

---

*Última actualización: 2025-10-26*
*Versión: 2.0.0*
