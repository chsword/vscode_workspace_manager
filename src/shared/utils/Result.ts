/**
 * Result type for explicit error handling
 * Replaces throwing exceptions with explicit success/failure returns
 */
export class Result<T, E extends Error = Error> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E
  ) {}

  /**
   * Create a successful result
   */
  static ok<T>(value: T): Result<T, never> {
    return new Result<T, never>(true, value, undefined);
  }

  /**
   * Create a failed result
   */
  static fail<E extends Error>(error: E): Result<never, E> {
    return new Result<never, E>(false, undefined, error);
  }

  /**
   * Combine multiple results - fails if any result fails
   */
  static combine<T>(results: Result<T, Error>[]): Result<T[], Error> {
    const values: T[] = [];
    
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail(result.error);
      }
      values.push(result.value);
    }
    
    return Result.ok(values);
  }

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error('Cannot get value from failed result. Check isSuccess first.');
    }
    return this._value!;
  }

  get error(): E {
    if (this._isSuccess) {
      throw new Error('Cannot get error from successful result. Check isFailure first.');
    }
    return this._error!;
  }

  /**
   * Map the value if successful
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isFailure) {
      return Result.fail(this._error!);
    }
    return Result.ok(fn(this._value!));
  }

  /**
   * FlatMap for chaining operations that return Results
   */
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isFailure) {
      return Result.fail(this._error!);
    }
    return fn(this._value!);
  }

  /**
   * Map the error if failed
   */
  mapError<F extends Error>(fn: (error: E) => F): Result<T, F> {
    if (this.isSuccess) {
      return Result.ok(this._value!);
    }
    return Result.fail(fn(this._error!));
  }

  /**
   * Execute a function with the value if successful
   */
  onSuccess(fn: (value: T) => void): Result<T, E> {
    if (this.isSuccess) {
      fn(this._value!);
    }
    return this;
  }

  /**
   * Execute a function with the error if failed
   */
  onFailure(fn: (error: E) => void): Result<T, E> {
    if (this.isFailure) {
      fn(this._error!);
    }
    return this;
  }

  /**
   * Get value or default if failed
   */
  getOrElse(defaultValue: T): T {
    return this.isSuccess ? this._value! : defaultValue;
  }

  /**
   * Get value or compute default if failed
   */
  getOrElseGet(fn: (error: E) => T): T {
    return this.isSuccess ? this._value! : fn(this._error!);
  }
}
