import { Result } from '@shared/utils/Result';
import { ValidationError } from '@shared/errors';
import { WorkspaceId, WorkspacePath, WorkspaceName } from '../value-objects/WorkspaceValueObjects';
import { WorkspaceItem, WorkspaceLocation, ProjectInfo } from '../../../types';

/**
 * Workspace Entity - Domain Model
 * Represents a workspace with business logic and validation rules
 */
export class Workspace {
    private constructor(
        private readonly _id: WorkspaceId,
        private _name: WorkspaceName,
        private _path: WorkspacePath,
        private _type: 'workspace' | 'folder',
        private _location: WorkspaceLocation,
        private _lastOpened: Date,
        private _isFavorite: boolean,
        private _isPinned: boolean,
        private _description?: string,
        private _tags: string[] = [],
        private _projectInfo?: ProjectInfo
    ) {}

    /**
     * Create a new Workspace from primitive values
     */
    static create(props: {
        id?: string;
        name: string;
        path: string;
        type: 'workspace' | 'folder';
        location: WorkspaceLocation;
        lastOpened?: Date;
        isFavorite?: boolean;
        isPinned?: boolean;
        description?: string;
        tags?: string[];
        projectInfo?: ProjectInfo;
    }): Result<Workspace, ValidationError> {
        // Generate or validate ID
        const idResult = props.id 
            ? WorkspaceId.create(props.id)
            : WorkspaceId.generate();
        
        if (idResult.isFailure) {
            return Result.fail(new ValidationError(
                'Invalid workspace ID',
                { id: props.id, error: idResult.error.message }
            ));
        }

        // Validate name
        const nameResult = WorkspaceName.create(props.name);
        if (nameResult.isFailure) {
            return Result.fail(new ValidationError(
                'Invalid workspace name',
                { name: props.name, error: nameResult.error.message }
            ));
        }

        // Validate path
        const pathResult = WorkspacePath.create(props.path);
        if (pathResult.isFailure) {
            return Result.fail(new ValidationError(
                'Invalid workspace path',
                { path: props.path, error: pathResult.error.message }
            ));
        }

        // Create workspace
        const workspace = new Workspace(
            idResult.value,
            nameResult.value,
            pathResult.value,
            props.type,
            props.location,
            props.lastOpened || new Date(),
            props.isFavorite || false,
            props.isPinned || false,
            props.description,
            props.tags || [],
            props.projectInfo
        );

        return Result.ok(workspace);
    }

    /**
     * Create Workspace from existing WorkspaceItem (for migration)
     */
    static fromItem(item: WorkspaceItem): Result<Workspace, ValidationError> {
        return Workspace.create({
            id: item.id,
            name: item.name,
            path: item.path,
            type: item.type,
            location: item.location,
            lastOpened: item.lastOpened,
            isFavorite: item.isFavorite,
            isPinned: item.isPinned,
            description: item.description,
            tags: item.tags,
            projectInfo: item.projectInfo
        });
    }

    /**
     * Convert to WorkspaceItem (for persistence)
     */
    toItem(): WorkspaceItem {
        return {
            id: this._id.toString(),
            name: this._name.toString(),
            path: this._path.toString(),
            type: this._type,
            location: this._location,
            lastOpened: this._lastOpened,
            isFavorite: this._isFavorite,
            isPinned: this._isPinned,
            description: this._description,
            tags: [...this._tags],
            projectInfo: this._projectInfo
        };
    }

    // Getters
    get id(): WorkspaceId {
        return this._id;
    }

    get name(): WorkspaceName {
        return this._name;
    }

    get path(): WorkspacePath {
        return this._path;
    }

    get type(): 'workspace' | 'folder' {
        return this._type;
    }

    get location(): WorkspaceLocation {
        return this._location;
    }

    get lastOpened(): Date {
        return this._lastOpened;
    }

    get isFavorite(): boolean {
        return this._isFavorite;
    }

    get isPinned(): boolean {
        return this._isPinned;
    }

    get description(): string | undefined {
        return this._description;
    }

    get tags(): readonly string[] {
        return this._tags;
    }

