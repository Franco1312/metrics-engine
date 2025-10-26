import { DateService } from './dateService.js';

/**
 * Utilidades para manejo de días hábiles argentinos
 * Considera feriados nacionales y fines de semana
 */

// Feriados nacionales argentinos 2024-2025 (fechas fijas y móviles)
const ARGENTINE_HOLIDAYS_2024 = [
  '2024-01-01', // Año Nuevo
  '2024-03-24', // Día Nacional de la Memoria por la Verdad y la Justicia
  '2024-03-29', // Viernes Santo
  '2024-04-02', // Día del Veterano y de los Caídos en la Guerra de Malvinas
  '2024-05-01', // Día del Trabajador
  '2024-05-25', // Día de la Revolución de Mayo
  '2024-06-17', // Paso a la Inmortalidad del General Martín Miguel de Güemes
  '2024-06-20', // Paso a la Inmortalidad del General Manuel Belgrano
  '2024-07-09', // Día de la Independencia
  '2024-08-17', // Paso a la Inmortalidad del General José de San Martín
  '2024-10-12', // Día del Respeto a la Diversidad Cultural
  '2024-11-18', // Día de la Soberanía Nacional
  '2024-12-08', // Inmaculada Concepción de María
  '2024-12-25', // Navidad
];

const ARGENTINE_HOLIDAYS_2025 = [
  '2025-01-01', // Año Nuevo
  '2025-03-24', // Día Nacional de la Memoria por la Verdad y la Justicia
  '2025-04-18', // Viernes Santo
  '2025-04-21', // Día del Veterano y de los Caídos en la Guerra de Malvinas
  '2025-05-01', // Día del Trabajador
  '2025-05-25', // Día de la Revolución de Mayo
  '2025-06-16', // Paso a la Inmortalidad del General Martín Miguel de Güemes
  '2025-06-20', // Paso a la Inmortalidad del General Manuel Belgrano
  '2025-07-09', // Día de la Independencia
  '2025-08-18', // Paso a la Inmortalidad del General José de San Martín
  '2025-10-12', // Día del Respeto a la Diversidad Cultural
  '2025-11-17', // Día de la Soberanía Nacional
  '2025-12-08', // Inmaculada Concepción de María
  '2025-12-25', // Navidad
];

const ALL_HOLIDAYS = [...ARGENTINE_HOLIDAYS_2024, ...ARGENTINE_HOLIDAYS_2025];

export class BusinessDaysService {
  /**
   * Verifica si una fecha es día hábil (no es fin de semana ni feriado)
   */
  static isBusinessDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Domingo o Sábado

    if (isWeekend) return false;

    const dateStr = DateService.formatDate(date);
    return !ALL_HOLIDAYS.includes(dateStr);
  }

  /**
   * Encuentra el siguiente día hábil desde una fecha dada
   */
  static nextBusinessDay(date: Date): Date {
    let nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    while (!this.isBusinessDay(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay;
  }

  /**
   * Encuentra el día hábil anterior desde una fecha dada
   */
  static previousBusinessDay(date: Date): Date {
    let prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);

    while (!this.isBusinessDay(prevDay)) {
      prevDay.setDate(prevDay.getDate() - 1);
    }

    return prevDay;
  }

  /**
   * Encuentra la fecha n días hábiles hacia atrás
   */
  static subtractBusinessDays(date: Date, days: number): Date {
    let result = new Date(date);

    for (let i = 0; i < days; i++) {
      result = this.previousBusinessDay(result);
    }

    return result;
  }

  /**
   * Encuentra la fecha n días hábiles hacia adelante
   */
  static addBusinessDays(date: Date, days: number): Date {
    let result = new Date(date);

    for (let i = 0; i < days; i++) {
      result = this.nextBusinessDay(result);
    }

    return result;
  }

  /**
   * Cuenta los días hábiles entre dos fechas (inclusive)
   */
  static countBusinessDaysBetween(startDate: Date, endDate: Date): number {
    if (startDate > endDate) return 0;

    let count = 0;
    let current = new Date(startDate);

    while (current <= endDate) {
      if (this.isBusinessDay(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Encuentra el último día hábil en un rango de fechas
   */
  static findLastBusinessDayInRange(startDate: Date, endDate: Date): Date | null {
    let current = new Date(endDate);

    while (current >= startDate) {
      if (this.isBusinessDay(current)) {
        return current;
      }
      current.setDate(current.getDate() - 1);
    }

    return null;
  }

  /**
   * Encuentra el primer día hábil en un rango de fechas
   */
  static findFirstBusinessDayInRange(startDate: Date, endDate: Date): Date | null {
    let current = new Date(startDate);

    while (current <= endDate) {
      if (this.isBusinessDay(current)) {
        return current;
      }
      current.setDate(current.getDate() + 1);
    }

    return null;
  }
}
