/**
 * Base error class for all domain errors
 */
export abstract class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Validation error - data doesn't meet requirements
 */
export class ValidationError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

/**
 * Storage error - data persistence failed
 */
export class StorageError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', context);
  }
}

/**
 * Not found error - requested resource doesn't exist
 */
export class NotFoundError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', context);
  }
}

/**
 * Sync error - synchronization operation failed
 */
export class SyncError extends BaseError {
  constructor(
    message: string,
    public readonly partialResults?: unknown[]
  ) {
    super(message, 'SYNC_ERROR', { 
      partialResultsCount: partialResults?.length ?? 0 
    });
  }
}

/**
 * Database error - database operation failed
 */
export class DatabaseError extends BaseError {
  constructor(
    message: string,
    public readonly dbPath: string,
    cause?: Error
  ) {
    super(
      message,
      'DATABASE_ERROR',
      {
        dbPath,
        cause: cause?.message,
        stack: cause?.stack
      }
    );
  }
}

/**
 * Detection error - failed to detect workspace properties
 */
export class DetectionError extends BaseError {
  constructor(message: string, public readonly uri: string) {
    super(message, 'DETECTION_ERROR', { uri });
  }
}

/**
 * Path error - invalid or inaccessible path
 */
export class PathError extends BaseError {
  constructor(message: string, public readonly path: string) {
    super(message, 'PATH_ERROR', { path });
  }
}

/**
 * Adapter error - external service adapter failed
 */
export class AdapterError extends BaseError {
  constructor(
    message: string,
    public readonly adapter: string,
    cause?: Error
  ) {
    super(
      message,
      'ADAPTER_ERROR',
      {
        adapter,
        cause: cause?.message,
        stack: cause?.stack
      }
    );
  }
}

/**
 * Application error - general application-level error
 */
export class ApplicationError extends BaseError {
  constructor(message: string, cause?: Error) {
    super(
      message,
      'APPLICATION_ERROR',
      cause ? { cause: cause.message, stack: cause.stack } : undefined
    );
  }
}
