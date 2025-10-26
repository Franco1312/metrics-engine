interface SwaggerDefinition {
  openapi: string;
  info: Record<string, unknown>;
  servers: Record<string, unknown>[];
  components: Record<string, unknown>;
  paths: Record<string, unknown>;
}

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Metrics Engine API',
    version: '2.0.0',
    description: 'API for accessing computed financial metrics with dynamic definitions from database',
    contact: {
      name: 'Metrics Engine Team',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    schemas: {
      MetricPoint: {
        type: 'object',
        properties: {
          ts: {
            type: 'string',
            format: 'date',
            description: 'Date of the metric point',
            example: '2025-01-31',
          },
          value: {
            type: 'number',
            description: 'Metric value',
            example: 0.0012,
          },
        },
        required: ['ts', 'value'],
      },
      MetricPointsResponse: {
        type: 'object',
        properties: {
          metric_id: {
            type: 'string',
            description: 'Metric identifier',
            example: 'ratio.reserves_to_base',
          },
          points: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/MetricPoint',
            },
          },
          count: {
            type: 'integer',
            description: 'Number of points returned',
            example: 2,
          },
        },
        required: ['metric_id', 'points', 'count'],
      },
      MetricSummary: {
        type: 'object',
        properties: {
          metric_id: {
            type: 'string',
            description: 'Metric identifier',
            example: 'ratio.reserves_to_base',
          },
          ts: {
            type: 'string',
            format: 'date',
            description: 'Date of the latest metric point',
            example: '2025-01-31',
          },
          value: {
            type: 'number',
            description: 'Latest metric value',
            example: 0.0012,
          },
        },
        required: ['metric_id', 'ts', 'value'],
      },
      LatestMetricsResponse: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/MetricSummary',
            },
          },
          missing: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Metric IDs that were not found',
          },
          summary: {
            type: 'object',
            properties: {
              total_requested: {
                type: 'integer',
                description: 'Total number of metrics requested',
              },
              found: {
                type: 'integer',
                description: 'Number of metrics found',
              },
              missing: {
                type: 'integer',
                description: 'Number of metrics missing',
              },
              by_category: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: {
                      type: 'string',
                      example: 'deltas',
                    },
                    count: {
                      type: 'integer',
                      example: 5,
                    },
                    metrics: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          value: { type: 'number' },
                          ts: { type: 'string' },
                          unit: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        required: ['items', 'missing'],
      },
      MetricDefinition: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Metric identifier',
            example: 'delta.base_7d.abs',
          },
          name: {
            type: 'string',
            description: 'Human-readable metric name',
            example: 'Delta Base Monetaria 7d (Absoluto)',
          },
          category: {
            type: 'string',
            description: 'Metric category',
            example: 'deltas',
            enum: ['deltas', 'monetary', 'ratios', 'fx', 'data_health'],
          },
          description: {
            type: 'string',
            description: 'Detailed metric description',
            example: 'Cambio absoluto de base monetaria en 7 días hábiles',
          },
          unit: {
            type: 'string',
            description: 'Unit of measurement',
            example: 'ARS',
          },
          formula: {
            type: 'string',
            description: 'Mathematical formula used to calculate the metric',
            example: 'BASE[t] - BASE[t-7_business_days]',
          },
          dependencies: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Series IDs that this metric depends on',
            example: ['15'],
          },
        },
        required: ['id', 'name', 'category', 'description', 'unit', 'dependencies'],
      },
      MetricsListResponse: {
        type: 'object',
        properties: {
          metrics: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/MetricDefinition',
            },
          },
          count: {
            type: 'integer',
            description: 'Number of metrics returned',
            example: 21,
          },
        },
        required: ['metrics', 'count'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
            example: 'Metric not found',
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                },
                message: {
                  type: 'string',
                },
              },
            },
            description: 'Validation error details',
          },
        },
        required: ['error'],
      },
    },
  },
  paths: {
    '/api/v1/metrics': {
      get: {
        tags: ['Metrics'],
        summary: 'Get metrics definitions',
        description: 'Retrieve all available metrics definitions or a specific one by ID',
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
            description: 'Specific metric ID to retrieve (optional)',
            example: 'delta.base_7d.abs',
          },
        ],
        responses: {
          '200': {
            description: 'Metrics definitions retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MetricsListResponse',
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check if the service and databases are healthy',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'healthy',
                    },
                    timestamp: {
                      type: 'string',
                      example: '2025-01-31T10:00:00Z',
                    },
                    timezone: {
                      type: 'string',
                      example: 'America/Argentina/Buenos_Aires',
                    },
                    databases: {
                      type: 'object',
                      properties: {
                        source: {
                          type: 'boolean',
                          example: true,
                        },
                        target: {
                          type: 'boolean',
                          example: true,
                        },
                      },
                    },
                    lastMetricTs: {
                      type: 'string',
                      example: '2025-01-31',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/metrics/{metricId}': {
      get: {
        tags: ['Metrics'],
        summary: 'Get historical metric values',
        description:
          'Retrieve historical values for a specific metric with optional date filtering',
        parameters: [
          {
            name: 'metricId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Metric identifier',
            example: 'ratio.reserves_to_base',
          },
          {
            name: 'from',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'date',
            },
            description: 'Start date (YYYY-MM-DD)',
            example: '2025-01-01',
          },
          {
            name: 'to',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'date',
            },
            description: 'End date (YYYY-MM-DD)',
            example: '2025-01-31',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 5000,
              default: 500,
            },
            description: 'Maximum number of points to return',
            example: 100,
          },
        ],
        responses: {
          '200': {
            description: 'Metric points retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MetricPointsResponse',
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '404': {
            description: 'Metric not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/metrics/summary': {
      get: {
        tags: ['Metrics'],
        summary: 'Get latest values for multiple metrics',
        description: 'Retrieve the latest values for multiple metrics in a single request',
        parameters: [
          {
            name: 'ids',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Comma-separated list of metric IDs',
            example: 'ratio.reserves_to_base,delta.reserves_7d,delta.base_30d',
          },
        ],
        responses: {
          '200': {
            description: 'Latest metrics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LatestMetricsResponse',
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
  },
};

export { swaggerDefinition };
