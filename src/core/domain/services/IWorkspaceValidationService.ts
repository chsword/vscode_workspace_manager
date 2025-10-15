/**
 * Workspace Validation Service Interface
 * 
 * Domain service for validating workspace business rules.
 * Encapsulates cross-entity validation logic.
 */

import { Result } from '@shared/utils/Result';
import { BaseError, ValidationError } from '@shared/errors';
import { Workspace } from '@core/domain/entities/Workspace';
import { Tag } from '@core/domain/entities/Tag';

/**
 * Workspace validation result
 */
export interface WorkspaceValidationResult {
    readonly isValid: boolean;
    readonly errors: ValidationError[];
    readonly warnings: string[];
}

/**
 * Tag validation result
 */
export interface TagValidationResult {
    readonly isValid: boolean;
    readonly errors: ValidationError[];
    readonly warnings: string[];
}

/**
 * Duplicate workspace check result
 */
export interface DuplicateCheckResult {
    readonly isDuplicate: boolean;
    readonly existingWorkspaceId?: string;
    readonly conflictType: 'path' | 'name' | 'none';
}

/**
 * Workspace conflict information
 */
export interface WorkspaceConflict {
    readonly conflictType: 'path' | 'name' | 'tags';
    readonly existingWorkspace: Workspace;
    readonly conflictingValue: string;
}

/**
 * Workspace Validation Service
 * 
 * Responsible for:
 * - Validating workspace entities against business rules
 * - Checking for duplicate workspaces (same path/name)
 * - Validating tag assignments
 * - Cross-entity validation (e.g., workspace + tags)
 * - Business rule enforcement
 */
export interface IWorkspaceValidationService {
    /**
     * Validate workspace entity against business rules
     * @param workspace - Workspace to validate
     * @returns Result with validation result
     */
    validateWorkspace(workspace: Workspace): Result<WorkspaceValidationResult, BaseError>;

    /**
     * Validate tag entity against business rules
     * @param tag - Tag to validate
     * @returns Result with validation result
     */
    validateTag(tag: Tag): Result<TagValidationResult, BaseError>;

    /**
     * Check if workspace path is duplicate
     * @param path - Workspace path to check
     * @param existingWorkspaces - List of existing workspaces
     * @param excludeId - Workspace ID to exclude from check (for updates)
     * @returns Result with duplicate check result
     */
    checkDuplicatePath(
        path: string,
        existingWorkspaces: Workspace[],
        excludeId?: string
    ): Result<DuplicateCheckResult, BaseError>;

    /**
     * Check if workspace name is duplicate
     * @param name - Workspace name to check
     * @param existingWorkspaces - List of existing workspaces
     * @param excludeId - Workspace ID to exclude from check (for updates)
     * @returns Result with duplicate check result
     */
    checkDuplicateName(
        name: string,
        existingWorkspaces: Workspace[],
        excludeId?: string
    ): Result<DuplicateCheckResult, BaseError>;

    /**
     * Validate tag assignment to workspace
     * @param workspace - Workspace to assign tags to
     * @param tags - Tags to assign
     * @returns Result with validation result
     */
    validateTagAssignment(
        workspace: Workspace,
        tags: Tag[]
    ): Result<WorkspaceValidationResult, BaseError>;

    /**
     * Check for workspace conflicts
     * @param workspace - Workspace to check
     * @param existingWorkspaces - List of existing workspaces
     * @returns Result with array of conflicts (empty if no conflicts)
     */
    findConflicts(
        workspace: Workspace,
        existingWorkspaces: Workspace[]
    ): Result<WorkspaceConflict[], BaseError>;

    /**
     * Validate workspace before creation
     * @param workspace - Workspace to create
     * @param existingWorkspaces - List of existing workspaces
     * @returns Result with validation result
     */
    validateForCreation(
        workspace: Workspace,
        existingWorkspaces: Workspace[]
    ): Result<WorkspaceValidationResult, BaseError>;

    /**
     * Validate workspace before update
     * @param workspace - Workspace to update
     * @param existingWorkspaces - List of existing workspaces
     * @returns Result with validation result
     */
    validateForUpdate(
        workspace: Workspace,
        existingWorkspaces: Workspace[]
    ): Result<WorkspaceValidationResult, BaseError>;

    /**
     * Validate workspace before deletion
     * @param workspace - Workspace to delete
     * @returns Result with validation result
     */
    validateForDeletion(
        workspace: Workspace
    ): Result<WorkspaceValidationResult, BaseError>;
}
