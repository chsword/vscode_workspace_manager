import { injectable, inject } from 'tsyringe';
import { IWorkspaceRepository } from '@core/domain/repositories/IWorkspaceRepository';
import { Result } from '@shared/utils/Result';
import { NotFoundError, StorageError } from '@shared/errors';
import { WorkspaceItem } from '../../types';
import { WorkspaceStorage } from '../../storage/workspaceStorage';
import { ILogger } from '../logging/ILogger';

/**
 * VS Code implementation of IWorkspaceRepository
 * Adapts the existing WorkspaceStorage to the repository interface
 */
@injectable()
export class VSCodeWorkspaceRepository implements IWorkspaceRepository {
    constructor(
        @inject('WorkspaceStorage') private readonly storage: WorkspaceStorage,
        @inject('ILogger') private readonly logger: ILogger
    ) {
        this.logger.debug('VSCodeWorkspaceRepository initialized');
    }

    async getAll(): Promise<Result<WorkspaceItem[], StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            this.logger.debug(`Retrieved ${workspaces.length} workspaces`);
            return Result.ok(workspaces);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to retrieve workspaces',
                { operation: 'getAll', error }
            );
            this.logger.error('Failed to get all workspaces', { error });
            return Result.fail(storageError);
        }
    }

    async getById(id: string): Promise<Result<WorkspaceItem, NotFoundError>> {
        try {
            const workspace = await this.storage.getWorkspace(id);
            
            if (!workspace) {
                const notFoundError = new NotFoundError(
                    `Workspace with ID '${id}' not found`,
                    { id }
                );
                this.logger.warn(`Workspace not found: ${id}`);
                return Result.fail(notFoundError);
            }

            this.logger.debug(`Retrieved workspace: ${id}`);
            return Result.ok(workspace);
        } catch (error) {
            const notFoundError = new NotFoundError(
                `Failed to retrieve workspace with ID '${id}'`,
                { id, error }
            );
            this.logger.error('Failed to get workspace by ID', { id, error });
            return Result.fail(notFoundError);
        }
    }

    async getByTag(tagId: string): Promise<Result<WorkspaceItem[], StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            const filtered = workspaces.filter(w => w.tags.includes(tagId));
            
            this.logger.debug(`Retrieved ${filtered.length} workspaces with tag: ${tagId}`);
            return Result.ok(filtered);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to retrieve workspaces by tag '${tagId}'`,
                { operation: 'getByTag', tagId, error }
            );
            this.logger.error('Failed to get workspaces by tag', { tagId, error });
            return Result.fail(storageError);
        }
    }

    async getByLocation(locationType: string): Promise<Result<WorkspaceItem[], StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            const filtered = workspaces.filter(w => w.location.type === locationType);
            
            this.logger.debug(`Retrieved ${filtered.length} workspaces with location: ${locationType}`);
            return Result.ok(filtered);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to retrieve workspaces by location '${locationType}'`,
                { operation: 'getByLocation', locationType, error }
            );
            this.logger.error('Failed to get workspaces by location', { locationType, error });
            return Result.fail(storageError);
        }
    }

    async getFavorites(): Promise<Result<WorkspaceItem[], StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            const favorites = workspaces.filter(w => w.isFavorite);
            
            this.logger.debug(`Retrieved ${favorites.length} favorite workspaces`);
            return Result.ok(favorites);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to retrieve favorite workspaces',
                { operation: 'getFavorites', error }
            );
            this.logger.error('Failed to get favorite workspaces', { error });
            return Result.fail(storageError);
        }
    }

    async getPinned(): Promise<Result<WorkspaceItem[], StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            const pinned = workspaces.filter(w => w.isPinned);
            
            this.logger.debug(`Retrieved ${pinned.length} pinned workspaces`);
            return Result.ok(pinned);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to retrieve pinned workspaces',
                { operation: 'getPinned', error }
            );
            this.logger.error('Failed to get pinned workspaces', { error });
            return Result.fail(storageError);
        }
    }

    async search(searchText: string): Promise<Result<WorkspaceItem[], StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            const lowerSearch = searchText.toLowerCase();
            
            const results = workspaces.filter(w => 
                w.name.toLowerCase().includes(lowerSearch) ||
                w.path.toLowerCase().includes(lowerSearch) ||
                w.description?.toLowerCase().includes(lowerSearch)
            );
            
            this.logger.debug(`Search found ${results.length} workspaces matching: ${searchText}`);
            return Result.ok(results);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to search workspaces for '${searchText}'`,
                { operation: 'search', searchText, error }
            );
            this.logger.error('Failed to search workspaces', { searchText, error });
            return Result.fail(storageError);
        }
    }

    async save(workspace: WorkspaceItem): Promise<Result<WorkspaceItem, StorageError>> {
        try {
            await this.storage.saveWorkspace(workspace);
            this.logger.info(`Saved workspace: ${workspace.id}`, { name: workspace.name });
            return Result.ok(workspace);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to save workspace '${workspace.name}'`,
                { operation: 'save', workspaceId: workspace.id, error }
            );
            this.logger.error('Failed to save workspace', { workspaceId: workspace.id, error });
            return Result.fail(storageError);
        }
    }

    async saveMany(workspaces: WorkspaceItem[]): Promise<Result<number, StorageError>> {
        try {
            const existingWorkspaces = await this.storage.getWorkspaces();
            const workspaceMap = new Map(existingWorkspaces.map(w => [w.id, w]));
            
            // Update or add each workspace
            for (const workspace of workspaces) {
                workspaceMap.set(workspace.id, workspace);
            }
            
            await this.storage.saveWorkspaces(Array.from(workspaceMap.values()));
            
            this.logger.info(`Saved ${workspaces.length} workspaces`);
            return Result.ok(workspaces.length);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to save ${workspaces.length} workspaces`,
                { operation: 'saveMany', count: workspaces.length, error }
            );
            this.logger.error('Failed to save multiple workspaces', { count: workspaces.length, error });
            return Result.fail(storageError);
        }
    }

    async delete(id: string): Promise<Result<boolean, StorageError>> {
        try {
            await this.storage.removeWorkspace(id);
            this.logger.info(`Deleted workspace: ${id}`);
            return Result.ok(true);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to delete workspace '${id}'`,
                { operation: 'delete', workspaceId: id, error }
            );
            this.logger.error('Failed to delete workspace', { workspaceId: id, error });
            return Result.fail(storageError);
        }
    }

    async deleteMany(ids: string[]): Promise<Result<number, StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            const idsSet = new Set(ids);
            const remaining = workspaces.filter(w => !idsSet.has(w.id));
            
            await this.storage.saveWorkspaces(remaining);
            
            const deletedCount = workspaces.length - remaining.length;
            this.logger.info(`Deleted ${deletedCount} workspaces`);
            return Result.ok(deletedCount);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to delete ${ids.length} workspaces`,
                { operation: 'deleteMany', count: ids.length, error }
            );
            this.logger.error('Failed to delete multiple workspaces', { count: ids.length, error });
            return Result.fail(storageError);
        }
    }

    async existsByPath(path: string): Promise<Result<boolean, StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            const exists = workspaces.some(w => w.path === path);
            
            this.logger.debug(`Workspace exists check for path: ${path} = ${exists}`);
            return Result.ok(exists);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to check workspace existence for path '${path}'`,
                { operation: 'existsByPath', path, error }
            );
            this.logger.error('Failed to check workspace existence', { path, error });
            return Result.fail(storageError);
        }
    }

    async updateFavorite(id: string, isFavorite: boolean): Promise<Result<WorkspaceItem, NotFoundError | StorageError>> {
        const workspaceResult = await this.getById(id);
        
        if (workspaceResult.isFailure) {
            return Result.fail(workspaceResult.error);
        }

        const workspace = workspaceResult.value;
        workspace.isFavorite = isFavorite;

        const saveResult = await this.save(workspace);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        this.logger.info(`Updated favorite status for workspace: ${id}`, { isFavorite });
        return Result.ok(workspace);
    }

    async updatePinned(id: string, isPinned: boolean): Promise<Result<WorkspaceItem, NotFoundError | StorageError>> {
        const workspaceResult = await this.getById(id);
        
        if (workspaceResult.isFailure) {
            return Result.fail(workspaceResult.error);
        }

        const workspace = workspaceResult.value;
        workspace.isPinned = isPinned;

        const saveResult = await this.save(workspace);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        this.logger.info(`Updated pinned status for workspace: ${id}`, { isPinned });
        return Result.ok(workspace);
    }

    async updateTags(id: string, tags: string[]): Promise<Result<WorkspaceItem, NotFoundError | StorageError>> {
        const workspaceResult = await this.getById(id);
        
        if (workspaceResult.isFailure) {
            return Result.fail(workspaceResult.error);
        }

        const workspace = workspaceResult.value;
        workspace.tags = tags;

        const saveResult = await this.save(workspace);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        this.logger.info(`Updated tags for workspace: ${id}`, { tagsCount: tags.length });
        return Result.ok(workspace);
    }

    async updateDescription(id: string, description: string): Promise<Result<WorkspaceItem, NotFoundError | StorageError>> {
        const workspaceResult = await this.getById(id);
        
        if (workspaceResult.isFailure) {
            return Result.fail(workspaceResult.error);
        }

        const workspace = workspaceResult.value;
        workspace.description = description;

        const saveResult = await this.save(workspace);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        this.logger.info(`Updated description for workspace: ${id}`);
        return Result.ok(workspace);
    }

    async count(): Promise<Result<number, StorageError>> {
        try {
            const workspaces = await this.storage.getWorkspaces();
            const count = workspaces.length;
            
            this.logger.debug(`Workspace count: ${count}`);
            return Result.ok(count);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to count workspaces',
                { operation: 'count', error }
            );
            this.logger.error('Failed to count workspaces', { error });
            return Result.fail(storageError);
        }
    }

    async clear(): Promise<Result<boolean, StorageError>> {
        try {
            await this.storage.saveWorkspaces([]);
            this.logger.warn('Cleared all workspaces');
            return Result.ok(true);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to clear workspaces',
                { operation: 'clear', error }
            );
            this.logger.error('Failed to clear workspaces', { error });
            return Result.fail(storageError);
        }
    }
}
