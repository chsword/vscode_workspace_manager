import { Result } from '@shared/utils/Result';
import { NotFoundError, StorageError } from '@shared/errors';
import { WorkspaceItem } from '../../../types';

/**
 * Repository interface for workspace persistence operations
 * Following Repository pattern from Domain-Driven Design
 */
export interface IWorkspaceRepository {
    /**
     * Get all workspaces
     * @returns Result with array of workspace items or storage error
     */
    getAll(): Promise<Result<WorkspaceItem[], StorageError>>;

    /**
     * Get workspace by ID
     * @param id - Workspace unique identifier
     * @returns Result with workspace item or not found error
     */
    getById(id: string): Promise<Result<WorkspaceItem, NotFoundError>>;

    /**
     * Get workspaces by tag
     * @param tagId - Tag identifier
     * @returns Result with array of workspace items or storage error
     */
    getByTag(tagId: string): Promise<Result<WorkspaceItem[], StorageError>>;

    /**
     * Get workspaces by location type
     * @param locationType - Location type (local, wsl, remote)
     * @returns Result with array of workspace items or storage error
     */
    getByLocation(locationType: string): Promise<Result<WorkspaceItem[], StorageError>>;

    /**
     * Get favorite workspaces
     * @returns Result with array of favorite workspace items or storage error
     */
    getFavorites(): Promise<Result<WorkspaceItem[], StorageError>>;

    /**
     * Get pinned workspaces
     * @returns Result with array of pinned workspace items or storage error
     */
    getPinned(): Promise<Result<WorkspaceItem[], StorageError>>;

    /**
     * Search workspaces by text
     * @param searchText - Text to search in workspace name, path, or description
     * @returns Result with array of matching workspace items or storage error
     */
    search(searchText: string): Promise<Result<WorkspaceItem[], StorageError>>;

    /**
     * Add or update workspace
     * @param workspace - Workspace item to save
     * @returns Result with saved workspace item or storage error
     */
    save(workspace: WorkspaceItem): Promise<Result<WorkspaceItem, StorageError>>;

    /**
     * Add or update multiple workspaces
     * @param workspaces - Array of workspace items to save
     * @returns Result with count of saved workspaces or storage error
     */
    saveMany(workspaces: WorkspaceItem[]): Promise<Result<number, StorageError>>;

    /**
     * Delete workspace by ID
     * @param id - Workspace unique identifier
     * @returns Result with success boolean or storage error
     */
    delete(id: string): Promise<Result<boolean, StorageError>>;

    /**
     * Delete multiple workspaces by IDs
     * @param ids - Array of workspace identifiers
     * @returns Result with count of deleted workspaces or storage error
     */
    deleteMany(ids: string[]): Promise<Result<number, StorageError>>;

    /**
     * Check if workspace exists by path
     * @param path - Workspace path
     * @returns Result with boolean indicating existence or storage error
     */
    existsByPath(path: string): Promise<Result<boolean, StorageError>>;

    /**
     * Update workspace favorite status
     * @param id - Workspace unique identifier
     * @param isFavorite - New favorite status
     * @returns Result with updated workspace or not found error
     */
    updateFavorite(id: string, isFavorite: boolean): Promise<Result<WorkspaceItem, NotFoundError | StorageError>>;

    /**
     * Update workspace pinned status
     * @param id - Workspace unique identifier
     * @param isPinned - New pinned status
     * @returns Result with updated workspace or not found error
     */
    updatePinned(id: string, isPinned: boolean): Promise<Result<WorkspaceItem, NotFoundError | StorageError>>;

    /**
     * Update workspace tags
     * @param id - Workspace unique identifier
     * @param tags - New array of tag IDs
     * @returns Result with updated workspace or not found error
     */
    updateTags(id: string, tags: string[]): Promise<Result<WorkspaceItem, NotFoundError | StorageError>>;

    /**
     * Update workspace description
     * @param id - Workspace unique identifier
     * @param description - New description
     * @returns Result with updated workspace or not found error
     */
    updateDescription(id: string, description: string): Promise<Result<WorkspaceItem, NotFoundError | StorageError>>;

    /**
     * Get count of all workspaces
     * @returns Result with workspace count or storage error
     */
    count(): Promise<Result<number, StorageError>>;

    /**
     * Clear all workspaces (use with caution)
     * @returns Result with success boolean or storage error
     */
    clear(): Promise<Result<boolean, StorageError>>;
}
