import { Result } from '../../../shared/utils/Result';
import { ValidationError } from '../../../shared/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Workspace ID value object
 * Ensures valid UUID format
 */
export class WorkspaceId {
  private constructor(private readonly value: string) {}

  static create(id: string): Result<WorkspaceId, ValidationError> {
    if (!id || id.trim().length === 0) {
      return Result.fail(
        new ValidationError('Workspace ID cannot be empty')
      );
    }

    // Simple UUID validation (can be made more strict)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      return Result.fail(
        new ValidationError('Invalid workspace ID format', { id })
      );
    }

    return Result.ok(new WorkspaceId(id));
  }

  /**
   * Generate a new unique workspace ID
   */
  static generate(): Result<WorkspaceId, ValidationError> {
    const newId = uuidv4();
    return WorkspaceId.create(newId);
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkspaceId): boolean {
    return this.value === other.value;
  }
}

/**
 * Workspace Path value object
 * Ensures valid path format
 */
export class WorkspacePath {
  private constructor(private readonly value: string) {}

  static create(path: string): Result<WorkspacePath, ValidationError> {
    if (!path || path.trim().length === 0) {
      return Result.fail(
        new ValidationError('Workspace path cannot be empty')
      );
    }

    // Normalize path (remove trailing slashes, etc.)
    const normalizedPath = path.trim().replace(/[\/\\]+$/, '');

    return Result.ok(new WorkspacePath(normalizedPath));
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkspacePath): boolean {
    // Case-insensitive comparison for Windows compatibility
    return this.value.toLowerCase() === other.value.toLowerCase();
  }

  /**
   * Get the filename from the path
   */
  getFileName(): string {
    const parts = this.value.split(/[\/\\]/);
    return parts[parts.length - 1] || '';
  }
}

/**
 * Workspace Name value object
 */
export class WorkspaceName {
  private constructor(private readonly value: string) {}

  static create(name: string): Result<WorkspaceName, ValidationError> {
    if (!name || name.trim().length === 0) {
      return Result.fail(
        new ValidationError('Workspace name cannot be empty')
      );
    }

    if (name.length > 255) {
      return Result.fail(
        new ValidationError('Workspace name too long (max 255 characters)', {
          length: name.length
        })
      );
    }

    return Result.ok(new WorkspaceName(name.trim()));
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkspaceName): boolean {
    return this.value === other.value;
  }
}
