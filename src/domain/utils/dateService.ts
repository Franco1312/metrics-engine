export class DateService {
  static validateDateFormat(dateString: string): { isValid: boolean; error?: string } {
    const date = new Date(dateString);
    const isValid = !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);

    if (!isValid) {
      return { isValid: false, error: 'Invalid date format. Expected YYYY-MM-DD' };
    }

    return { isValid: true };
  }

  static validateDateRange(fromDate: string, toDate: string): { isValid: boolean; error?: string } {
    const fromValidation = this.validateDateFormat(fromDate);
    if (!fromValidation.isValid) {
      return { isValid: false, error: fromValidation.error ?? 'Invalid from date' };
    }

    const toValidation = this.validateDateFormat(toDate);
    if (!toValidation.isValid) {
      return { isValid: false, error: toValidation.error ?? 'Invalid to date' };
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (from > to) {
      return { isValid: false, error: 'From date cannot be after to date' };
    }

    return { isValid: true };
  }

  static getToday(): string {
    return this.formatDate(new Date());
  }

  static getDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.formatDate(date);
  }

  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0] as string;
  }

  static parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  static isFutureDate(dateString: string): boolean {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  }

  static isPastDate(dateString: string): boolean {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  static getDaysDifference(fromDate: string, toDate: string): number {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to.getTime() - from.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static subtractDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  static getYesterday(): string {
    return this.getDaysAgo(1);
  }

  static now(): number {
    return Date.now();
  }
}
