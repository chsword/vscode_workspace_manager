import { injectable, inject } from 'tsyringe';
import { Result } from '@shared/utils/Result';
import { Workspace } from '@core/domain/entities/Workspace';
import { WorkspaceId, WorkspacePath } from '@core/domain/value-objects/WorkspaceValueObjects';
import { IWorkspaceRepository as IWorkspaceItemRepository } from '@core/domain/repositories/IWorkspaceRepository';
import { RepositoryError, ValidationError, NotFoundError } from '@shared/errors';

/**
 * Domain repository interface for Workspace entities
 * This is the interface that Use Cases will depend on
 */
export interface IWorkspaceDomainRepository {
    getAll(): Promise<Result<Workspace[], RepositoryError>>;
    getById(id: WorkspaceId): Promise<Result<Workspace, RepositoryError | NotFoundError>>;
    getByPath(path: WorkspacePath): Promise<Result<Workspace, RepositoryError | NotFoundError>>;
    existsByPath(path: WorkspacePath): Promise<Result<boolean, RepositoryError>>;
    save(workspace: Workspace): Promise<Result<void, RepositoryError>>;
    delete(id: WorkspaceId): Promise<Result<void, RepositoryError>>;
    count(): Promise<Result<number, RepositoryError>>;
}

/**
 * Adapter that converts between WorkspaceItem (infrastructure) and Workspace (domain)
 */
@injectable()
export class WorkspaceDomainRepositoryAdapter implements IWorkspaceDomainRepository {
    constructor(
        @inject('IWorkspaceRepository') private readonly itemRepository: IWorkspaceItemRepository
    ) {}

    async getAll(): Promise<Result<Workspace[], RepositoryError>> {
        const result = await this.itemRepository.getAll();
        
        if (result.isFailure) {
            return Result.fail(new RepositoryError(result.error.message));
        }

        const workspaces = result.value
            .map(item => Workspace.fromItem(item))
            .filter(r => r.isSuccess)
            .map(r => r.value);

        return Result.ok(workspaces);
    }

    async getById(id: WorkspaceId): Promise<Result<Workspace, RepositoryError | NotFoundError>> {
        const result = await this.itemRepository.getById(id.toString());
        
        if (result.isFailure) {
            return Result.fail(new NotFoundError(result.error.message));
        }

        const workspaceResult = Workspace.fromItem(result.value);
        if (workspaceResult.isFailure) {
            return Result.fail(new RepositoryError('Failed to convert workspace item to entity'));
        }

        return Result.ok(workspaceResult.value);
    }

    async getByPath(path: WorkspacePath): Promise<Result<Workspace, RepositoryError | NotFoundError>> {
        const allResult = await this.getAll();
        if (allResult.isFailure) {
            return Result.fail(allResult.error);
        }

        const workspace = allResult.value.find(ws => ws.path.equals(path));
        if (!workspace) {
            return Result.fail(new NotFoundError(`Workspace not found with path: ${path.toString()}`));
        }

        return Result.ok(workspace);
    }

    async existsByPath(path: WorkspacePath): Promise<Result<boolean, RepositoryError>> {
        const result = await this.itemRepository.existsByPath(path.toString());
        
        if (result.isFailure) {
            return Result.fail(new RepositoryError(result.error.message));
        }

        return Result.ok(result.value);
    }

    async save(workspace: Workspace): Promise<Result<void, RepositoryError>> {
        const item = workspace.toItem();
        const result = await this.itemRepository.save(item);
        
        if (result.isFailure) {
            return Result.fail(new RepositoryError(result.error.message));
        }

        return Result.ok(undefined);
    }

    async delete(id: WorkspaceId): Promise<Result<void, RepositoryError>> {
        const result = await this.itemRepository.delete(id.toString());
        
        if (result.isFailure) {
            return Result.fail(new RepositoryError(result.error.message));
        }

        return Result.ok(undefined);
    }

    async count(): Promise<Result<number, RepositoryError>> {
        const result = await this.itemRepository.count();
        
        if (result.isFailure) {
            return Result.fail(new RepositoryError(result.error.message));
        }

        return Result.ok(result.value);
    }
}
