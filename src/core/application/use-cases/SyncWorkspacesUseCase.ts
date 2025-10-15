import { injectable, inject } from 'tsyringe';
import { IUseCase } from '../interfaces/IUseCase';
import { Result } from '@shared/utils/Result';
import { IWorkspaceDomainRepository } from '../adapters/WorkspaceDomainRepositoryAdapter';
import { Workspace } from '@core/domain/entities/Workspace';
import { WorkspacePath } from '@core/domain/value-objects/WorkspaceValueObjects';
import { RepositoryError, ValidationError } from '@shared/errors';
import { WorkspaceItem } from '../../../types';

/**
 * Request for syncing workspaces from VS Code history
 */
export interface SyncWorkspacesRequest {
    /**
     * Workspace items from VS Code history
     */
    vscodeWorkspaces: WorkspaceItem[];
}

/**
 * Response from syncing workspaces
 */
export interface SyncWorkspacesResponse {
    /**
     * Number of workspaces added
     */
    added: number;
    
    /**
     * Number of workspaces updated
     */
    updated: number;
    
    /**
     * Number of workspaces removed
     */
    removed: number;
    
    /**
     * Total workspaces after sync
     */
    total: number;
}

/**
 * Use case for syncing workspaces with VS Code history
 * Adds new workspaces, updates lastOpened for existing ones, and optionally removes stale ones
 */
@injectable()
export class SyncWorkspacesUseCase implements IUseCase<SyncWorkspacesRequest, Result<SyncWorkspacesResponse, RepositoryError | ValidationError>> {
    constructor(
        @inject('IWorkspaceDomainRepository') private readonly workspaceRepository: IWorkspaceDomainRepository
    ) {}

    async execute(request: SyncWorkspacesRequest): Promise<Result<SyncWorkspacesResponse, RepositoryError | ValidationError>> {
        let added = 0;
        let updated = 0;
        let removed = 0;

        // Get all existing workspaces
        const getAllResult = await this.workspaceRepository.getAll();
        if (getAllResult.isFailure) {
            return Result.fail(getAllResult.error);
        }

        const existingWorkspaces = getAllResult.value;
        const existingPaths = new Set(existingWorkspaces.map(ws => ws.path.toString()));
        const vscodePathsSet = new Set<string>();

        // Process VS Code workspaces
        for (const item of request.vscodeWorkspaces) {
            const pathResult = WorkspacePath.create(item.path);
            if (pathResult.isFailure) {
                continue; // Skip invalid paths
            }

            const path = pathResult.value;
            vscodePathsSet.add(path.toString());

            // Check if workspace exists by path
            const existsResult = await this.workspaceRepository.existsByPath(path);
            if (existsResult.isFailure) {
                continue;
            }

            if (existsResult.value) {
                // Update existing workspace's lastOpened timestamp
                const getByPathResult = await this.workspaceRepository.getByPath(path);
                if (getByPathResult.isSuccess) {
                    const existingWorkspace = getByPathResult.value;
                    existingWorkspace.updateLastOpened();
                    const saveResult = await this.workspaceRepository.save(existingWorkspace);
                    if (saveResult.isSuccess) {
                        updated++;
                    }
                }
            } else {
                // Create new workspace from item
                const workspaceResult = Workspace.fromItem(item);
                if (workspaceResult.isFailure) {
                    continue;
                }

                const saveResult = await this.workspaceRepository.save(workspaceResult.value);
                if (saveResult.isSuccess) {
                    added++;
                }
            }
        }

        // Remove workspaces that are no longer in VS Code history
        // Only remove if they are not favorites or pinned
        for (const workspace of existingWorkspaces) {
            if (!vscodePathsSet.has(workspace.path.toString())) {
                // Don't remove favorites or pinned workspaces
                if (!workspace.isFavorite && !workspace.isPinned) {
                    const deleteResult = await this.workspaceRepository.delete(workspace.id);
                    if (deleteResult.isSuccess) {
                        removed++;
                    }
                }
            }
        }

        // Get final count
        const finalCountResult = await this.workspaceRepository.count();
        const total = finalCountResult.isSuccess ? finalCountResult.value : 0;

        return Result.ok({
            added,
            updated,
            removed,
            total
        });
    }
}