    get projectInfo(): ProjectInfo | undefined {
        return this._projectInfo;
    }

    // Business logic methods

    /**
     * Update workspace name
     */
    updateName(name: WorkspaceName): void {
        this._name = name;
    }

    /**
     * Mark workspace as favorite
     */
    markAsFavorite(): void {
        this._isFavorite = true;
    }

    /**
     * Remove favorite mark
     */
    unmarkAsFavorite(): void {
        this._isFavorite = false;
    }

    /**
     * Toggle favorite status
     */
    toggleFavorite(): void {
        this._isFavorite = !this._isFavorite;
    }

    /**
     * Pin workspace
     */
    pin(): void {
        this._isPinned = true;
    }

    /**
     * Unpin workspace
     */
    unpin(): void {
        this._isPinned = false;
    }

    /**
     * Toggle pin status
     */
    togglePin(): void {
        this._isPinned = !this._isPinned;
    }

    /**
     * Update last opened timestamp
     */
    updateLastOpened(): void {
        this._lastOpened = new Date();
    }

    /**
     * Update description
     */
    updateDescription(description: string): Result<void, ValidationError> {
        if (description && description.length > 500) {
            return Result.fail(new ValidationError(
                'Description too long',
                { maxLength: 500, actualLength: description.length }
            ));
        }
        this._description = description;
        return Result.ok(undefined);
    }

    /**
     * Add tag
     */
    addTag(tagId: string): Result<void, ValidationError> {
        if (this._tags.includes(tagId)) {
            return Result.fail(new ValidationError(
                'Tag already exists',
                { tagId }
            ));
        }
        this._tags.push(tagId);
        return Result.ok(undefined);
    }

    /**
     * Remove tag
     */
    removeTag(tagId: string): Result<void, ValidationError> {
        const index = this._tags.indexOf(tagId);
        if (index === -1) {
            return Result.fail(new ValidationError(
                'Tag not found',
                { tagId }
            ));
        }
        this._tags.splice(index, 1);
        return Result.ok(undefined);
    }

    /**
     * Replace all tags
     */
    updateTags(tags: string[]): void {
        this._tags = [...tags];
    }

    /**
     * Check if workspace has a specific tag
     */
    hasTag(tagId: string): boolean {
        return this._tags.includes(tagId);
    }

    /**
     * Check if workspace matches search text
     */
    matchesSearch(searchText: string): boolean {
        const lowerSearch = searchText.toLowerCase();
        return (
            this._name.toString().toLowerCase().includes(lowerSearch) ||
            this._path.toString().toLowerCase().includes(lowerSearch) ||
            this._description?.toLowerCase().includes(lowerSearch) ||
            false
        );
    }

    /**
     * Check if workspace matches location type
     */
    isLocationType(locationType: string): boolean {
        return this._location.type === locationType;
    }

    /**
     * Update project information
     */
    updateProjectInfo(projectInfo: ProjectInfo): void {
        this._projectInfo = projectInfo;
    }

    /**
     * Check if workspace is local
     */
    isLocal(): boolean {
        return this._location.type === 'local';
    }

    /**
     * Check if workspace is in WSL
     */
    isWSL(): boolean {
        return this._location.type === 'wsl';
    }

    /**
     * Check if workspace is remote
     */
    isRemote(): boolean {
        return this._location.type === 'remote';
    }

    /**
     * Get display name for location
     */
    getLocationDisplayName(): string {
        return this._location.displayName;
    }

    /**
     * Clone workspace with new ID (for duplication)
     */
    clone(): Result<Workspace, ValidationError> {
        return Workspace.create({
            name: this._name.toString(),
            path: this._path.toString(),
            type: this._type,
            location: this._location,
            lastOpened: new Date(),
            isFavorite: false,
            isPinned: false,
            description: this._description,
            tags: [...this._tags],
            projectInfo: this._projectInfo
        });
    }

    /**
     * Equality check based on ID
     */
    equals(other: Workspace): boolean {
        return this._id.equals(other._id);
    }

    /**
     * Equality check based on path
     */
    hasSamePath(other: Workspace): boolean {
        return this._path.equals(other._path);
    }
}
