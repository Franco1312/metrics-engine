import { targetDb } from './targetPool.js';

export interface MetricDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  formula?: string;
  dependencies: string[];
  created_at: Date;
  updated_at: Date;
}

export class MetricsDefinitionsRepository {
  constructor() {}

  private async query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
    return await targetDb.query(text, params);
  }

  async getAllDefinitions(): Promise<MetricDefinition[]> {
    const queryText = `
      SELECT id, name, category, description, unit, formula, dependencies, created_at, updated_at
      FROM metrics_definitions
      ORDER BY category, name
    `;

    const result = await this.query(queryText);
    return result.rows.map((row: any) => ({
      ...row,
      dependencies: row.dependencies || [],
    }));
  }

  async getDefinitionsByCategory(category: string): Promise<MetricDefinition[]> {
    const queryText = `
      SELECT id, name, category, description, unit, formula, dependencies, created_at, updated_at
      FROM metrics_definitions
      WHERE category = $1
      ORDER BY name
    `;

    const result = await this.query(queryText, [category]);
    return result.rows.map((row: any) => ({
      ...row,
      dependencies: row.dependencies || [],
    }));
  }

  async searchDefinitions(searchTerm: string): Promise<MetricDefinition[]> {
    const queryText = `
      SELECT id, name, category, description, unit, formula, dependencies, created_at, updated_at
      FROM metrics_definitions
      WHERE 
        id ILIKE $1 OR 
        name ILIKE $1 OR 
        description ILIKE $1
      ORDER BY category, name
    `;

    const result = await this.query(queryText, [`%${searchTerm}%`]);
    return result.rows.map((row: any) => ({
      ...row,
      dependencies: row.dependencies || [],
    }));
  }

  async getDefinitionById(id: string): Promise<MetricDefinition | null> {
    const queryText = `
      SELECT id, name, category, description, unit, formula, dependencies, created_at, updated_at
      FROM metrics_definitions
      WHERE id = $1
    `;

    const result = await this.query(queryText, [id]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      ...row,
      dependencies: row.dependencies || [],
    };
  }

  async getCategories(): Promise<string[]> {
    const queryText = `
      SELECT DISTINCT category
      FROM metrics_definitions
      ORDER BY category
    `;

    const result = await this.query(queryText);
    return result.rows.map((row: any) => row.category);
  }
}
