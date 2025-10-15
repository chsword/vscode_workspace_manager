import * as vscode from 'vscode';
import { WorkspaceItem, WorkspaceFilter, Tag } from './types';
import { WorkspaceStorage } from './storage/workspaceStorage';
import { WorkspaceSyncService } from './services/workspaceSyncService';
import { container } from 'tsyringe';
import {
    GetWorkspacesUseCase,
    GetWorkspaceByIdUseCase,
    UpdateWorkspaceUseCase,
    DeleteWorkspaceUseCase,
    ToggleFavoriteUseCase,
    TogglePinUseCase
} from '@core/application/use-cases';
import { ILogger } from '@infrastructure/logging/ILogger';

/**
 * Main workspace manager class that coordinates all workspace operations
 * Refactored to use Use Cases for business logic
 */
export class WorkspaceManager {
    private readonly eventEmitter = new vscode.EventEmitter<WorkspaceItem[]>();
    public readonly onWorkspacesChanged = this.eventEmitter.event;

    // Use Cases (lazy-initialized from IoC container)
    private get getWorkspacesUseCase(): GetWorkspacesUseCase {
        return container.resolve('GetWorkspacesUseCase');
    }

    private get getWorkspaceByIdUseCase(): GetWorkspaceByIdUseCase {
        return container.resolve('GetWorkspaceByIdUseCase');
    }

    private get updateWorkspaceUseCase(): UpdateWorkspaceUseCase {
        return container.resolve('UpdateWorkspaceUseCase');
    }

    private get deleteWorkspaceUseCase(): DeleteWorkspaceUseCase {
        return container.resolve('DeleteWorkspaceUseCase');
    }

    private get toggleFavoriteUseCase(): ToggleFavoriteUseCase {
        return container.resolve('ToggleFavoriteUseCase');
    }

    private get togglePinUseCase(): TogglePinUseCase {
        return container.resolve('TogglePinUseCase');
    }

    private get logger(): ILogger {
        return container.resolve('ILogger');
    }

    constructor(
        private readonly storage: WorkspaceStorage,
        public readonly syncService: WorkspaceSyncService
    ) {}

    /**
     * Log workspace operation with timestamp
     */
    private logOperation(operation: string, details: any): void {
        this.logger.info(`WorkspaceManager.${operation}`, details);
    }

