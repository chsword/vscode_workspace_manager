import { injectable, inject } from 'tsyringe';
import { IUseCase } from '../interfaces/IUseCase';
import { Result } from '@shared/utils/Result';
import { IWorkspaceDomainRepository } from '../adapters/WorkspaceDomainRepositoryAdapter';
import { Workspace } from '@core/domain/entities/Workspace';
import { WorkspaceId, WorkspaceName } from '@core/domain/value-objects/WorkspaceValueObjects';
import { RepositoryError, ValidationError } from '@shared/errors';

/**
 * Request for updating a workspace
 */
export interface UpdateWorkspaceRequest {
    /**
     * Workspace ID
     */
    workspaceId: string;
    
    /**
     * New name (optional)
     */
    name?: string;
    
    /**
     * New description (optional)
     */
    description?: string;
    
    /**
     * Tags to add (optional)
     */
    tagsToAdd?: string[];
    
    /**
     * Tags to remove (optional)
     */
    tagsToRemove?: string[];
}

/**
 * Response from updating a workspace
 */
export type UpdateWorkspaceResponse = Workspace;

/**
 * Use case for updating workspace properties
 */
@injectable()
export class UpdateWorkspaceUseCase implements IUseCase<UpdateWorkspaceRequest, Result<UpdateWorkspaceResponse, RepositoryError | ValidationError>> {
    constructor(
        @inject('IWorkspaceDomainRepository') private readonly workspaceRepository: IWorkspaceDomainRepository
    ) {}

    async execute(request: UpdateWorkspaceRequest): Promise<Result<UpdateWorkspaceResponse, RepositoryError | ValidationError>> {
        // Validate workspace ID
        const idResult = WorkspaceId.create(request.workspaceId);
        if (idResult.isFailure) {
            return Result.fail(idResult.error);
        }

        // Get existing workspace
        const getResult = await this.workspaceRepository.getById(idResult.value);
        if (getResult.isFailure) {
            return Result.fail(getResult.error);
        }

        let workspace = getResult.value;

        // Update name if provided
        if (request.name !== undefined) {
            const nameResult = WorkspaceName.create(request.name);
            if (nameResult.isFailure) {
                return Result.fail(nameResult.error);
            }
            
            workspace.updateName(nameResult.value);
        }

        // Update description if provided
        if (request.description !== undefined) {
            const updateDescResult = workspace.updateDescription(request.description);
            if (updateDescResult.isFailure) {
                return Result.fail(updateDescResult.error);
            }
        }

        // Add tags
        if (request.tagsToAdd && request.tagsToAdd.length > 0) {
            for (const tagId of request.tagsToAdd) {
                const addTagResult = workspace.addTag(tagId);
                if (addTagResult.isFailure) {
                    return Result.fail(addTagResult.error);
                }
            }
        }

        // Remove tags
        if (request.tagsToRemove && request.tagsToRemove.length > 0) {
            for (const tagId of request.tagsToRemove) {
                const removeTagResult = workspace.removeTag(tagId);
                if (removeTagResult.isFailure) {
                    return Result.fail(removeTagResult.error);
                }
            }
        }

        // Save updated workspace
        const saveResult = await this.workspaceRepository.save(workspace);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        return Result.ok(workspace);
    }
}
