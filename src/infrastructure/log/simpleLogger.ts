export interface Logger {
  info(params: { event: string; msg: string; data?: unknown }): void;
  error(params: { event: string; msg: string; err?: Error | string; data?: unknown }): void;
}

export class PinoLogger implements Logger {
  private readonly pino: {
    info: (data: unknown) => void;
    error: (data: unknown) => void;
  };

  constructor(pino: { info: (data: unknown) => void; error: (data: unknown) => void }) {
    this.pino = pino;
  }

  info(params: { event: string; msg: string; data?: unknown }): void {
    this.pino.info({
      event: params.event,
      msg: params.msg,
      data: params.data,
    });
  }

  error(params: { event: string; msg: string; err?: Error | string; data?: unknown }): void {
    const errorData = params.err
      ? typeof params.err === 'string'
        ? { message: params.err }
        : {
            message: params.err.message,
            stack: params.err.stack,
            name: params.err.name,
          }
      : undefined;

    this.pino.error({
      event: params.event,
      msg: params.msg,
      data: params.data,
      ...(errorData && { err: errorData }),
    });
  }
}
