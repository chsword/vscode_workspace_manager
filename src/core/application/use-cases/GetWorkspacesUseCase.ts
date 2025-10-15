import { injectable, inject } from 'tsyringe';
import { IUseCase } from '../interfaces/IUseCase';
import { Result } from '@shared/utils/Result';
import { IWorkspaceDomainRepository } from '../adapters/WorkspaceDomainRepositoryAdapter';
import { Workspace } from '@core/domain/entities/Workspace';
import { RepositoryError } from '@shared/errors';

/**
 * Request for getting workspaces
 */
export interface GetWorkspacesRequest {
    /**
     * Filter by location type (optional)
     */
    locationType?: 'local' | 'wsl' | 'remote' | 'sandbox';
    
    /**
     * Filter by favorite status (optional)
     */
    isFavorite?: boolean;
    
    /**
     * Filter by tag IDs (optional)
     */
    tagIds?: string[];
    
    /**
     * Search query (optional)
     */
    searchQuery?: string;
    
    /**
     * Sort field (optional)
     */
    sortBy?: 'name' | 'lastOpened' | 'isPinned';
    
    /**
     * Sort order (optional)
     */
    sortOrder?: 'asc' | 'desc';
}

/**
 * Response from getting workspaces
 */
export interface GetWorkspacesResponse {
    /**
     * List of workspaces
     */
    workspaces: Workspace[];
    
    /**
     * Total count
     */
    total: number;
}

/**
 * Use case for getting workspaces with filters and sorting
 */
@injectable()
export class GetWorkspacesUseCase implements IUseCase<GetWorkspacesRequest, Result<GetWorkspacesResponse, RepositoryError>> {
    constructor(
        @inject('IWorkspaceDomainRepository') private readonly workspaceRepository: IWorkspaceDomainRepository
    ) {}

    async execute(request: GetWorkspacesRequest): Promise<Result<GetWorkspacesResponse, RepositoryError>> {
        // Get all workspaces
        const getAllResult = await this.workspaceRepository.getAll();
        if (getAllResult.isFailure) {
            return Result.fail(getAllResult.error);
        }

        let workspaces = getAllResult.value;

        // Apply filters
        workspaces = this.applyFilters(workspaces, request);

        // Apply search
        if (request.searchQuery) {
            workspaces = workspaces.filter(ws => ws.matchesSearch(request.searchQuery!));
        }

        // Apply sorting
        workspaces = this.applySorting(workspaces, request);

        return Result.ok({
            workspaces,
            total: workspaces.length
        });
    }

    private applyFilters(workspaces: Workspace[], request: GetWorkspacesRequest): Workspace[] {
        let filtered = workspaces;

        // Filter by location type
        if (request.locationType) {
            filtered = filtered.filter(ws => ws.location.type === request.locationType);
        }

        // Filter by favorite status
        if (request.isFavorite !== undefined) {
            filtered = filtered.filter(ws => ws.isFavorite === request.isFavorite);
        }

        // Filter by tags
        if (request.tagIds && request.tagIds.length > 0) {
            filtered = filtered.filter(ws => {
                return request.tagIds!.some(tagId => ws.tags.includes(tagId));
            });
        }

        return filtered;
    }

    private applySorting(workspaces: Workspace[], request: GetWorkspacesRequest): Workspace[] {
        if (!request.sortBy) {
            // Default: pinned first, then by last opened
            return workspaces.sort((a, b) => {
                if (a.isPinned !== b.isPinned) {
                    return a.isPinned ? -1 : 1;
                }
                return b.lastOpened.getTime() - a.lastOpened.getTime();
            });
        }

        const order = request.sortOrder === 'desc' ? -1 : 1;

        return workspaces.sort((a, b) => {
            switch (request.sortBy) {
                case 'name':
                    return a.name.toString().localeCompare(b.name.toString()) * order;
                case 'lastOpened':
                    return (a.lastOpened.getTime() - b.lastOpened.getTime()) * order;
                case 'isPinned':
                    if (a.isPinned === b.isPinned) {
                        return 0;
                    }
                    return (a.isPinned ? 1 : -1) * order;
                default:
                    return 0;
            }
        });
    }
}
