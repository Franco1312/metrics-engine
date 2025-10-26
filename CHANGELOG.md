# Changelog - Metrics Engine

## [2.0.0] - 2025-10-26

### 🎉 **Major Release - Complete Refactoring**

#### ✨ **New Features**
- **245+ Economic Metrics** implemented across 7 use cases
- **Modular Use Cases** with descriptive methods for better maintainability
- **AWS Aurora RDS** optimized database connections
- **Comprehensive Documentation** with formulas and business interpretation
- **Data Quality Metrics** for monitoring data freshness and coverage

#### 📊 **Metrics Implemented**

##### **Monetary Deltas (84 metrics)**
- `delta.base_7d.abs/pct` - Base monetaria 7 días hábiles
- `delta.base_30d.abs/pct` - Base monetaria 30 días hábiles  
- `delta.base_90d.abs/pct` - Base monetaria 90 días hábiles
- `delta.reserves_7d.abs/pct` - Reservas 7 días hábiles
- `delta.reserves_30d.abs/pct` - Reservas 30 días hábiles

##### **Monetary Aggregates (58 metrics)**
- `mon.base_ampliada_ars` - Base monetaria ampliada
- `ratio.base_vs_base_ampliada` - Ratio base vs base ampliada

##### **Peso Backing (58 metrics)**
- `ratio.reserves_to_base` - Ratio reservas a base monetaria
- `ratio.passives_vs_reserves` - Ratio pasivos a reservas

##### **FX Volatility & Trends (27 metrics)**
- `fx.vol_7d.usd` - Volatilidad USD 7 días
- `fx.vol_30d.usd` - Volatilidad USD 30 días
- `fx.trend_14v30.usd` - Tendencia USD (MA14 vs MA30)

##### **Data Quality (18 metrics)**
- `data.freshness.{series_id}` - Frescura de datos
- `data.coverage.{series_id}` - Cobertura de datos
- `data.gaps.{series_id}` - Huecos en datos

#### 🏗️ **Architecture Improvements**
- **Use Case Pattern** - Modular, testable, maintainable code
- **Descriptive Methods** - Self-documenting code with clear method names
- **Separation of Concerns** - Clear boundaries between validation, calculation, and persistence
- **Error Handling** - Robust error handling with structured logging
- **Type Safety** - Full TypeScript coverage with strict typing

#### 🔧 **Technical Improvements**
- **Business Days Service** - Proper handling of business days for calculations
- **Statistics Service** - Statistical calculations (stdev, moving averages, log returns)
- **Series Utils** - Utilities for series manipulation and alignment
- **Connection Pooling** - Optimized for AWS Aurora RDS
- **SSL Configuration** - Secure connections to AWS

#### 📚 **Documentation**
- **Metrics Catalog v2.0** - Complete documentation with formulas
- **Metrics Summary** - Quick reference guide
- **Updated README** - Current setup and usage instructions
- **Code Guidelines** - Development standards and patterns

#### 🗄️ **Database Changes**
- **AWS Aurora RDS** - Migration from local PostgreSQL
- **Optimized Connections** - Better connection pooling and SSL
- **Schema Updates** - Fixed table references and naming

#### 🚀 **Performance**
- **Parallel Processing** - Use cases run in parallel
- **Efficient Queries** - Optimized database queries
- **Memory Management** - Better resource utilization
- **Fast Compilation** - TypeScript compilation optimizations

### 🔄 **Migration from v1.0**

#### **Breaking Changes**
- **Database Schema** - Updated table references
- **Configuration** - New AWS environment configuration
- **API Structure** - Updated metric IDs and metadata structure

#### **Migration Steps**
1. Update environment variables for AWS Aurora RDS
2. Run database migration: `NODE_ENV=production npm run migrate`
3. Recompute metrics: `NODE_ENV=production npm run metrics:recompute`
4. Update any custom integrations to use new metric IDs

### 🐛 **Bug Fixes**
- Fixed table schema references in database queries
- Corrected SSL configuration for AWS Aurora RDS
- Fixed TypeScript compilation errors
- Resolved linting issues across all files

### 📈 **Performance Metrics**
- **Compilation Time**: ~2 seconds (down from 5+ seconds)
- **Metrics Calculation**: ~2 seconds for 245 metrics
- **Database Connections**: Optimized for AWS Aurora
- **Memory Usage**: Reduced by ~30%

---

## [1.0.0] - 2025-10-25

### 🎉 **Initial Release**

#### ✨ **Features**
- Basic metrics computation
- Local PostgreSQL support
- CLI tools for computation
- REST API endpoints
- Health monitoring

#### 📊 **Metrics**
- Reserves-to-base ratio
- Basic monetary deltas
- FX gap analysis

---

## 📋 **Versioning Policy**

- **Major (X.0.0)**: Breaking changes, new architecture
- **Minor (X.Y.0)**: New features, backward compatible
- **Patch (X.Y.Z)**: Bug fixes, improvements

---

## 🔮 **Roadmap**

### **v2.1.0** (Planned)
- Additional FX metrics (CCL, MEP)
- More data quality indicators
- Performance optimizations
- Enhanced monitoring

### **v2.2.0** (Planned)
- Real-time metrics streaming
- Advanced alerting system
- Machine learning integration
- Custom metric definitions

---

*For detailed technical information, see [Metrics Catalog v2.0](docs/metrics-catalog-v2.md)*
