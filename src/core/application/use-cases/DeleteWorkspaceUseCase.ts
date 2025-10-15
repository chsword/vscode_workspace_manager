import { injectable, inject } from 'tsyringe';
import { IUseCase } from '../interfaces/IUseCase';
import { Result } from '@shared/utils/Result';
import { IWorkspaceDomainRepository } from '../adapters/WorkspaceDomainRepositoryAdapter';
import { WorkspaceId } from '@core/domain/value-objects/WorkspaceValueObjects';
import { RepositoryError, ValidationError, NotFoundError } from '@shared/errors';

/**
 * Request for deleting a workspace
 */
export interface DeleteWorkspaceRequest {
    /**
     * Workspace ID to delete
     */
    workspaceId: string;
}

/**
 * Response from deleting a workspace (void on success)
 */
export type DeleteWorkspaceResponse = void;

/**
 * Use case for deleting a workspace
 */
@injectable()
export class DeleteWorkspaceUseCase implements IUseCase<DeleteWorkspaceRequest, Result<DeleteWorkspaceResponse, RepositoryError | ValidationError>> {
    constructor(
        @inject('IWorkspaceDomainRepository') private readonly workspaceRepository: IWorkspaceDomainRepository
    ) {}

    async execute(request: DeleteWorkspaceRequest): Promise<Result<DeleteWorkspaceResponse, RepositoryError | ValidationError>> {
        // Validate workspace ID
        const idResult = WorkspaceId.create(request.workspaceId);
        if (idResult.isFailure) {
            return Result.fail(idResult.error);
        }

        // Try to get workspace to verify it exists
        const getResult = await this.workspaceRepository.getById(idResult.value);
        if (getResult.isFailure) {
            if (getResult.error instanceof NotFoundError) {
                return Result.fail(new ValidationError('Workspace not found'));
            }
            return Result.fail(getResult.error);
        }

        // Delete workspace
        const deleteResult = await this.workspaceRepository.delete(idResult.value);
        if (deleteResult.isFailure) {
            return Result.fail(deleteResult.error);
        }

        return Result.ok(undefined);
    }
}
