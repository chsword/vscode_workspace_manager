import { injectable, inject } from 'tsyringe';
import { IUseCase } from '../interfaces/IUseCase';
import { Result } from '@shared/utils/Result';
import { IWorkspaceDomainRepository } from '../adapters/WorkspaceDomainRepositoryAdapter';
import { Workspace } from '@core/domain/entities/Workspace';
import { WorkspaceId } from '@core/domain/value-objects/WorkspaceValueObjects';
import { RepositoryError, ValidationError } from '@shared/errors';

/**
 * Request for toggling favorite status
 */
export interface ToggleFavoriteRequest {
    /**
     * Workspace ID
     */
    workspaceId: string;
}

/**
 * Response from toggling favorite status
 */
export interface ToggleFavoriteResponse {
    /**
     * Updated workspace
     */
    workspace: Workspace;
    
    /**
     * New favorite status
     */
    isFavorite: boolean;
}

/**
 * Use case for toggling workspace favorite status
 */
@injectable()
export class ToggleFavoriteUseCase implements IUseCase<ToggleFavoriteRequest, Result<ToggleFavoriteResponse, RepositoryError | ValidationError>> {
    constructor(
        @inject('IWorkspaceDomainRepository') private readonly workspaceRepository: IWorkspaceDomainRepository
    ) {}

    async execute(request: ToggleFavoriteRequest): Promise<Result<ToggleFavoriteResponse, RepositoryError | ValidationError>> {
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
        const wasFavorite = workspace.isFavorite;

        // Toggle favorite status
        if (wasFavorite) {
            workspace.unmarkAsFavorite();
        } else {
            workspace.markAsFavorite();
        }

        // Save updated workspace
        const saveResult = await this.workspaceRepository.save(workspace);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        return Result.ok({
            workspace,
            isFavorite: workspace.isFavorite
        });
    }
}
