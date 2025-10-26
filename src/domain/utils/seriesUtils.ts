import type { SeriesPoint } from '@/domain/entities/series.js';
import { DateService } from './dateService.js';
import { BusinessDaysService } from './businessDays.js';

/**
 * Utilidades para manipulación de series de datos
 */

export interface SeriesData {
  seriesId: string;
  points: SeriesPoint[];
}

export class SeriesUtils {
  /**
   * Convierte una serie de puntos a un Map para acceso rápido por fecha
   */
  static toMap(points: SeriesPoint[]): Map<string, number> {
    const map = new Map<string, number>();

    for (const point of points) {
      const dateStr =
        typeof point.ts === 'string'
          ? point.ts.split('T')[0]
          : DateService.formatDate(new Date(point.ts));
      map.set(dateStr as string, point.value);
    }

    return map;
  }

  /**
   * Ordena una serie por fecha (ascendente)
   */
  static sortByDate(points: SeriesPoint[]): SeriesPoint[] {
    return [...points].sort((a, b) => {
      const dateA = typeof a.ts === 'string' ? new Date(a.ts) : new Date(a.ts);
      const dateB = typeof b.ts === 'string' ? new Date(b.ts) : new Date(b.ts);
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * Filtra una serie por rango de fechas
   */
  static filterByDateRange(points: SeriesPoint[], fromDate: string, toDate: string): SeriesPoint[] {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    return points.filter(point => {
      const pointDate = typeof point.ts === 'string' ? new Date(point.ts) : new Date(point.ts);
      return pointDate >= from && pointDate <= to;
    });
  }

  /**
   * Encuentra el valor de una serie en una fecha específica
   */
  static getValueAtDate(points: SeriesPoint[], targetDate: string): number | null {
    const point = points.find(p => {
      const pointDate =
        typeof p.ts === 'string' ? p.ts.split('T')[0] : DateService.formatDate(new Date(p.ts));
      return pointDate === targetDate;
    });

    return point ? point.value : null;
  }

  /**
   * Encuentra el valor de una serie n días hábiles hacia atrás
   */
  static getValueAtBusinessDaysBack(
    points: SeriesPoint[],
    targetDate: string,
    businessDays: number
  ): number | null {
    const target = new Date(targetDate);
    const referenceDate = BusinessDaysService.subtractBusinessDays(target, businessDays);
    const referenceDateStr = DateService.formatDate(referenceDate);

    return this.getValueAtDate(points, referenceDateStr);
  }

  /**
   * Encuentra el último valor disponible en una serie
   */
  static getLastValue(points: SeriesPoint[]): SeriesPoint | null {
    if (points.length === 0) return null;

    const sorted = this.sortByDate(points);
    return sorted[sorted.length - 1] || null;
  }

  /**
   * Encuentra el primer valor disponible en una serie
   */
  static getFirstValue(points: SeriesPoint[]): SeriesPoint | null {
    if (points.length === 0) return null;

    const sorted = this.sortByDate(points);
    return sorted[0] || null;
  }

  /**
   * Calcula la cobertura de datos en una ventana de días hábiles
   */
  static calculateCoverage(points: SeriesPoint[], fromDate: string, toDate: string): number {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const totalBusinessDays = BusinessDaysService.countBusinessDaysBetween(from, to);

    if (totalBusinessDays === 0) return 0;

    const filteredPoints = this.filterByDateRange(points, fromDate, toDate);
    const businessDaysWithData = filteredPoints.filter(point => {
      const pointDate = typeof point.ts === 'string' ? new Date(point.ts) : new Date(point.ts);
      return BusinessDaysService.isBusinessDay(pointDate);
    }).length;

    return (businessDaysWithData / totalBusinessDays) * 100;
  }

  /**
   * Calcula el freshness (días hábiles desde el último dato)
   */
  static calculateFreshness(points: SeriesPoint[], referenceDate: Date = new Date()): number {
    const lastPoint = this.getLastValue(points);
    if (!lastPoint) return Infinity;

    const lastDate =
      typeof lastPoint.ts === 'string' ? new Date(lastPoint.ts) : new Date(lastPoint.ts);
    return BusinessDaysService.countBusinessDaysBetween(lastDate, referenceDate);
  }

  /**
   * Calcula gaps (días hábiles sin datos) en una ventana
   */
  static calculateGaps(points: SeriesPoint[], fromDate: string, toDate: string): number {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const totalBusinessDays = BusinessDaysService.countBusinessDaysBetween(from, to);

    if (totalBusinessDays === 0) return 0;

    const coverage = this.calculateCoverage(points, fromDate, toDate);
    return totalBusinessDays - (totalBusinessDays * coverage) / 100;
  }

  /**
   * Alinea dos series por fecha (solo fechas comunes)
   */
  static alignSeries(
    series1: SeriesPoint[],
    series2: SeriesPoint[]
  ): {
    series1: SeriesPoint[];
    series2: SeriesPoint[];
  } {
    const map1 = this.toMap(series1);
    const map2 = this.toMap(series2);

    const commonDates = Array.from(map1.keys()).filter(date => map2.has(date));

    const aligned1: SeriesPoint[] = [];
    const aligned2: SeriesPoint[] = [];

    for (const date of commonDates) {
      aligned1.push({
        series_id: series1[0]?.series_id || '',
        ts: date,
        value: map1.get(date)!,
        created_at: series1[0]?.created_at || new Date(),
        updated_at: series1[0]?.updated_at || new Date(),
      });
      aligned2.push({
        series_id: series2[0]?.series_id || '',
        ts: date,
        value: map2.get(date)!,
        created_at: series2[0]?.created_at || new Date(),
        updated_at: series2[0]?.updated_at || new Date(),
      });
    }

    return {
      series1: this.sortByDate(aligned1),
      series2: this.sortByDate(aligned2),
    };
  }

  /**
   * Alinea múltiples series por fecha
   */
  static alignMultipleSeries(seriesArray: SeriesPoint[][]): SeriesPoint[][] {
    if (seriesArray.length === 0) return [];
    if (seriesArray.length === 1) return seriesArray;

    let result = seriesArray[0]!;

    for (let i = 1; i < seriesArray.length; i++) {
      const aligned = this.alignSeries(result, seriesArray[i]!);
      result = aligned.series1;
    }

    // Re-alinear todas las series con el resultado común
    return seriesArray.map(series => {
      const aligned = this.alignSeries(result, series);
      return aligned.series2;
    });
  }

  /**
   * Valida que una serie tenga datos suficientes para un cálculo
   */
  static hasMinimumData(points: SeriesPoint[], minPoints: number): boolean {
    return points.length >= minPoints;
  }

  /**
   * Valida que una serie tenga datos en un rango de fechas
   */
  static hasDataInRange(points: SeriesPoint[], fromDate: string, toDate: string): boolean {
    const filtered = this.filterByDateRange(points, fromDate, toDate);
    return filtered.length > 0;
  }

  /**
   * Calcula retornos logarítmicos para una serie
   */
  static calculateLogReturns(series: SeriesPoint[]): { ts: string; value: number }[] {
    if (series.length < 2) {
      return [];
    }

    const sortedSeries = this.sortByDate(series);
    const logReturns: { ts: string; value: number }[] = [];

    for (let i = 1; i < sortedSeries.length; i++) {
      const pt = sortedSeries[i]!.value;
      const ptMinus1 = sortedSeries[i - 1]!.value;

      if (ptMinus1 !== 0) {
        logReturns.push({
          ts: sortedSeries[i]!.ts,
          value: Math.log(pt / ptMinus1),
        });
      }
    }
    return logReturns;
  }
}
