import { Result } from '@shared/utils/Result';
import { NotFoundError, StorageError } from '@shared/errors';
import { Tag } from '../../../types';

/**
 * Repository interface for tag persistence operations
 * Following Repository pattern from Domain-Driven Design
 */
export interface ITagRepository {
    /**
     * Get all tags (system and custom)
     * @returns Result with array of tags or storage error
     */
    getAll(): Promise<Result<Tag[], StorageError>>;

    /**
     * Get tag by ID
     * @param id - Tag unique identifier
     * @returns Result with tag or not found error
     */
    getById(id: string): Promise<Result<Tag, NotFoundError>>;

    /**
     * Get all system tags
     * @returns Result with array of system tags or storage error
     */
    getSystemTags(): Promise<Result<Tag[], StorageError>>;

    /**
     * Get all custom (user-created) tags
     * @returns Result with array of custom tags or storage error
     */
    getCustomTags(): Promise<Result<Tag[], StorageError>>;

    /**
     * Get tag by name (case-insensitive)
     * @param name - Tag name
     * @returns Result with tag or not found error
     */
    getByName(name: string): Promise<Result<Tag, NotFoundError>>;

    /**
     * Create or update a tag
     * @param tag - Tag to save
     * @returns Result with saved tag or storage error
     */
    save(tag: Tag): Promise<Result<Tag, StorageError>>;

    /**
     * Delete tag by ID
     * Note: System tags cannot be deleted
     * @param id - Tag unique identifier
     * @returns Result with success boolean or storage error
     */
    delete(id: string): Promise<Result<boolean, StorageError>>;

    /**
     * Check if tag exists by name
     * @param name - Tag name
     * @returns Result with boolean indicating existence or storage error
     */
    existsByName(name: string): Promise<Result<boolean, StorageError>>;

    /**
     * Increment tag usage count
     * @param id - Tag unique identifier
     * @returns Result with updated tag or not found error
     */
    incrementUsage(id: string): Promise<Result<Tag, NotFoundError | StorageError>>;

    /**
     * Decrement tag usage count
     * @param id - Tag unique identifier
     * @returns Result with updated tag or not found error
     */
    decrementUsage(id: string): Promise<Result<Tag, NotFoundError | StorageError>>;

    /**
     * Get tags sorted by usage count (most used first)
     * @param limit - Optional limit for number of tags to return
     * @returns Result with array of tags or storage error
     */
    getMostUsed(limit?: number): Promise<Result<Tag[], StorageError>>;

    /**
     * Update tag color
     * @param id - Tag unique identifier
     * @param color - New color in hex format
     * @returns Result with updated tag or not found error
     */
    updateColor(id: string, color: string): Promise<Result<Tag, NotFoundError | StorageError>>;

    /**
     * Update tag description
     * @param id - Tag unique identifier
     * @param description - New description
     * @returns Result with updated tag or not found error
     */
    updateDescription(id: string, description: string): Promise<Result<Tag, NotFoundError | StorageError>>;

    /**
     * Get count of all tags
     * @returns Result with tag count or storage error
     */
    count(): Promise<Result<number, StorageError>>;

    /**
     * Get count of custom tags only
     * @returns Result with custom tag count or storage error
     */
    countCustomTags(): Promise<Result<number, StorageError>>;
}
