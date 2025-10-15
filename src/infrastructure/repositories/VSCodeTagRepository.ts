import { injectable, inject } from 'tsyringe';
import { ITagRepository } from '@core/domain/repositories/ITagRepository';
import { Result } from '@shared/utils/Result';
import { NotFoundError, StorageError } from '@shared/errors';
import { Tag } from '../../types';
import { WorkspaceStorage } from '../../storage/workspaceStorage';
import { ILogger } from '../logging/ILogger';

/**
 * VS Code implementation of ITagRepository
 * Adapts the existing WorkspaceStorage to the repository interface
 */
@injectable()
export class VSCodeTagRepository implements ITagRepository {
    constructor(
        @inject('WorkspaceStorage') private readonly storage: WorkspaceStorage,
        @inject('ILogger') private readonly logger: ILogger
    ) {
        this.logger.debug('VSCodeTagRepository initialized');
    }

    async getAll(): Promise<Result<Tag[], StorageError>> {
        try {
            const tags = await this.storage.getTags();
            this.logger.debug(`Retrieved ${tags.length} tags`);
            return Result.ok(tags);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to retrieve tags',
                { operation: 'getAll', error }
            );
            this.logger.error('Failed to get all tags', { error });
            return Result.fail(storageError);
        }
    }

    async getById(id: string): Promise<Result<Tag, NotFoundError>> {
        try {
            const tag = await this.storage.getTag(id);
            
            if (!tag) {
                const notFoundError = new NotFoundError(
                    `Tag with ID '${id}' not found`,
                    { id }
                );
                this.logger.warn(`Tag not found: ${id}`);
                return Result.fail(notFoundError);
            }

            this.logger.debug(`Retrieved tag: ${id}`);
            return Result.ok(tag);
        } catch (error) {
            const notFoundError = new NotFoundError(
                `Failed to retrieve tag with ID '${id}'`,
                { id, error }
            );
            this.logger.error('Failed to get tag by ID', { id, error });
            return Result.fail(notFoundError);
        }
    }

    async getSystemTags(): Promise<Result<Tag[], StorageError>> {
        try {
            const tags = await this.storage.getTags();
            const systemTags = tags.filter((tag: Tag) => tag.isSystem);
            
            this.logger.debug(`Retrieved ${systemTags.length} system tags`);
            return Result.ok(systemTags);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to retrieve system tags',
                { operation: 'getSystemTags', error }
            );
            this.logger.error('Failed to get system tags', { error });
            return Result.fail(storageError);
        }
    }

    async getCustomTags(): Promise<Result<Tag[], StorageError>> {
        try {
            const tags = await this.storage.getTags();
            const customTags = tags.filter((tag: Tag) => !tag.isSystem);
            
            this.logger.debug(`Retrieved ${customTags.length} custom tags`);
            return Result.ok(customTags);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to retrieve custom tags',
                { operation: 'getCustomTags', error }
            );
            this.logger.error('Failed to get custom tags', { error });
            return Result.fail(storageError);
        }
    }

    async getByName(name: string): Promise<Result<Tag, NotFoundError>> {
        try {
            const tags = await this.storage.getTags();
            const tag = tags.find((t: Tag) => t.name.toLowerCase() === name.toLowerCase());
            
            if (!tag) {
                const notFoundError = new NotFoundError(
                    `Tag with name '${name}' not found`,
                    { name }
                );
                this.logger.warn(`Tag not found by name: ${name}`);
                return Result.fail(notFoundError);
            }

            this.logger.debug(`Retrieved tag by name: ${name}`);
            return Result.ok(tag);
        } catch (error) {
            const notFoundError = new NotFoundError(
                `Failed to retrieve tag with name '${name}'`,
                { name, error }
            );
            this.logger.error('Failed to get tag by name', { name, error });
            return Result.fail(notFoundError);
        }
    }

    async save(tag: Tag): Promise<Result<Tag, StorageError>> {
        try {
            await this.storage.saveTag(tag);
            this.logger.info(`Saved tag: ${tag.id}`, { name: tag.name });
            return Result.ok(tag);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to save tag '${tag.name}'`,
                { operation: 'save', tagId: tag.id, error }
            );
            this.logger.error('Failed to save tag', { tagId: tag.id, error });
            return Result.fail(storageError);
        }
    }

    async delete(id: string): Promise<Result<boolean, StorageError>> {
        try {
            // Check if tag is a system tag
            const tagResult = await this.getById(id);
            if (tagResult.isSuccess && tagResult.value.isSystem) {
                const storageError = new StorageError(
                    'Cannot delete system tag',
                    { operation: 'delete', tagId: id, reason: 'System tags cannot be deleted' }
                );
                this.logger.warn(`Attempt to delete system tag: ${id}`);
                return Result.fail(storageError);
            }

            await this.storage.removeTag(id);
            this.logger.info(`Deleted tag: ${id}`);
            return Result.ok(true);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to delete tag '${id}'`,
                { operation: 'delete', tagId: id, error }
            );
            this.logger.error('Failed to delete tag', { tagId: id, error });
            return Result.fail(storageError);
        }
    }

    async existsByName(name: string): Promise<Result<boolean, StorageError>> {
        try {
            const tags = await this.storage.getTags();
            const exists = tags.some((tag: Tag) => tag.name.toLowerCase() === name.toLowerCase());
            
            this.logger.debug(`Tag exists check for name: ${name} = ${exists}`);
            return Result.ok(exists);
        } catch (error) {
            const storageError = new StorageError(
                `Failed to check tag existence for name '${name}'`,
                { operation: 'existsByName', name, error }
            );
            this.logger.error('Failed to check tag existence', { name, error });
            return Result.fail(storageError);
        }
    }

    async incrementUsage(id: string): Promise<Result<Tag, NotFoundError | StorageError>> {
        const tagResult = await this.getById(id);
        
        if (tagResult.isFailure) {
            return Result.fail(tagResult.error);
        }

        const tag = tagResult.value;
        tag.usageCount++;

        const saveResult = await this.save(tag);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        this.logger.debug(`Incremented usage for tag: ${id}`, { usageCount: tag.usageCount });
        return Result.ok(tag);
    }

    async decrementUsage(id: string): Promise<Result<Tag, NotFoundError | StorageError>> {
        const tagResult = await this.getById(id);
        
        if (tagResult.isFailure) {
            return Result.fail(tagResult.error);
        }

        const tag = tagResult.value;
        tag.usageCount = Math.max(0, tag.usageCount - 1);

        const saveResult = await this.save(tag);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        this.logger.debug(`Decremented usage for tag: ${id}`, { usageCount: tag.usageCount });
        return Result.ok(tag);
    }

    async getMostUsed(limit?: number): Promise<Result<Tag[], StorageError>> {
        try {
            const tags = await this.storage.getTags();
            const sorted = tags.sort((a: Tag, b: Tag) => b.usageCount - a.usageCount);
            
            const result = limit ? sorted.slice(0, limit) : sorted;
            
            this.logger.debug(`Retrieved ${result.length} most used tags`, { limit });
            return Result.ok(result);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to retrieve most used tags',
                { operation: 'getMostUsed', limit, error }
            );
            this.logger.error('Failed to get most used tags', { limit, error });
            return Result.fail(storageError);
        }
    }

    async updateColor(id: string, color: string): Promise<Result<Tag, NotFoundError | StorageError>> {
        const tagResult = await this.getById(id);
        
        if (tagResult.isFailure) {
            return Result.fail(tagResult.error);
        }

        const tag = tagResult.value;
        tag.color = color;

        const saveResult = await this.save(tag);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        this.logger.info(`Updated color for tag: ${id}`, { color });
        return Result.ok(tag);
    }

    async updateDescription(id: string, description: string): Promise<Result<Tag, NotFoundError | StorageError>> {
        const tagResult = await this.getById(id);
        
        if (tagResult.isFailure) {
            return Result.fail(tagResult.error);
        }

        const tag = tagResult.value;
        tag.description = description;

        const saveResult = await this.save(tag);
        if (saveResult.isFailure) {
            return Result.fail(saveResult.error);
        }

        this.logger.info(`Updated description for tag: ${id}`);
        return Result.ok(tag);
    }

    async count(): Promise<Result<number, StorageError>> {
        try {
            const tags = await this.storage.getTags();
            const count = tags.length;
            
            this.logger.debug(`Tag count: ${count}`);
            return Result.ok(count);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to count tags',
                { operation: 'count', error }
            );
            this.logger.error('Failed to count tags', { error });
            return Result.fail(storageError);
        }
    }

    async countCustomTags(): Promise<Result<number, StorageError>> {
        try {
            const tags = await this.storage.getTags();
            const count = tags.filter((tag: Tag) => !tag.isSystem).length;
            
            this.logger.debug(`Custom tag count: ${count}`);
            return Result.ok(count);
        } catch (error) {
            const storageError = new StorageError(
                'Failed to count custom tags',
                { operation: 'countCustomTags', error }
            );
            this.logger.error('Failed to count custom tags', { error });
            return Result.fail(storageError);
        }
    }
}
