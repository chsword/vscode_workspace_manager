import { injectable, inject } from 'tsyringe';
import { IUseCase } from '../interfaces/IUseCase';
import { Result } from '@shared/utils/Result';
import { IWorkspaceDomainRepository } from '../adapters/WorkspaceDomainRepositoryAdapter';
import { Workspace } from '@core/domain/entities/Workspace';
import { WorkspaceId } from '@core/domain/value-objects/WorkspaceValueObjects';
import { RepositoryError, ValidationError } from '@shared/errors';

/**
 * Request for getting a workspace by ID
 */
export interface GetWorkspaceByIdRequest {
    /**
     * Workspace ID
     */
    workspaceId: string;
}

/**
 * Response from getting a workspace by ID
 */
export type GetWorkspaceByIdResponse = Workspace;

/**
 * Use case for getting a single workspace by ID
 */
@injectable()
export class GetWorkspaceByIdUseCase implements IUseCase<GetWorkspaceByIdRequest, Result<GetWorkspaceByIdResponse, RepositoryError | ValidationError>> {
    constructor(
        @inject('IWorkspaceDomainRepository') private readonly workspaceRepository: IWorkspaceDomainRepository
    ) {}

    async execute(request: GetWorkspaceByIdRequest): Promise<Result<GetWorkspaceByIdResponse, RepositoryError | ValidationError>> {
        // Validate workspace ID
        const idResult = WorkspaceId.create(request.workspaceId);
        if (idResult.isFailure) {
            return Result.fail(idResult.error);
        }

        // Get workspace from repository
        const getResult = await this.workspaceRepository.getById(idResult.value);
        if (getResult.isFailure) {
            return Result.fail(getResult.error);
        }

        return Result.ok(getResult.value);
    }
}
