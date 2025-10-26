/**
 * Utilidades para cálculos estadísticos
 */

export class StatisticsService {
  /**
   * Calcula la media aritmética de un array de números
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Calcula la desviación estándar de un array de números
   */
  static standardDeviation(values: number[]): number {
    if (values.length <= 1) return 0;

    const mean = this.mean(values);
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = this.mean(squaredDiffs);

    return Math.sqrt(variance);
  }

  /**
   * Calcula la desviación estándar de una muestra (n-1)
   */
  static sampleStandardDeviation(values: number[]): number {
    if (values.length <= 1) return 0;

    const mean = this.mean(values);
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / (values.length - 1);

    return Math.sqrt(variance);
  }

  /**
   * Alias para standardDeviation para compatibilidad
   */
  static stdev(values: number[]): number {
    return this.standardDeviation(values);
  }

  /**
   * Calcula la media móvil simple para una ventana de k períodos
   */
  static simpleMovingAverage(values: number[], window: number): number[] {
    if (values.length < window) return [];

    const result: number[] = [];

    for (let i = window - 1; i < values.length; i++) {
      const windowValues = values.slice(i - window + 1, i + 1);
      result.push(this.mean(windowValues));
    }

    return result;
  }

  /**
   * Calcula retornos logarítmicos: ln(P(t) / P(t-1))
   */
  static logReturns(prices: number[]): number[] {
    if (prices.length < 2) return [];

    const returns: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const current = prices[i];
      const previous = prices[i - 1];
      if (current !== undefined && previous !== undefined && current > 0 && previous > 0) {
        returns.push(Math.log(current / previous));
      }
    }

    return returns;
  }

  /**
   * Calcula retornos simples: (P(t) - P(t-1)) / P(t-1)
   */
  static simpleReturns(prices: number[]): number[] {
    if (prices.length < 2) return [];

    const returns: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const current = prices[i];
      const previous = prices[i - 1];
      if (current !== undefined && previous !== undefined && previous !== 0) {
        returns.push((current - previous) / previous);
      }
    }

    return returns;
  }

  /**
   * Calcula la volatilidad (desviación estándar de retornos) en una ventana móvil
   */
  static rollingVolatility(
    prices: number[],
    window: number,
    useLogReturns: boolean = true
  ): number[] {
    if (prices.length < window + 1) return [];

    const returns = useLogReturns ? this.logReturns(prices) : this.simpleReturns(prices);
    const result: number[] = [];

    for (let i = window - 1; i < returns.length; i++) {
      const windowReturns = returns.slice(i - window + 1, i + 1);
      result.push(this.standardDeviation(windowReturns));
    }

    return result;
  }

  /**
   * Normaliza una serie a 1 en un punto de referencia
   */
  static normalizeToReference(values: number[], referenceIndex: number): number[] {
    if (referenceIndex < 0 || referenceIndex >= values.length) {
      return values;
    }

    const referenceValue = values[referenceIndex];
    if (referenceValue === undefined || referenceValue === 0) {
      return values;
    }

    return values.map(value => value / referenceValue);
  }

  /**
   * Calcula la diferencia entre dos medias móviles
   */
  static movingAverageDifference(
    values: number[],
    shortWindow: number,
    longWindow: number
  ): number[] {
    if (values.length < longWindow) return [];

    const shortMA = this.simpleMovingAverage(values, shortWindow);
    const longMA = this.simpleMovingAverage(values, longWindow);

    const result: number[] = [];
    const minLength = Math.min(shortMA.length, longMA.length);

    for (let i = 0; i < minLength; i++) {
      const shortValue = shortMA[i];
      const longValue = longMA[i];
      if (shortValue !== undefined && longValue !== undefined) {
        result.push(shortValue - longValue);
      }
    }

    return result;
  }

  /**
   * Encuentra el índice de un valor en un array ordenado
   */
  static findIndexInSortedArray(sortedArray: number[], value: number): number {
    for (let i = 0; i < sortedArray.length; i++) {
      const arrayValue = sortedArray[i];
      if (arrayValue !== undefined && arrayValue >= value) {
        return i;
      }
    }
    return sortedArray.length;
  }

  /**
   * Calcula percentiles de un array de números
   */
  static percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);

    if (Number.isInteger(index)) {
      const value = sorted[index];
      return value !== undefined ? value : 0;
    }

    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    const lowerValue = sorted[lower];
    const upperValue = sorted[upper];

    if (lowerValue === undefined || upperValue === undefined) {
      return 0;
    }

    return lowerValue * (1 - weight) + upperValue * weight;
  }
}
