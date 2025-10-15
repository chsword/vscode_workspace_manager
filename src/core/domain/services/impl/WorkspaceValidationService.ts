/**
 * Workspace Validation Service Implementation
 * 
 * Domain service for validating workspace business rules.
 * Provides centralized validation logic for workspaces and tags.
 */

import { injectable } from 'tsyringe';
import { Result } from '@shared/utils/Result';
import { BaseError, ValidationError } from '@shared/errors';
import { Workspace } from '@core/domain/entities/Workspace';
import { Tag } from '@core/domain/entities/Tag';
import {
    IWorkspaceValidationService,
    WorkspaceValidationResult,
    TagValidationResult,
    DuplicateCheckResult,
    WorkspaceConflict
} from '../IWorkspaceValidationService';

@injectable()
export class WorkspaceValidationService implements IWorkspaceValidationService {
    /**
     * Validate workspace entity against business rules
     */
    validateWorkspace(workspace: Workspace): Result<WorkspaceValidationResult, BaseError> {
        try {
            const errors: ValidationError[] = [];
            const warnings: string[] = [];

            // Validate workspace name (already validated by entity, but double-check)
            const nameStr = workspace.name.toString();
            if (!nameStr || nameStr.trim() === '') {
                errors.push(new ValidationError('Workspace name cannot be empty'));
            }

            // Validate workspace path
            const pathStr = workspace.path.toString();
            if (!pathStr || pathStr.trim() === '') {
                errors.push(new ValidationError('Workspace path cannot be empty'));
            }

            // Validate location
            const locationType = workspace.location.type;
            if (!['local', 'wsl', 'remote'].includes(locationType)) {
                errors.push(new ValidationError(`Invalid location type: ${locationType}`));
            }

            // Validate lastOpened date
            if (!(workspace.lastOpened instanceof Date) || isNaN(workspace.lastOpened.getTime())) {
                errors.push(new ValidationError('Invalid lastOpened date'));
            }

            // Warning if workspace has many tags (> 10)
            if (workspace.tags.length > 10) {
                warnings.push(`Workspace has ${workspace.tags.length} tags, consider reducing for better organization`);
            }

            // Warning if description is very long (> 200 characters)
            if (workspace.description && workspace.description.length > 200) {
                warnings.push('Description is very long (>200 chars), consider shortening');
            }

            return Result.ok({
                isValid: errors.length === 0,
                errors,
                warnings
            });

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to validate workspace: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }

    /**
     * Validate tag entity against business rules
     */
    validateTag(tag: Tag): Result<TagValidationResult, BaseError> {
        try {
            const errors: ValidationError[] = [];
            const warnings: string[] = [];

            // Validate tag name (already validated by entity, but double-check)
            if (!tag.name || tag.name.trim() === '') {
                errors.push(new ValidationError('Tag name cannot be empty'));
            }

            // Validate color format (should be hex color or named color)
            if (tag.color) {
                const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
                if (!hexColorPattern.test(tag.color)) {
                    warnings.push(`Tag color "${tag.color}" is not a valid hex color`);
                }
            }

            // Warning if usage count is negative
            if (tag.usageCount < 0) {
                errors.push(new ValidationError('Tag usage count cannot be negative'));
            }

            // Warning if tag is system tag but not marked as such
            const systemTagNames = ['Vue', 'React', 'Angular', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust'];
            if (systemTagNames.includes(tag.name) && !tag.isSystem) {
                warnings.push(`Tag "${tag.name}" looks like a system tag but is not marked as system`);
            }

            return Result.ok({
                isValid: errors.length === 0,
                errors,
                warnings
            });

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to validate tag: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }

    /**
     * Check if workspace path is duplicate
     */
    checkDuplicatePath(
        path: string,
        existingWorkspaces: Workspace[],
        excludeId?: string
    ): Result<DuplicateCheckResult, BaseError> {
        try {
            const normalizedPath = path.trim().toLowerCase();

            for (const workspace of existingWorkspaces) {
                // Skip if this is the workspace being updated
                const workspaceIdStr = workspace.id.toString();
                if (excludeId && workspaceIdStr === excludeId) {
                    continue;
                }

                const existingPath = workspace.path.toString().trim().toLowerCase();
                if (existingPath === normalizedPath) {
                    return Result.ok({
                        isDuplicate: true,
                        existingWorkspaceId: workspaceIdStr,
                        conflictType: 'path'
                    });
                }
            }

            return Result.ok({
                isDuplicate: false,
                conflictType: 'none'
            });

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to check duplicate path: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }

    /**
     * Check if workspace name is duplicate
     */
    checkDuplicateName(
        name: string,
        existingWorkspaces: Workspace[],
        excludeId?: string
    ): Result<DuplicateCheckResult, BaseError> {
        try {
            const normalizedName = name.trim().toLowerCase();

            for (const workspace of existingWorkspaces) {
                // Skip if this is the workspace being updated
                const workspaceIdStr = workspace.id.toString();
                if (excludeId && workspaceIdStr === excludeId) {
                    continue;
                }

                const existingName = workspace.name.toString().trim().toLowerCase();
                if (existingName === normalizedName) {
                    return Result.ok({
                        isDuplicate: true,
                        existingWorkspaceId: workspaceIdStr,
                        conflictType: 'name'
                    });
                }
            }

            return Result.ok({
                isDuplicate: false,
                conflictType: 'none'
            });

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to check duplicate name: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }

    /**
     * Validate tag assignment to workspace
     */
    validateTagAssignment(
        workspace: Workspace,
        tags: Tag[]
    ): Result<WorkspaceValidationResult, BaseError> {
        try {
            const errors: ValidationError[] = [];
            const warnings: string[] = [];

            // Check for duplicate tag IDs
            const tagIds = tags.map(t => t.id);
            const uniqueTagIds = new Set(tagIds);
            if (tagIds.length !== uniqueTagIds.size) {
                errors.push(new ValidationError('Duplicate tags in assignment'));
            }

            // Validate each tag
            for (const tag of tags) {
                const tagValidation = this.validateTag(tag);
                if (tagValidation.isFailure) {
                    errors.push(new ValidationError(`Invalid tag "${tag.name}"`));
                } else if (tagValidation.value.errors.length > 0) {
                    errors.push(...tagValidation.value.errors);
                }
            }

            // Warning if too many tags
            if (tags.length > 10) {
                warnings.push(`Assigning ${tags.length} tags to workspace, consider reducing to 10 or less`);
            }

            // Warning if mixing system and custom tags without clear purpose
            const systemTags = tags.filter(t => t.isSystem);
            const customTags = tags.filter(t => !t.isSystem);
            if (systemTags.length > 5) {
                warnings.push('Many system tags assigned, they are auto-detected and may be redundant');
            }
            if (customTags.length > 10) {
                warnings.push('Many custom tags assigned, consider using more specific tags');
            }

            return Result.ok({
                isValid: errors.length === 0,
                errors,
                warnings
            });

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to validate tag assignment: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }

    /**
     * Check for workspace conflicts
     */
    findConflicts(
        workspace: Workspace,
        existingWorkspaces: Workspace[]
    ): Result<WorkspaceConflict[], BaseError> {
        try {
            const conflicts: WorkspaceConflict[] = [];

            const workspaceIdStr = workspace.id.toString();
            const workspacePathStr = workspace.path.toString();
            const workspaceNameStr = workspace.name.toString();

            // Check path conflicts
            const pathCheck = this.checkDuplicatePath(
                workspacePathStr,
                existingWorkspaces,
                workspaceIdStr
            );
            if (pathCheck.isSuccess && pathCheck.value.isDuplicate) {
                const conflictingWorkspace = existingWorkspaces.find(
                    w => w.id.toString() === pathCheck.value.existingWorkspaceId
                );
                if (conflictingWorkspace) {
                    conflicts.push({
                        conflictType: 'path',
                        existingWorkspace: conflictingWorkspace,
                        conflictingValue: workspacePathStr
                    });
                }
            }

            // Check name conflicts (less critical, just a warning)
            const nameCheck = this.checkDuplicateName(
                workspaceNameStr,
                existingWorkspaces,
                workspaceIdStr
            );
            if (nameCheck.isSuccess && nameCheck.value.isDuplicate) {
                const conflictingWorkspace = existingWorkspaces.find(
                    w => w.id.toString() === nameCheck.value.existingWorkspaceId
                );
                if (conflictingWorkspace) {
                    conflicts.push({
                        conflictType: 'name',
                        existingWorkspace: conflictingWorkspace,
                        conflictingValue: workspaceNameStr
                    });
                }
            }

            return Result.ok(conflicts);

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to find conflicts: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }

    /**
     * Validate workspace before creation
     */
    validateForCreation(
        workspace: Workspace,
        existingWorkspaces: Workspace[]
    ): Result<WorkspaceValidationResult, BaseError> {
        try {
            const errors: ValidationError[] = [];
            const warnings: string[] = [];

            // Basic workspace validation
            const basicValidation = this.validateWorkspace(workspace);
            if (basicValidation.isFailure) {
                return basicValidation;
            }
            errors.push(...basicValidation.value.errors);
            warnings.push(...basicValidation.value.warnings);

            // Check for conflicts
            const conflictsResult = this.findConflicts(workspace, existingWorkspaces);
            if (conflictsResult.isFailure) {
                return Result.fail(conflictsResult.error);
            }

            const conflicts = conflictsResult.value;
            for (const conflict of conflicts) {
                if (conflict.conflictType === 'path') {
                    errors.push(
                        new ValidationError(
                            `Workspace path "${conflict.conflictingValue}" already exists`,
                            { existingWorkspaceId: conflict.existingWorkspace.id.toString() }
                        )
                    );
                } else if (conflict.conflictType === 'name') {
                    warnings.push(
                        `Workspace name "${conflict.conflictingValue}" is already used by another workspace`
                    );
                }
            }

            return Result.ok({
                isValid: errors.length === 0,
                errors,
                warnings
            });

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to validate for creation: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }

    /**
     * Validate workspace before update
     */
    validateForUpdate(
        workspace: Workspace,
        existingWorkspaces: Workspace[]
    ): Result<WorkspaceValidationResult, BaseError> {
        try {
            // Same as creation validation
            return this.validateForCreation(workspace, existingWorkspaces);

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to validate for update: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }

    /**
     * Validate workspace before deletion
     */
    validateForDeletion(
        workspace: Workspace
    ): Result<WorkspaceValidationResult, BaseError> {
        try {
            const errors: ValidationError[] = [];
            const warnings: string[] = [];

            // Warning if workspace is pinned
            if (workspace.isPinned) {
                warnings.push('Workspace is pinned, you may want to unpin before deleting');
            }

            // Warning if workspace is favorite
            if (workspace.isFavorite) {
                warnings.push('Workspace is marked as favorite');
            }

            // Warning if workspace has many tags
            if (workspace.tags.length > 5) {
                warnings.push(`Workspace has ${workspace.tags.length} tags that will be lost`);
            }

            // Always allow deletion, no blocking errors
            return Result.ok({
                isValid: true,
                errors,
                warnings
            });

        } catch (error) {
            return Result.fail(
                new ValidationError(
                    `Failed to validate for deletion: ${error instanceof Error ? error.message : String(error)}`
                )
            );
        }
    }
}
