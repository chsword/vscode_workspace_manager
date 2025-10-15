import { injectable, inject } from 'tsyringe';
import { IUseCase } from '../interfaces/IUseCase';
import { Result } from '@shared/utils/Result';
import { IWorkspaceDomainRepository } from '../adapters/WorkspaceDomainRepositoryAdapter';
import { Workspace } from '@core/domain/entities/Workspace';
import { WorkspaceId } from '@core/domain/value-objects/WorkspaceValueObjects';
import { RepositoryError, ValidationError } from '@shared/errors';

/**
 * Request for toggling pin status
 */
export interface TogglePinRequest {
    /**
     * Workspace ID
     */
    workspaceId: string;
}

/**
 * Response from toggling pin status
 */
export interface TogglePinResponse {
    /**
     * Updated workspace
     */
    workspace: Workspace;
    
    /**
     * New pin status
     */
    isPinned: boolean;
}

/**
 * Use case for toggling workspace pin status
 */
@injectable()
export class TogglePinUseCase implements IUseCase<TogglePinRequest, Result<TogglePinResponse, RepositoryError | ValidationError>> {
    constructor(
        @inject('IWorkspaceDomainRepository') private readonly workspaceRepository: IWorkspaceDomainRepository
    ) {}

    async execute(request: TogglePinRequest): Promise<Result<TogglePinResponse, RepositoryError | ValidationError>> {
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
        const wasPinned = workspace.isPinned;

        // Toggle pin status
        if (wasPinned) {
            workspace.unpin();
        } else {
            workspace.pin();
        }

        // Save updated workspace
        const saveResult = await this.workspaceRepository.save(workspace);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        return Result.ok({
            workspace,
            isPinned: workspace.isPinned
        });
    }
}
