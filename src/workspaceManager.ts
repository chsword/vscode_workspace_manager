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
        const workspace = await this.getWorkspace(id);
        if (!workspace) {
            vscode.window.showErrorMessage(`Workspace not found: ${id}`);
            return;
        }

        try {
            const uri = vscode.Uri.file(workspace.path);
            
            if (workspace.type === 'file') {
                // Open single file
                await vscode.commands.executeCommand('vscode.open', uri, { forceNewWindow: newWindow });
            } else {
                // Open folder or workspace
                await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: newWindow });
            }

            // Update last opened time
            workspace.lastOpened = new Date();
            await this.storage.saveWorkspace(workspace);
            
            // Increment tag usage
            for (const tagName of workspace.tags) {
                await this.storage.incrementTagUsage(tagName);
            }

            this.fireWorkspacesChanged();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open workspace: ${error}`);
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