    /**
     * Log workspace operation error
     */
    private logError(operation: string, error: any, context?: any): void {
        this.logger.error(`WorkspaceManager.${operation} ERROR`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            ...context
        });
    }

    /**
     * Get correct WSL distribution name with proper case
     */
    private async getCorrectWSLDistribution(detectedDistro: string): Promise<string> {
        try {
            // If it's already 'default', try to detect the actual distribution
            if (detectedDistro === 'default' || detectedDistro === 'Unknown') {
                this.logOperation('getCorrectWSLDistribution.detecting', { reason: 'default_or_unknown' });

                // Try to get the default WSL distribution
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);

                try {
                    const { stdout } = await execAsync('wsl -l -q', { encoding: 'buffer' });

                    // Convert UTF-16 buffer to string (WSL outputs UTF-16)
                    const utf16String = stdout.toString('utf16le');
                    const lines = utf16String.trim().split('\n').filter((line: string) => line.trim());
                    if (lines.length > 0) {
                        // Get the first (default) distribution
                        const defaultDistro = lines[0].trim();
                        this.logOperation('getCorrectWSLDistribution.foundDefault', { defaultDistro });
                        return defaultDistro;
                    }
                } catch (execError) {
                    this.logError('getCorrectWSLDistribution.exec', execError, { command: 'wsl -l -q' });
                }
            }

            // Validate the detected distribution against available ones
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            try {
                const { stdout } = await execAsync('wsl -l -q', { encoding: 'buffer' });

                // Convert UTF-16 buffer to string (WSL outputs UTF-16)
                const utf16String = stdout.toString('utf16le');
                const availableDistros = utf16String.trim().split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0);

                this.logOperation('getCorrectWSLDistribution.available', { availableDistros });

                // Find exact match first
                const exactMatch = availableDistros.find((distro: string) => distro === detectedDistro);
                if (exactMatch) {
                    this.logOperation('getCorrectWSLDistribution.exactMatch', { detectedDistro, exactMatch });
                    return exactMatch;
                }

                // Try case-insensitive match
                const caseInsensitiveMatch = availableDistros.find((distro: string) =>
                    distro.toLowerCase() === detectedDistro.toLowerCase()
                );
                if (caseInsensitiveMatch) {
                    this.logOperation('getCorrectWSLDistribution.caseInsensitiveMatch', {
                        detectedDistro,
                        caseInsensitiveMatch
                    });
                    return caseInsensitiveMatch;
                }

                // If no match found, return the first available distribution
                if (availableDistros.length > 0) {
                    const fallbackDistro = availableDistros[0];
                    this.logOperation('getCorrectWSLDistribution.fallback', {
                        detectedDistro,
                        fallbackDistro,
                        reason: 'no_match_found'
                    });
                    return fallbackDistro;
                }

            } catch (execError) {
                this.logError('getCorrectWSLDistribution.validate', execError, { detectedDistro });
            }

            // If all else fails, return the detected distribution as-is
            this.logOperation('getCorrectWSLDistribution.returnAsIs', { detectedDistro });
            return detectedDistro;

        } catch (error) {
            this.logError('getCorrectWSLDistribution', error, { detectedDistro });
            return detectedDistro; // Return original if error occurs
        }
    }

    /**
     * Get filtered workspaces (delegates to Use Case)
     */
    async getWorkspaces(filter?: WorkspaceFilter): Promise<WorkspaceItem[]> {
        try {
            // Convert legacy filter to Use Case request
            const request = filter ? {
                locationType: filter.location !== 'all' ? filter.location as 'local' | 'wsl' | 'remote' : undefined,
                isFavorite: filter.showFavoritesOnly ? true : (filter.view === 'favorites' ? true : undefined),
                tagIds: filter.tags,
                searchQuery: filter.searchText,
                sortBy: 'lastOpened' as const,
                sortOrder: 'desc' as const
            } : {};

            const result = await this.getWorkspacesUseCase.execute(request);

            if (result.isFailure) {
                this.logError('getWorkspaces', result.error);
                // Fallback to storage for backward compatibility
                return this.storage.getWorkspaces();
            }

            // Convert entities back to items for legacy consumers
            return result.value.workspaces.map(ws => ws.toItem());

        } catch (error) {
            this.logError('getWorkspaces', error);
            // Fallback to storage
            return this.storage.getWorkspaces();
        }
    }

    /**
     * Get workspace by ID (delegates to Use Case)
     */
    async getWorkspace(id: string): Promise<WorkspaceItem | undefined> {
        try {
            const result = await this.getWorkspaceByIdUseCase.execute({ workspaceId: id });

            if (result.isFailure) {
                this.logOperation('getWorkspace.notFound', { id, error: result.error.message });
                // Fallback to storage
                return this.storage.getWorkspace(id);
            }

            return result.value.toItem();

        } catch (error) {
            this.logError('getWorkspace', error, { id });
            // Fallback to storage
            return this.storage.getWorkspace(id);
        }
    }

    /**
     * Open a workspace
     */
    async openWorkspace(id: string, newWindow = false): Promise<void> {
        this.logOperation('openWorkspace', { id, newWindow });

        const workspace = await this.getWorkspace(id);
        if (!workspace) {
            this.logError('openWorkspace', new Error(`Workspace not found: ${id}`), { id });
            vscode.window.showErrorMessage(`Workspace not found: ${id}`);
            return;
        }

        this.logOperation('openWorkspace.found', {
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            workspacePath: workspace.path,
            workspaceType: workspace.type,
            locationType: workspace.location.type,
            locationDetails: workspace.location.details
        });

        try {
            let uri: vscode.Uri | undefined;
            let commandExecuted = false;

            if (workspace.location.type === 'wsl') {
                this.logOperation('openWorkspace.wsl.start', {
                    originalPath: workspace.path,
                    workspaceType: workspace.type
                });

                // For WSL workspaces, construct the proper vscode-remote URI
                let wslPath = workspace.path;

                // Extract WSL distribution name
                let distro = workspace.location.details?.wslDistribution || 'default';

                this.logOperation('openWorkspace.wsl.distro', {
                    detectedDistro: distro,
                    locationDetails: workspace.location.details
                });

                // Validate and correct the WSL distribution name
                if (distro !== 'default' && distro !== 'Unknown') {
                    try {
                        distro = await this.getCorrectWSLDistribution(distro);
                        this.logOperation('openWorkspace.wsl.distro.validated', {
                            originalDistro: workspace.location.details?.wslDistribution,
                            correctedDistro: distro
                        });
                    } catch (validationError) {
                        this.logError('openWorkspace.wsl.distro.validation', validationError, {
                            originalDistro: distro
                        });
                        // Continue with original distro if validation fails
                    }
                }

                // Decode URL-encoded characters in the path
                try {
                    wslPath = decodeURIComponent(wslPath);
                    this.logOperation('openWorkspace.wsl.decode', { decodedPath: wslPath });
                } catch (decodeError) {
                    this.logError('openWorkspace.wsl.decode', decodeError, { originalPath: workspace.path });
                    // Continue with original path if decode fails
                }

                // Convert Windows WSL path to Unix path for vscode-remote
                const originalPath = wslPath;
                if (wslPath.startsWith('\\\\wsl$\\')) {
                    // \\wsl$\Ubuntu\home\user\project -> /home/user/project
                    const parts = wslPath.split('\\');
                    if (parts.length >= 4) {
                        wslPath = '/' + parts.slice(4).join('/');
                    }
                    this.logOperation('openWorkspace.wsl.convert.windows', {
                        original: originalPath,
                        converted: wslPath,
                        partsSkipped: parts.slice(0, 4),
                        partsUsed: parts.slice(4)
                    });
                } else if (wslPath.startsWith('/mnt/wsl/')) {
                    // /mnt/wsl/Ubuntu/home/user/project -> /home/user/project
                    wslPath = wslPath.replace('/mnt/wsl/' + distro, '');
                    this.logOperation('openWorkspace.wsl.convert.mnt', {
                        original: originalPath,
                        converted: wslPath,
                        distro
                    });
                } else if (wslPath.includes('\\')) {
                    // Convert backslashes to forward slashes
                    wslPath = wslPath.replace(/\\/g, '/');
                    this.logOperation('openWorkspace.wsl.convert.backslash', {
                        original: originalPath,
                        converted: wslPath
                    });
                }

                // Ensure path starts with /
                if (!wslPath.startsWith('/')) {
                    wslPath = '/' + wslPath;
                    this.logOperation('openWorkspace.wsl.ensureSlash', { finalPath: wslPath });
                }

                // Handle workspace files vs folders differently
                if (workspace.type === 'workspace') {
                    // For .code-workspace files in WSL, we need to use the file URI
                    // But the file is accessed through WSL, so we need to construct the proper path
                    const fileUri = vscode.Uri.file(wslPath);
                    this.logOperation('openWorkspace.wsl.workspaceFile', {
                        fileUri: fileUri.toString(),
                        wslPath
                    });

                    try {
                        await vscode.commands.executeCommand('vscode.openFolder', fileUri, { forceNewWindow: newWindow });
                        commandExecuted = true;
                        this.logOperation('openWorkspace.wsl.workspaceFile.success', { fileUri: fileUri.toString() });
                    } catch (commandError) {
                        this.logError('openWorkspace.wsl.workspaceFile.command', commandError, { fileUri: fileUri.toString() });
                        throw commandError;
                    }
                } else {
                    // For folders, use vscode-remote URI
                    const wslUri = `vscode-remote://wsl+${distro}${wslPath}`;
                    uri = vscode.Uri.parse(wslUri);
                    this.logOperation('openWorkspace.wsl.folder', {
                        wslUri,
                        parsedUri: uri.toString(),
                        originalPath: workspace.path,
                        distro
                    });

                    try {
                        await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: newWindow });
                        commandExecuted = true;
                        this.logOperation('openWorkspace.wsl.folder.success', { wslUri });
                    } catch (commandError) {
                        this.logError('openWorkspace.wsl.folder.command', commandError, { wslUri });
                        throw commandError;
                    }
                }
            } else if (workspace.location.type === 'remote') {
                // For remote workspaces, parse the URI as-is
                uri = vscode.Uri.parse(workspace.path);
                this.logOperation('openWorkspace.remote', {
                    originalPath: workspace.path,
                    parsedUri: uri.toString()
                });

                try {
                    await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: newWindow });
                    commandExecuted = true;
                    this.logOperation('openWorkspace.remote.success', { uri: uri.toString() });
                } catch (commandError) {
                    this.logError('openWorkspace.remote.command', commandError, { uri: uri.toString() });
                    throw commandError;
                }
            } else {
                // For local workspaces, use file URI
                uri = vscode.Uri.file(workspace.path);
                this.logOperation('openWorkspace.local', {
                    originalPath: workspace.path,
                    fileUri: uri.toString()
                });

                try {
                    await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: newWindow });
                    commandExecuted = true;
                    this.logOperation('openWorkspace.local.success', { uri: uri.toString() });
                } catch (commandError) {
                    this.logError('openWorkspace.local.command', commandError, { uri: uri.toString() });
                    throw commandError;
                }
            }

            // Update last opened time
            workspace.lastOpened = new Date();
            await this.storage.saveWorkspace(workspace);
            this.logOperation('openWorkspace.updated', { workspaceId: workspace.id, lastOpened: workspace.lastOpened });

            // Increment tag usage
            for (const tagName of workspace.tags) {
                await this.storage.incrementTagUsage(tagName);
            }
            this.logOperation('openWorkspace.tagsUpdated', { workspaceId: workspace.id, tags: workspace.tags });

            this.fireWorkspacesChanged();
            this.logOperation('openWorkspace.completed', {
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                commandExecuted
            });

        } catch (error) {
            this.logError('openWorkspace', error, {
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                workspacePath: workspace.path,
                locationType: workspace.location.type
            });

            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to open workspace "${workspace.name}": ${errorMessage}`);

            // Provide helpful hints for common issues
            if (workspace.location.type === 'wsl') {
                vscode.window.showInformationMessage(
                    'WSL workspace opening failed. Make sure:\n' +
                    '1. WSL extension is installed\n' +
                    '2. WSL distribution is running\n' +
                    '3. VS Code Remote WSL extension is installed\n' +
                    '4. Check the Developer Console (Ctrl+Shift+P > Developer: Toggle Developer Tools) for detailed logs'
                );
            }
        }
    }

    /**
     * Add workspace to favorites (delegates to Use Case)
     */
    async addToFavorites(id: string): Promise<void> {
        try {
            // First check current status
            const workspace = await this.getWorkspace(id);
            if (!workspace) {
                return;
            }

            // Only toggle if not already favorite
            if (!workspace.isFavorite) {
                const result = await this.toggleFavoriteUseCase.execute({ workspaceId: id });

                if (result.isFailure) {
                    this.logError('addToFavorites', result.error, { id });
                    // Fallback to legacy method
                    workspace.isFavorite = true;
                    await this.storage.saveWorkspace(workspace);
                }
            }

            this.fireWorkspacesChanged();

        } catch (error) {
            this.logError('addToFavorites', error, { id });
        }
    }

    /**
     * Remove workspace from favorites (delegates to Use Case)
     */
    async removeFromFavorites(id: string): Promise<void> {
        try {
            // First check current status
            const workspace = await this.getWorkspace(id);
            if (!workspace) {
                return;
            }

            // Only toggle if currently favorite
            if (workspace.isFavorite) {
                const result = await this.toggleFavoriteUseCase.execute({ workspaceId: id });

                if (result.isFailure) {
                    this.logError('removeFromFavorites', result.error, { id });
                    // Fallback to legacy method
                    workspace.isFavorite = false;
                    await this.storage.saveWorkspace(workspace);
                }
            }

            this.fireWorkspacesChanged();

        } catch (error) {
            this.logError('removeFromFavorites', error, { id });
        }
    }

    /**
     * Pin workspace to top (delegates to Use Case)
     */
    async pinWorkspace(id: string): Promise<void> {
        try {
            // First check current status
            const workspace = await this.getWorkspace(id);
            if (!workspace) {
                return;
            }

            // Only toggle if not already pinned
            if (!workspace.isPinned) {
                const result = await this.togglePinUseCase.execute({ workspaceId: id });

                if (result.isFailure) {
                    this.logError('pinWorkspace', result.error, { id });
                    // Fallback to legacy method
                    workspace.isPinned = true;
                    await this.storage.saveWorkspace(workspace);
                }
            }

            this.fireWorkspacesChanged();

        } catch (error) {
            this.logError('pinWorkspace', error, { id });
        }
    }

    /**
     * Unpin workspace (delegates to Use Case)
     */
    async unpinWorkspace(id: string): Promise<void> {
        try {
            // First check current status
            const workspace = await this.getWorkspace(id);
            if (!workspace) {
                return;
            }

            // Only toggle if currently pinned
            if (workspace.isPinned) {
                const result = await this.togglePinUseCase.execute({ workspaceId: id });

                if (result.isFailure) {
                    this.logError('unpinWorkspace', result.error, { id });
                    // Fallback to legacy method
                    workspace.isPinned = false;
                    await this.storage.saveWorkspace(workspace);
                }
            }

            this.fireWorkspacesChanged();

        } catch (error) {
            this.logError('unpinWorkspace', error, { id });
        }
    }

    /**
     * Edit workspace tags (UI interaction - delegates update to Use Case)
     */
    async editTags(id: string): Promise<void> {
        const workspace = await this.getWorkspace(id);
        if (!workspace) {
            return;
        }

        const allTags = await this.storage.getTags();
        const tagNames = allTags.map(tag => tag.name);
        
        const selected = await vscode.window.showQuickPick(
            tagNames.map(name => ({
                label: name,
                picked: workspace.tags.includes(name)
            })),
            {
                canPickMany: true,
                placeHolder: 'Select tags for this workspace'
            }
        );

        if (selected) {
            try {
                const newTags = selected.map(item => item.label);
                const tagsToAdd = newTags.filter(tag => !workspace.tags.includes(tag));
                const tagsToRemove = workspace.tags.filter(tag => !newTags.includes(tag));

                const result = await this.updateWorkspaceUseCase.execute({
                    workspaceId: id,
                    tagsToAdd,
                    tagsToRemove
                });

                if (result.isFailure) {
                    this.logError('editTags', result.error, { id });
                    // Fallback to legacy method
                    workspace.tags = newTags;
                    await this.storage.saveWorkspace(workspace);
                }

                this.fireWorkspacesChanged();

            } catch (error) {
                this.logError('editTags', error, { id });
                // Fallback: still update UI
                this.fireWorkspacesChanged();
            }
        }
    }

    /**
     * Edit workspace description (UI interaction - delegates update to Use Case)
     */
    async editDescription(id: string): Promise<void> {
        const workspace = await this.getWorkspace(id);
        if (!workspace) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Enter a description for this workspace',
            value: workspace.description || '',
            placeHolder: 'Workspace description...'
        });

        if (description !== undefined) {
            await this.updateDescription(id, description);
        }
    }

    /**
     * Update workspace description directly (delegates to Use Case)
     */
    async updateDescription(id: string, description: string): Promise<void> {
        try {
            const result = await this.updateWorkspaceUseCase.execute({
                workspaceId: id,
                description
            });

            if (result.isFailure) {
                this.logError('updateDescription', result.error, { id });
                // Fallback to legacy method
                const workspace = await this.getWorkspace(id);
                if (workspace) {
                    workspace.description = description;
                    await this.storage.saveWorkspace(workspace);
                }
            }

            this.fireWorkspacesChanged();

        } catch (error) {
            this.logError('updateDescription', error, { id });
            this.fireWorkspacesChanged();
        }
    }

    /**
     * Remove workspace from list (UI confirmation + delegates to Use Case)
     */
    async removeWorkspace(id: string): Promise<void> {
        const workspace = await this.getWorkspace(id);
        if (!workspace) {
            return;
        }

        const choice = await vscode.window.showWarningMessage(
            `Remove "${workspace.name}" from workspace list?`,
            { modal: true },
            'Remove'
        );

        if (choice === 'Remove') {
            try {
                const result = await this.deleteWorkspaceUseCase.execute({ workspaceId: id });

                if (result.isFailure) {
                    this.logError('removeWorkspace', result.error, { id });
                    // Fallback to legacy method
                    await this.storage.removeWorkspace(id);
                }

                this.fireWorkspacesChanged();

            } catch (error) {
                this.logError('removeWorkspace', error, { id });
            }
        }
    }

    /**
     * Refresh workspaces by triggering sync
     */
    async refreshWorkspaces(): Promise<void> {
        try {
            await this.syncService.syncWorkspaces();
            this.fireWorkspacesChanged();
            vscode.window.showInformationMessage('Workspaces refreshed successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh workspaces: ${error}`);
        }
    }

    /**
     * Get all tags
     */
    async getTags(): Promise<Tag[]> {
        return this.storage.getTags();
    }

    /**
     * Add a new custom tag
     */
    async addCustomTag(name: string, color: string, description?: string): Promise<void> {
        const tags = await this.storage.getTags();
        
        // Check if tag already exists
        if (tags.some(tag => tag.name.toLowerCase() === name.toLowerCase())) {
            vscode.window.showWarningMessage(`Tag "${name}" already exists`);
            return;
        }

        const newTag: Tag = {
            id: `custom-${Date.now()}`,
            name,
            color,
            description,
            isSystem: false,
            usageCount: 0
        };

        await this.storage.saveTag(newTag);
    }

    /**
     * Export workspace data
     */
    async exportData(): Promise<void> {
        try {
            const data = await this.storage.exportData();
            const dataStr = JSON.stringify(data, null, 2);
            
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('workspace-manager-export.json'),
                filters: {
                    'JSON': ['json']
                }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(dataStr, 'utf8'));
                vscode.window.showInformationMessage('Workspace data exported successfully');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export data: ${error}`);
        }
    }

    /**
     * Import workspace data
     */
    async importData(): Promise<void> {
        try {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'JSON': ['json']
                }
            });

            if (uri && uri[0]) {
                const dataBuffer = await vscode.workspace.fs.readFile(uri[0]);
                const dataStr = Buffer.from(dataBuffer).toString('utf8');
                const data = JSON.parse(dataStr);

                await this.storage.importData(data);
                this.fireWorkspacesChanged();
                vscode.window.showInformationMessage('Workspace data imported successfully');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import data: ${error}`);
        }
    }

    /**
     * Fire workspaces changed event
     */
    private async fireWorkspacesChanged(): Promise<void> {
        const workspaces = await this.getWorkspaces();
        this.eventEmitter.fire(workspaces);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.eventEmitter.dispose();
    }
}
