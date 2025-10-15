import { Result } from '@shared/utils/Result';
import { ValidationError } from '@shared/errors';
import { Tag as TagItem } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tag Entity - Domain Model
 * Represents a tag with business logic and validation rules
 */
export class Tag {
    private constructor(
        private readonly _id: string,
        private _name: string,
        private _color: string,
        private readonly _isSystem: boolean,
        private _usageCount: number,
        private _description?: string
    ) {}

    /**
     * Create a new Tag from primitive values
     */
    static create(props: {
        id?: string;
        name: string;
        color: string;
        isSystem?: boolean;
        usageCount?: number;
        description?: string;
    }): Result<Tag, ValidationError> {
        // Validate name
        const nameValidation = Tag.validateName(props.name);
        if (nameValidation.isFailure) {
            return Result.fail(nameValidation.error);
        }

        // Validate color
        const colorValidation = Tag.validateColor(props.color);
        if (colorValidation.isFailure) {
            return Result.fail(colorValidation.error);
        }

        // Validate description
        if (props.description) {
            const descValidation = Tag.validateDescription(props.description);
            if (descValidation.isFailure) {
                return Result.fail(descValidation.error);
            }
        }

        const tag = new Tag(
            props.id || uuidv4(),
            props.name,
            props.color,
            props.isSystem || false,
            props.usageCount || 0,
            props.description
        );

        return Result.ok(tag);
    }

    /**
     * Create Tag from existing TagItem (for migration)
     */
    static fromItem(item: TagItem): Result<Tag, ValidationError> {
        return Tag.create({
            id: item.id,
            name: item.name,
            color: item.color,
            isSystem: item.isSystem,
            usageCount: item.usageCount,
            description: item.description
        });
    }

    /**
     * Convert to TagItem (for persistence)
     */
    toItem(): TagItem {
        return {
            id: this._id,
            name: this._name,
            color: this._color,
            isSystem: this._isSystem,
            usageCount: this._usageCount,
            description: this._description
        };
    }

    // Validation methods

    private static validateName(name: string): Result<void, ValidationError> {
        if (!name || name.trim().length === 0) {
            return Result.fail(new ValidationError('Tag name cannot be empty'));
        }

        if (name.length > 50) {
            return Result.fail(new ValidationError(
                'Tag name too long',
                { maxLength: 50, actualLength: name.length }
            ));
        }

        // Check for invalid characters
        const validNamePattern = /^[a-zA-Z0-9\s\-_.]+$/;
        if (!validNamePattern.test(name)) {
            return Result.fail(new ValidationError(
                'Tag name contains invalid characters',
                { name }
            ));
        }

        return Result.ok(undefined);
    }

    private static validateColor(color: string): Result<void, ValidationError> {
        if (!color || color.trim().length === 0) {
            return Result.fail(new ValidationError('Tag color cannot be empty'));
        }

        // Validate hex color format
        const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorPattern.test(color)) {
            return Result.fail(new ValidationError(
                'Invalid color format (expected #RRGGBB)',
                { color }
            ));
        }

        return Result.ok(undefined);
    }

    private static validateDescription(description: string): Result<void, ValidationError> {
        if (description.length > 200) {
            return Result.fail(new ValidationError(
                'Tag description too long',
                { maxLength: 200, actualLength: description.length }
            ));
        }

        return Result.ok(undefined);
    }

    // Getters

    get id(): string {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    get color(): string {
        return this._color;
    }

    get isSystem(): boolean {
        return this._isSystem;
    }

    get usageCount(): number {
        return this._usageCount;
    }

    get description(): string | undefined {
        return this._description;
    }

    // Business logic methods

    /**
     * Update tag name
     * System tags cannot be renamed
     */
    updateName(name: string): Result<void, ValidationError> {
        if (this._isSystem) {
            return Result.fail(new ValidationError(
                'Cannot rename system tag',
                { tagId: this._id, name: this._name }
            ));
        }

        const validation = Tag.validateName(name);
        if (validation.isFailure) {
            return validation;
        }

        this._name = name;
        return Result.ok(undefined);
    }

    /**
     * Update tag color
     */
    updateColor(color: string): Result<void, ValidationError> {
        const validation = Tag.validateColor(color);
        if (validation.isFailure) {
            return validation;
        }

        this._color = color;
        return Result.ok(undefined);
    }

    /**
     * Update tag description
     */
    updateDescription(description: string): Result<void, ValidationError> {
        const validation = Tag.validateDescription(description);
        if (validation.isFailure) {
            return validation;
        }

        this._description = description;
        return Result.ok(undefined);
    }

    /**
     * Increment usage count
     */
    incrementUsage(): void {
        this._usageCount++;
    }

    /**
     * Decrement usage count (minimum 0)
     */
    decrementUsage(): void {
        this._usageCount = Math.max(0, this._usageCount - 1);
    }

    /**
     * Reset usage count
     */
    resetUsage(): void {
        this._usageCount = 0;
    }

    /**
     * Set usage count to specific value
     */
    setUsageCount(count: number): Result<void, ValidationError> {
        if (count < 0) {
            return Result.fail(new ValidationError(
                'Usage count cannot be negative',
                { count }
            ));
        }

        this._usageCount = count;
        return Result.ok(undefined);
    }

    /**
     * Check if tag is deletable
     * System tags cannot be deleted
     */
    isDeletable(): boolean {
        return !this._isSystem;
    }

    /**
     * Check if tag is editable
     * System tags have limited editing capabilities
     */
    isEditable(): boolean {
        return !this._isSystem;
    }

    /**
     * Check if tag is in use
     */
    isInUse(): boolean {
        return this._usageCount > 0;
    }

    /**
     * Get tag usage level (for UI purposes)
     */
    getUsageLevel(): 'none' | 'low' | 'medium' | 'high' {
        if (this._usageCount === 0) {
            return 'none';
        }
        if (this._usageCount <= 5) {
            return 'low';
        }
        if (this._usageCount <= 20) {
            return 'medium';
        }
        return 'high';
    }

    /**
     * Equality check based on ID
     */
    equals(other: Tag): boolean {
        return this._id === other._id;
    }

    /**
     * Check if tag has the same name (case-insensitive)
     */
    hasSameName(name: string): boolean {
        return this._name.toLowerCase() === name.toLowerCase();
    }

    /**
     * Clone tag with new ID (for duplication)
     */
    clone(newName?: string): Result<Tag, ValidationError> {
        return Tag.create({
            name: newName || this._name,
            color: this._color,
            isSystem: false, // Clones are never system tags
            usageCount: 0,   // Reset usage count
            description: this._description
        });
    }
}
