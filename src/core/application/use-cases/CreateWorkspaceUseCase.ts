import { injectable, inject } from 'tsyringe';
import { IUseCase } from '../interfaces/IUseCase';
import { Result } from '@shared/utils/Result';
import { IWorkspaceDomainRepository } from '../adapters/WorkspaceDomainRepositoryAdapter';
import { Workspace } from '@core/domain/entities/Workspace';
import { RepositoryError, ValidationError } from '@shared/errors';

export interface CreateWorkspaceRequest {
    name: string;
    path: string;
    type: 'folder' | 'workspace';
    location: {
        type: 'local' | 'wsl' | 'remote';
        displayName: string;
        distributionName?: string;
        host?: string;
    };
    description?: string;
    tags?: string[];
    isFavorite?: boolean;
    isPinned?: boolean;
}



/**
 * Response from creating a workspace
 */
export type CreateWorkspaceResponse = Workspace;

/**
 * Use case for creating a new workspace
 */
@injectable()
export class CreateWorkspaceUseCase implements IUseCase<CreateWorkspaceRequest, Result<CreateWorkspaceResponse, RepositoryError | ValidationError>> {
    constructor(
        @inject('IWorkspaceDomainRepository') private readonly workspaceRepository: IWorkspaceDomainRepository
    ) {}

    async execute(request: CreateWorkspaceRequest): Promise<Result<CreateWorkspaceResponse, RepositoryError | ValidationError>> {
        // Create workspace entity
        const createResult = Workspace.create(request);
        if (createResult.isFailure) {
            return Result.fail(createResult.error);
        }

        const workspace = createResult.value;

        // Check if workspace with same path already exists
        const existsResult = await this.workspaceRepository.existsByPath(workspace.path);
        if (existsResult.isFailure) {
            return Result.fail(existsResult.error);
        }

        if (existsResult.value) {
            return Result.fail(new ValidationError('Workspace with this path already exists'));
        }

        // Save to repository
        const saveResult = await this.workspaceRepository.save(workspace);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        return Result.ok(workspace);
    }
}
