import * as vscode from 'vscode';
import { WorkspaceItem, WorkspaceFilter, Tag } from './types';
import { WorkspaceStorage } from './storage/workspaceStorage';
import { WorkspaceSyncService } from './services/workspaceSyncService';

/**
 * Main workspace manager class that coordinates all workspace operations
 */
export class WorkspaceManager {
    private readonly eventEmitter = new vscode.EventEmitter<WorkspaceItem[]>();
    public readonly onWorkspacesChanged = this.eventEmitter.event;

    constructor(
        private readonly storage: WorkspaceStorage,
        public readonly syncService: WorkspaceSyncService
    ) {}

    /**
     * Log workspace operation with timestamp
     */
    private logOperation(operation: string, details: any): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] WorkspaceManager.${operation}:`, details);
    }

    /**
     * Log workspace operation error
     */
    private logError(operation: string, error: any, context?: any): void {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] WorkspaceManager.${operation} ERROR:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            context
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
     * Get filtered workspaces
     */
    async getWorkspaces(filter?: WorkspaceFilter): Promise<WorkspaceItem[]> {
        let workspaces = await this.storage.getWorkspaces();

        if (!filter) {
            return workspaces;
        }

        // Apply search filter
        if (filter.searchText) {
            const searchLower = filter.searchText.toLowerCase();
            workspaces = workspaces.filter(w => 
                w.name.toLowerCase().includes(searchLower) ||
                w.path.toLowerCase().includes(searchLower) ||
                w.description?.toLowerCase().includes(searchLower) ||
                w.tags.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }

        // Apply tag filter
        if (filter.tags && filter.tags.length > 0) {
            workspaces = workspaces.filter(w => 
                filter.tags!.some(tag => w.tags.includes(tag))
            );
        }

        // Apply location filter
        if (filter.location && filter.location !== 'all') {
            workspaces = workspaces.filter(w => w.location.type === filter.location);
        }

        // Apply type filter
        if (filter.type && filter.type !== 'all') {
            workspaces = workspaces.filter(w => w.type === filter.type);
        }

        // Apply view filter
        if (filter.view && filter.view !== 'all') {
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            switch (filter.view) {
                case 'recent':
                    workspaces = workspaces.filter(w => w.lastOpened >= oneWeekAgo);
                    break;
                case 'favorites':
                    workspaces = workspaces.filter(w => w.isFavorite);
                    break;
                case 'pinned':
                    workspaces = workspaces.filter(w => w.isPinned);
                    break;
            }
        }

        // Apply type filter
        if (filter.type && filter.type.length > 0) {
            workspaces = workspaces.filter(w => filter.type!.includes(w.type));
        }

        // Apply favorites filter
        if (filter.showFavoritesOnly) {
            workspaces = workspaces.filter(w => w.isFavorite);
        }

        // Apply pinned filter
        if (filter.showPinnedOnly) {
            workspaces = workspaces.filter(w => w.isPinned);
        }

        return workspaces;
    }

    /**
     * Get workspace by ID
     */
    async getWorkspace(id: string): Promise<WorkspaceItem | undefined> {
        return this.storage.getWorkspace(id);
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
     * Add workspace to favorites
     */
    async addToFavorites(id: string): Promise<void> {
        const workspace = await this.getWorkspace(id);
        if (workspace) {
            workspace.isFavorite = true;
            await this.storage.saveWorkspace(workspace);
            this.fireWorkspacesChanged();
        }
    }

    /**
     * Remove workspace from favorites
     */
    async removeFromFavorites(id: string): Promise<void> {
        const workspace = await this.getWorkspace(id);
        if (workspace) {
            workspace.isFavorite = false;
            await this.storage.saveWorkspace(workspace);
            this.fireWorkspacesChanged();
        }
    }

    /**
     * Pin workspace to top
     */
    async pinWorkspace(id: string): Promise<void> {
        const workspace = await this.getWorkspace(id);
        if (workspace) {
            workspace.isPinned = true;
            await this.storage.saveWorkspace(workspace);
            this.fireWorkspacesChanged();
        }
    }

    /**
     * Unpin workspace
     */
    async unpinWorkspace(id: string): Promise<void> {
        const workspace = await this.getWorkspace(id);
        if (workspace) {
            workspace.isPinned = false;
            await this.storage.saveWorkspace(workspace);
            this.fireWorkspacesChanged();
        }
    }

    /**
     * Edit workspace tags
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
            workspace.tags = selected.map(item => item.label);
            await this.storage.saveWorkspace(workspace);
            this.fireWorkspacesChanged();
        }
    }

    /**
     * Edit workspace description
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
            workspace.description = description;
            await this.storage.saveWorkspace(workspace);
            this.fireWorkspacesChanged();
        }
    }

    /**
     * Remove workspace from list
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
            await this.storage.removeWorkspace(id);
            this.fireWorkspacesChanged();
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
