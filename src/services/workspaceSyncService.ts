import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceItem, WorkspaceLocation, ProjectInfo, SYSTEM_TAGS } from '../types';
import { WorkspaceStorage } from '../storage/workspaceStorage';

/**
 * Service for syncing VS Code workspace history and auto-detecting project information
 */
export class WorkspaceSyncService {
    private syncTimer?: NodeJS.Timeout;
    private readonly config = vscode.workspace.getConfiguration('workspaceManager');

    constructor(private readonly storage: WorkspaceStorage) {
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('workspaceManager')) {
                this.handleConfigurationChange();
            }
        });
    }

    /**
     * Start automatic sync timer
     */
    startAutoSync(): void {
        this.stopAutoSync();
        
        const interval = this.config.get<number>('syncInterval', 5) * 60 * 1000; // Convert to milliseconds
        
        this.syncTimer = setInterval(() => {
            this.syncWorkspaces().catch(error => {
                console.error('Auto-sync failed:', error);
            });
        }, interval);

        // Initial sync
        this.syncWorkspaces().catch(error => {
            console.error('Initial sync failed:', error);
        });
    }

    /**
     * Stop automatic sync timer
     */
    stopAutoSync(): void {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = undefined;
        }
    }

    /**
     * Manually trigger workspace sync
     */
    async syncWorkspaces(): Promise<WorkspaceItem[]> {
        try {
            const newWorkspaces = await this.discoverWorkspaces();
            const existingWorkspaces = await this.storage.getWorkspaces();
            
            // Merge new workspaces with existing ones
            const mergedWorkspaces = this.mergeWorkspaces(existingWorkspaces, newWorkspaces);
            
            // Save updated workspaces
            await this.storage.saveWorkspaces(mergedWorkspaces);
            
            console.log(`Synced ${newWorkspaces.length} workspaces`);
            return mergedWorkspaces;
        } catch (error) {
            console.error('Workspace sync failed:', error);
            throw error;
        }
    }

    /**
     * Discover workspaces from VS Code's recently opened list
     */
    private async discoverWorkspaces(): Promise<WorkspaceItem[]> {
        const workspaces: WorkspaceItem[] = [];
        
        try {
            // Get VS Code's recently opened workspaces
            const recentWorkspaces = await this.getRecentWorkspaces();
            
            for (const workspacePath of recentWorkspaces) {
                try {
                    const workspaceItem = await this.createWorkspaceItem(workspacePath);
                    if (workspaceItem) {
                        workspaces.push(workspaceItem);
                    }
                } catch (error) {
                    console.warn(`Failed to process workspace: ${workspacePath}`, error);
                }
            }
        } catch (error) {
            console.error('Failed to discover workspaces:', error);
        }

        return workspaces;
    }

    /**
     * Get VS Code's recently opened workspaces
     * This is a simplified implementation - in reality, you'd read from VS Code's storage
     */
    private async getRecentWorkspaces(): Promise<string[]> {
        // TODO: Implement reading from VS Code's recently opened list
        // For now, return current workspace and some examples
        const workspaces: string[] = [];
        
        // Add current workspace
        if (vscode.workspace.workspaceFolders?.[0]) {
            workspaces.push(vscode.workspace.workspaceFolders[0].uri.fsPath);
        }

        // In a real implementation, you would read from:
        // Windows: %APPDATA%\\Code\\User\\globalStorage\\state.vscdb
        // macOS: ~/Library/Application Support/Code/User/globalStorage/state.vscdb
        // Linux: ~/.config/Code/User/globalStorage/state.vscdb

        return workspaces;
    }

    /**
     * Create a workspace item from a path
     */
    private async createWorkspaceItem(workspacePath: string): Promise<WorkspaceItem | null> {
        try {
            if (!fs.existsSync(workspacePath)) {
                return null;
            }

            const stats = fs.statSync(workspacePath);
            const location = this.detectLocation(workspacePath);
            const projectInfo = await this.detectProjectInfo(workspacePath);
            const autoTags = this.detectAutoTags(workspacePath, projectInfo);

            // Generate a unique ID based on path
            const id = Buffer.from(workspacePath).toString('base64');
            
            const workspaceItem: WorkspaceItem = {
                id,
                name: path.basename(workspacePath),
                path: workspacePath,
                type: this.detectType(workspacePath, stats),
                location,
                lastOpened: stats.mtime,
                isFavorite: false,
                isPinned: false,
                tags: autoTags,
                projectInfo
            };

            return workspaceItem;
        } catch (error) {
            console.error(`Failed to create workspace item for ${workspacePath}:`, error);
            return null;
        }
    }

    /**
     * Detect workspace location type
     */
    private detectLocation(workspacePath: string): WorkspaceLocation {
        if (workspacePath.startsWith('\\\\wsl$\\') || workspacePath.startsWith('/mnt/wsl/')) {
            return {
                type: 'wsl',
                displayName: 'WSL',
                details: {
                    wslDistribution: this.extractWSLDistribution(workspacePath)
                }
            };
        }
        
        if (workspacePath.startsWith('ssh://') || workspacePath.includes('@')) {
            return {
                type: 'remote',
                displayName: 'Remote',
                details: {
                    serverUrl: workspacePath
                }
            };
        }

        return {
            type: 'local',
            displayName: 'Local',
            details: {
                driveLetter: workspacePath.charAt(0).toUpperCase()
            }
        };
    }

    /**
     * Extract WSL distribution name from path
     */
    private extractWSLDistribution(workspacePath: string): string {
        const match = workspacePath.match(/\\\\wsl\$\\([^\\]+)/);
        return match ? match[1] : 'Unknown';
    }

    /**
     * Detect workspace type
     */
    private detectType(workspacePath: string, stats: fs.Stats): 'workspace' | 'folder' | 'file' {
        if (!stats.isDirectory()) {
            return 'file';
        }

        // Check if it's a VS Code workspace
        if (fs.existsSync(path.join(workspacePath, '.vscode'))) {
            return 'workspace';
        }

        return 'folder';
    }

    /**
     * Detect project information
     */
    private async detectProjectInfo(workspacePath: string): Promise<ProjectInfo | undefined> {
        if (!fs.statSync(workspacePath).isDirectory()) {
            return undefined;
        }

        const projectInfo: ProjectInfo = {};

        try {
            // Check for package.json
            const packageJsonPath = path.join(workspacePath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                projectInfo.hasPackageJson = true;
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                
                // Detect framework
                if (packageJson.dependencies || packageJson.devDependencies) {
                    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                    
                    if (deps['vue'] || deps['@vue/cli']) {
                        projectInfo.framework = 'Vue';
                    } else if (deps['react']) {
                        projectInfo.framework = 'React';
                    } else if (deps['@angular/core']) {
                        projectInfo.framework = 'Angular';
                    } else if (deps['svelte']) {
                        projectInfo.framework = 'Svelte';
                    }
                }

                // Detect package manager
                if (fs.existsSync(path.join(workspacePath, 'yarn.lock'))) {
                    projectInfo.packageManager = 'yarn';
                } else if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml'))) {
                    projectInfo.packageManager = 'pnpm';
                } else if (fs.existsSync(path.join(workspacePath, 'package-lock.json'))) {
                    projectInfo.packageManager = 'npm';
                }
            }

            // Check for other project types
            if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) {
                projectInfo.framework = 'Maven/Java';
                projectInfo.language = 'Java';
            }

            if (fs.existsSync(path.join(workspacePath, 'Cargo.toml'))) {
                projectInfo.language = 'Rust';
            }

            if (fs.existsSync(path.join(workspacePath, 'go.mod'))) {
                projectInfo.language = 'Go';
            }

            if (fs.existsSync(path.join(workspacePath, 'requirements.txt')) || 
                fs.existsSync(path.join(workspacePath, 'pyproject.toml'))) {
                projectInfo.language = 'Python';
            }

            // Check for Dockerfile
            if (fs.existsSync(path.join(workspacePath, 'Dockerfile'))) {
                projectInfo.hasDockerfile = true;
            }

            // Check for .git directory
            if (fs.existsSync(path.join(workspacePath, '.git'))) {
                // TODO: Extract git remote URL
                projectInfo.gitRepository = 'Present';
            }

        } catch (error) {
            console.warn(`Failed to detect project info for ${workspacePath}:`, error);
        }

        return Object.keys(projectInfo).length > 0 ? projectInfo : undefined;
    }

    /**
     * Detect automatic tags based on project info
     */
    private detectAutoTags(workspacePath: string, projectInfo?: ProjectInfo): string[] {
        const tags: string[] = [];

        if (!this.config.get<boolean>('autoTagging', true)) {
            return tags;
        }

        // Add framework tags
        if (projectInfo?.framework) {
            const frameworkTag = projectInfo.framework.toLowerCase();
            if (SYSTEM_TAGS[frameworkTag as keyof typeof SYSTEM_TAGS]) {
                tags.push(SYSTEM_TAGS[frameworkTag as keyof typeof SYSTEM_TAGS].name);
            }
        }

        // Add language tags
        if (projectInfo?.language) {
            const languageTag = projectInfo.language.toLowerCase();
            if (SYSTEM_TAGS[languageTag as keyof typeof SYSTEM_TAGS]) {
                tags.push(SYSTEM_TAGS[languageTag as keyof typeof SYSTEM_TAGS].name);
            }
        }

        return tags;
    }

    /**
     * Merge existing workspaces with newly discovered ones
     */
    private mergeWorkspaces(existing: WorkspaceItem[], discovered: WorkspaceItem[]): WorkspaceItem[] {
        const existingMap = new Map(existing.map(w => [w.path, w]));
        const result: WorkspaceItem[] = [];

        // Add all discovered workspaces, preserving user data from existing ones
        for (const discoveredWorkspace of discovered) {
            const existingWorkspace = existingMap.get(discoveredWorkspace.path);
            
            if (existingWorkspace) {
                // Merge with existing data, keeping user modifications
                result.push({
                    ...discoveredWorkspace,
                    isFavorite: existingWorkspace.isFavorite,
                    isPinned: existingWorkspace.isPinned,
                    description: existingWorkspace.description,
                    tags: [...new Set([...discoveredWorkspace.tags, ...existingWorkspace.tags])]
                });
                existingMap.delete(discoveredWorkspace.path);
            } else {
                result.push(discoveredWorkspace);
            }
        }

        // Add remaining existing workspaces that weren't discovered
        for (const [, existingWorkspace] of existingMap) {
            result.push(existingWorkspace);
        }

        // Sort by last opened date (most recent first)
        result.sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime());

        // Limit to max workspaces
        const maxWorkspaces = this.config.get<number>('maxRecentWorkspaces', 50);
        return result.slice(0, maxWorkspaces);
    }

    /**
     * Handle configuration changes
     */
    private handleConfigurationChange(): void {
        const newConfig = vscode.workspace.getConfiguration('workspaceManager');
        const autoSync = newConfig.get<boolean>('autoSync', true);

        if (autoSync && !this.syncTimer) {
            this.startAutoSync();
        } else if (!autoSync && this.syncTimer) {
            this.stopAutoSync();
        } else if (autoSync && this.syncTimer) {
            // Restart with new interval
            this.startAutoSync();
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.stopAutoSync();
    }
}
