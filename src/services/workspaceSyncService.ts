import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceItem, WorkspaceLocation, ProjectInfo, SYSTEM_TAGS } from '../types';
import { WorkspaceStorage } from '../storage/workspaceStorage';

interface VSCodeHistoryEntry {
    workspace?: {
        id: string;
        configPath: string;
    };
    folderUri?: string;
    fileUri?: string;
    label?: string;
    remoteAuthority?: string;
}

interface VSCodeHistory {
    entries: VSCodeHistoryEntry[];
}

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

        // Listen for workspace changes to capture new workspaces
        vscode.workspace.onDidChangeWorkspaceFolders(event => {
            this.captureCurrentWorkspace();
        });

        // Capture current workspace on startup
        this.captureCurrentWorkspace();
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
            console.log('开始同步 VS Code 工作区历史记录...');
            
            // 从SQLite数据库读取历史记录，包含顺序信息
            const sqliteWorkspacesWithOrder = await this.readVSCodeSQLiteHistoryWithOrder();
            console.log(`从SQLite数据库读取到 ${sqliteWorkspacesWithOrder.length} 个工作区`);
            
            if (sqliteWorkspacesWithOrder.length === 0) {
                throw new Error('无法从 VS Code 数据库读取历史记录。请确保 VS Code 已关闭，或数据库文件存在。');
            }
            
            // 转换为WorkspaceItem格式
            const newWorkspaces: WorkspaceItem[] = [];
            for (const workspaceData of sqliteWorkspacesWithOrder) {
                try {
                    const workspaceItem = await this.createWorkspaceItemWithOrder(workspaceData.path, workspaceData.order, sqliteWorkspacesWithOrder.length);
                    if (workspaceItem) {
                        newWorkspaces.push(workspaceItem);
                    }
                } catch (error) {
                    console.warn(`处理工作区失败: ${workspaceData.path}`, error);
                }
            }
            
            const existingWorkspaces = await this.storage.getWorkspaces();
            
            // 合并新工作区与现有工作区
            const mergedWorkspaces = this.mergeWorkspaces(existingWorkspaces, newWorkspaces);
            
            // 保存更新的工作区
            await this.storage.saveWorkspaces(mergedWorkspaces);
            
            console.log(`同步完成！处理了 ${newWorkspaces.length} 个工作区`);
            return mergedWorkspaces;
        } catch (error) {
            const errorMessage = `工作区同步失败: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMessage, error);
            throw new Error(errorMessage);
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
     * Get VS Code's recently opened workspaces from storage
     */
    private async getRecentWorkspaces(): Promise<string[]> {
        const workspaces: string[] = [];
        
        try {
            // Add current workspace
            if (vscode.workspace.workspaceFolders?.[0]) {
                workspaces.push(vscode.workspace.workspaceFolders[0].uri.fsPath);
            }

            // 只从SQLite数据库读取（这是唯一可靠的方法）
            const sqliteWorkspaces = await this.readVSCodeSQLiteHistory();
            workspaces.push(...sqliteWorkspaces);
            
            console.log(`从存储读取到 ${workspaces.length} 个工作区路径`);

        } catch (error) {
            const errorMessage = `读取 VS Code 存储失败: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMessage);
            throw new Error(errorMessage);
        }

        // Remove duplicates and invalid paths
        return [...new Set(workspaces)].filter(p => p && this.isValidPath(p));
    }

    /**
     * Read VS Code's storage file to get recently opened workspaces
     */
    private async readVSCodeStorage(): Promise<string[]> {
        const workspaces: string[] = [];
        
        try {
            // Try multiple storage sources
            const sources = [
                this.readStorageDB(),
                this.readRecentlyOpened(),
                this.readGlobalState(),
                this.readWorkspaceState()
            ];

            for (const source of sources) {
                try {
                    const paths = await source;
                    workspaces.push(...paths);
                } catch (error) {
                    console.warn('Failed to read from storage source:', error);
                }
            }

        } catch (error) {
            console.warn('Failed to read VS Code storage:', error);
        }

        return workspaces;
    }

    /**
     * Read from storage.json or state.vscdb
     */
    private async readStorageDB(): Promise<string[]> {
        const workspaces: string[] = [];
        
        try {
            // First try reading from SQLite database (VS Code's newer format)
            const sqliteWorkspaces = await this.readVSCodeSQLiteHistory();
            if (sqliteWorkspaces.length > 0) {
                workspaces.push(...sqliteWorkspaces);
                return workspaces;
            }

            // Fallback to old storage.json format
            const platform = os.platform();
            const homeDir = os.homedir();
            
            let storagePath: string;
            
            switch (platform) {
                case 'win32':
                    storagePath = path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'storage.json');
                    break;
                case 'darwin':
                    storagePath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'storage.json');
                    break;
                case 'linux':
                    storagePath = path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'storage.json');
                    break;
                default:
                    return workspaces;
            }

            if (fs.existsSync(storagePath)) {
                try {
                    const content = fs.readFileSync(storagePath, 'utf-8');
                    const data = JSON.parse(content);
                    this.extractWorkspacePathsFromStorage(data, workspaces);
                } catch (error) {
                    console.warn('Failed to read storage.json:', error);
                }
            }
        } catch (error) {
            console.warn('Failed to read storage database:', error);
        }

        return workspaces;
    }

    /**
     * Read VS Code's recently opened workspaces from SQLite database
     */
    private async readVSCodeSQLiteHistory(): Promise<string[]> {
        const workspaces: string[] = [];
        
        try {
            const platform = os.platform();
            const homeDir = os.homedir();
            
            let dbPath: string;
            
            switch (platform) {
                case 'win32':
                    dbPath = path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'state.vscdb');
                    break;
                case 'darwin':
                    dbPath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'state.vscdb');
                    break;
                case 'linux':
                    dbPath = path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'state.vscdb');
                    break;
                default:
                    throw new Error(`不支持的操作系统平台: ${platform}`);
            }

            console.log(`正在查找 VS Code 数据库: ${dbPath}`);

            if (!fs.existsSync(dbPath)) {
                throw new Error(`VS Code 数据库文件不存在: ${dbPath}。请确保 VS Code 已正确安装并至少运行过一次。`);
            }

            console.log('正在读取 VS Code 历史记录...');

            // 使用Node.js sqlite3包直接读取数据库
            const sqlite3 = require('sqlite3');
            
            const historyData = await new Promise<string>((resolve, reject) => {
                const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err: any) => {
                    if (err) {
                        reject(new Error(`无法打开数据库: ${err.message}`));
                        return;
                    }
                });

                const query = `SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'`;
                
                db.get(query, (err: any, row: any) => {
                    if (err) {
                        db.close();
                        reject(new Error(`SQLite 查询失败: ${err.message}`));
                        return;
                    }
                    
                    if (!row || !row.value) {
                        db.close();
                        reject(new Error('VS Code 数据库中没有找到历史记录数据。请确保已经在 VS Code 中打开过一些工作区。'));
                        return;
                    }
                    
                    db.close((closeErr: any) => {
                        if (closeErr) {
                            console.warn('关闭数据库时出现警告:', closeErr.message);
                        }
                    });
                    
                    resolve(row.value);
                });
            });
            
            console.log('解析历史记录数据...');
            const parsedData = JSON.parse(historyData) as VSCodeHistory;
            
            if (!parsedData.entries || !Array.isArray(parsedData.entries)) {
                throw new Error('历史记录数据格式不正确');
            }
            
            for (const entry of parsedData.entries) {
                try {
                    console.log('处理历史记录条目:', {
                        workspace: entry.workspace?.configPath,
                        folder: entry.folderUri,
                        file: entry.fileUri,
                        label: entry.label,
                        remoteAuthority: entry.remoteAuthority
                    });
                    
                    if (entry.workspace?.configPath) {
                        // Workspace file
                        console.log('解码工作区文件URI:', entry.workspace.configPath);
                        const uri = this.decodeVSCodeUri(entry.workspace.configPath);
                        console.log('解码结果:', uri);
                        if (uri) {
                            workspaces.push(uri);
                        }
                    } else if (entry.folderUri) {
                        // Folder
                        console.log('解码文件夹URI:', entry.folderUri);
                        const uri = this.decodeVSCodeUri(entry.folderUri);
                        console.log('解码结果:', uri);
                        if (uri && !entry.folderUri.includes('/.vscode/')) {
                            workspaces.push(uri);
                        }
                    }
                    // Skip individual files (fileUri entries)
                } catch (error) {
                    console.warn('处理历史记录条目失败:', entry, error);
                }
            }
            
            console.log(`成功从 VS Code 历史记录中提取 ${workspaces.length} 个工作区`);
            
            if (workspaces.length === 0) {
                throw new Error('未找到任何有效的工作区路径。请确保在 VS Code 中已经打开过文件夹或工作区。');
            }
            
        } catch (error) {
            if (error instanceof Error) {
                console.error('读取 VS Code SQLite 历史记录失败:', error.message);
                throw error;
            }
            throw new Error(`未知错误: ${String(error)}`);
        }

        return workspaces;
    }

    /**
     * Read VS Code SQLite history with order information for proper lastOpened calculation
     */
    private async readVSCodeSQLiteHistoryWithOrder(): Promise<Array<{path: string, order: number}>> {
        const workspacesWithOrder: Array<{path: string, order: number}> = [];
        
        try {
            const platform = os.platform();
            const homeDir = os.homedir();
            
            let dbPath: string;
            
            switch (platform) {
                case 'win32':
                    dbPath = path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'state.vscdb');
                    break;
                case 'darwin':
                    dbPath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'state.vscdb');
                    break;
                case 'linux':
                    dbPath = path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'state.vscdb');
                    break;
                default:
                    throw new Error(`不支持的操作系统平台: ${platform}`);
            }

            console.log(`正在查找 VS Code 数据库: ${dbPath}`);

            if (!fs.existsSync(dbPath)) {
                throw new Error(`VS Code 数据库文件不存在: ${dbPath}。请确保 VS Code 已正确安装并至少运行过一次。`);
            }

            console.log('正在读取 VS Code 历史记录...');

            // 使用Node.js sqlite3包直接读取数据库
            const sqlite3 = require('sqlite3');
            
            const historyData = await new Promise<string>((resolve, reject) => {
                const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err: any) => {
                    if (err) {
                        reject(new Error(`无法打开数据库: ${err.message}`));
                        return;
                    }
                });

                const query = `SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'`;
                
                db.get(query, (err: any, row: any) => {
                    if (err) {
                        db.close();
                        reject(new Error(`SQLite 查询失败: ${err.message}`));
                        return;
                    }
                    
                    if (!row || !row.value) {
                        db.close();
                        reject(new Error('VS Code 数据库中没有找到历史记录数据。请确保已经在 VS Code 中打开过一些工作区。'));
                        return;
                    }
                    
                    db.close((closeErr: any) => {
                        if (closeErr) {
                            console.warn('关闭数据库时出现警告:', closeErr.message);
                        }
                    });
                    
                    resolve(row.value);
                });
            });
            
            console.log('解析历史记录数据...');
            const parsedData = JSON.parse(historyData) as VSCodeHistory;
            
            if (!parsedData.entries || !Array.isArray(parsedData.entries)) {
                throw new Error('历史记录数据格式不正确');
            }
            
            let order = 0;
            for (const entry of parsedData.entries) {
                try {
                    console.log('处理历史记录条目:', {
                        workspace: entry.workspace?.configPath,
                        folder: entry.folderUri,
                        file: entry.fileUri,
                        label: entry.label,
                        remoteAuthority: entry.remoteAuthority
                    });
                    
                    if (entry.workspace?.configPath) {
                        // Workspace file
                        console.log('解码工作区文件URI:', entry.workspace.configPath);
                        const uri = this.decodeVSCodeUri(entry.workspace.configPath);
                        console.log('解码结果:', uri);
                        if (uri) {
                            workspacesWithOrder.push({ path: uri, order: order++ });
                        }
                    } else if (entry.folderUri) {
                        // Folder
                        console.log('解码文件夹URI:', entry.folderUri);
                        const uri = this.decodeVSCodeUri(entry.folderUri);
                        console.log('解码结果:', uri);
                        if (uri && !entry.folderUri.includes('/.vscode/')) {
                            workspacesWithOrder.push({ path: uri, order: order++ });
                        }
                    }
                    // Skip individual files (fileUri entries)
                } catch (error) {
                    console.warn('处理历史记录条目失败:', entry, error);
                }
            }
            
            console.log(`成功从 VS Code 历史记录中提取 ${workspacesWithOrder.length} 个工作区`);
            
            if (workspacesWithOrder.length === 0) {
                throw new Error('未找到任何有效的工作区路径。请确保在 VS Code 中已经打开过文件夹或工作区。');
            }
            
        } catch (error) {
            if (error instanceof Error) {
                console.error('读取 VS Code SQLite 历史记录失败:', error.message);
                throw error;
            }
            throw new Error(`未知错误: ${String(error)}`);
        }

        return workspacesWithOrder;
    }

    /**
     * Decode VS Code URI format (like file:///c%3A/path) to normal path
     */
    private decodeVSCodeUri(uri: string): string | null {
        try {
            console.log('解码URI:', uri);
            
            if (uri.startsWith('file:///')) {
                // Remove file:/// prefix and decode URI
                const path = decodeURIComponent(uri.substring(8));
                // Handle Windows paths (convert /c: to c:)
                if (path.match(/^\/[a-zA-Z]:/)) {
                    const result = path.substring(1);
                    console.log('本地文件路径解码结果:', result);
                    return result;
                }
                console.log('本地文件路径解码结果:', path);
                return path;
            } else if (uri.startsWith('vscode-remote://')) {
                // Remote workspace - extract the path part
                console.log('处理远程URI:', uri);
                const match = uri.match(/vscode-remote:\/\/([^/]+)(.+)/);
                if (match) {
                    const [, authority, remotePath] = match;
                    console.log('远程URI解析 - authority:', authority, 'remotePath:', remotePath);
                    
                    // Handle SSH remote
                    if (authority.startsWith('ssh-remote')) {
                        const result = `ssh://${authority.replace('ssh-remote+', '')}${remotePath}`;
                        console.log('SSH远程解码结果:', result);
                        return result;
                    }
                    
                    // Handle WSL remote
                    if (authority.startsWith('wsl')) {
                        const distro = authority.replace('wsl+', '');
                        // Decode any URL-encoded characters in the remote path
                        const decodedPath = decodeURIComponent(remotePath);
                        const result = `\\\\wsl$\\${distro}${decodedPath.replace(/\//g, '\\')}`;
                        console.log('WSL远程解码结果:', result);
                        return result;
                    }
                    
                    // Handle Codespaces
                    if (authority.includes('codespaces')) {
                        const result = `codespaces://${authority}${remotePath}`;
                        console.log('Codespaces解码结果:', result);
                        return result;
                    }
                    
                    // Handle other remote types
                    const result = `${authority}:${remotePath}`;
                    console.log('其他远程类型解码结果:', result);
                    return result;
                }
            } else if (uri.startsWith('vscode-vfs://github')) {
                // GitHub Codespaces or GitHub remote
                const result = uri.replace('vscode-vfs://', 'github://');
                console.log('GitHub VFS解码结果:', result);
                return result;
            } else if (uri.includes('wsl$')) {
                // Direct WSL path
                console.log('直接WSL路径:', uri);
                return uri;
            } else if (uri.startsWith('ssh://')) {
                // Direct SSH URI
                console.log('直接SSH路径:', uri);
                return uri;
            }
            
            console.log('无法识别的URI格式:', uri);
            return null;
        } catch (error) {
            console.warn('Failed to decode VS Code URI:', uri, error);
            return null;
        }
    }

    /**
     * Read from recently opened files 
     */
    private async readRecentlyOpened(): Promise<string[]> {
        const workspaces: string[] = [];
        
        try {
            // Try to use VS Code's internal API if available
            const recentlyOpened = (vscode as any).workspace?.fs?.readDirectory;
            if (recentlyOpened) {
                // This is a placeholder - VS Code doesn't expose recently opened directly
                // We'll implement file system based approach
            }

            // Use command to get recently opened (if extension has permission)
            try {
                await vscode.commands.executeCommand('workbench.action.openRecent');
                // This opens the recent menu but doesn't return data
            } catch (error) {
                // Command might not be available
            }

        } catch (error) {
            console.warn('Failed to access recently opened:', error);
        }

        return workspaces;
    }

    /**
     * Read from workspace state
     */
    private async readGlobalState(): Promise<string[]> {
        const workspaces: string[] = [];
        
        try {
            // Check if we can access global state
            const config = vscode.workspace.getConfiguration('workspaceManager');
            const recentPaths = config.get<string[]>('cachedRecentPaths', []);
            workspaces.push(...recentPaths);
            
        } catch (error) {
            console.warn('Failed to read global state:', error);
        }

        return workspaces;
    }

    /**
     * Read workspace state files
     */
    private async readWorkspaceState(): Promise<string[]> {
        const workspaces: string[] = [];
        const platform = os.platform();
        const homeDir = os.homedir();
        
        let workspaceStoragePath: string;
        
        switch (platform) {
            case 'win32':
                workspaceStoragePath = path.join(process.env.APPDATA || '', 'Code', 'User', 'workspaceStorage');
                break;
            case 'darwin':
                workspaceStoragePath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
                break;
            case 'linux':
                workspaceStoragePath = path.join(homeDir, '.config', 'Code', 'User', 'workspaceStorage');
                break;
            default:
                return workspaces;
        }

        if (fs.existsSync(workspaceStoragePath)) {
            try {
                const dirs = fs.readdirSync(workspaceStoragePath);
                for (const dir of dirs) {
                    const workspaceFile = path.join(workspaceStoragePath, dir, 'workspace.json');
                    if (fs.existsSync(workspaceFile)) {
                        try {
                            const content = fs.readFileSync(workspaceFile, 'utf-8');
                            const data = JSON.parse(content);
                            if (data.folder) {
                                workspaces.push(data.folder);
                            }
                            if (data.workspace) {
                                workspaces.push(data.workspace);
                            }
                        } catch (error) {
                            // Skip invalid workspace files
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to read workspace storage:', error);
            }
        }

        return workspaces;
    }

    /**
     * Extract workspace paths from storage data with better parsing
     */
    private extractWorkspacePathsFromStorage(data: any, workspaces: string[]): void {
        try {
            // Check for recently opened workspaces in storage
            if (data.openedPathsList && data.openedPathsList.entries) {
                for (const entry of data.openedPathsList.entries) {
                    if (entry.folderUri) {
                        const uri = this.parseUri(entry.folderUri);
                        if (uri) {
                            workspaces.push(uri);
                        }
                    }
                    if (entry.workspace && entry.workspace.configPath) {
                        const uri = this.parseUri(entry.workspace.configPath);
                        if (uri) {
                            workspaces.push(uri);
                        }
                    }
                }
            }

            // Check for file history
            if (data.history && data.history.entries) {
                for (const entry of data.history.entries) {
                    if (entry.folderUri) {
                        const uri = this.parseUri(entry.folderUri);
                        if (uri) {
                            workspaces.push(uri);
                        }
                    }
                    if (entry.workspaceUri) {
                        const uri = this.parseUri(entry.workspaceUri);
                        if (uri) {
                            workspaces.push(uri);
                        }
                    }
                }
            }

            // Recursively check nested objects
            for (const key in data) {
                if (typeof data[key] === 'object' && data[key] !== null) {
                    this.extractWorkspacePathsFromStorage(data[key], workspaces);
                }
            }

        } catch (error) {
            console.warn('Failed to extract workspace paths:', error);
        }
    }

    /**
     * Get VS Code storage path based on platform
     */
    private getVSCodeStoragePath(): string | null {
        const platform = os.platform();
        const homeDir = os.homedir();
        
        let basePath: string;
        
        switch (platform) {
            case 'win32':
                basePath = path.join(process.env.APPDATA || '', 'Code', 'User');
                break;
            case 'darwin':
                basePath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User');
                break;
            case 'linux':
                basePath = path.join(homeDir, '.config', 'Code', 'User');
                break;
            default:
                return null;
        }

        // Try multiple possible storage locations
        const possiblePaths = [
            path.join(basePath, 'globalStorage', 'state.vscdb'),
            path.join(basePath, 'workspaceStorage'),
            path.join(basePath, 'settings.json'),
            path.join(basePath, 'recently-opened.json')
        ];

        for (const storagePath of possiblePaths) {
            if (fs.existsSync(storagePath)) {
                return storagePath;
            }
        }

        return null;
    }

    /**
     * Parse JSONC (JSON with Comments) content
     */
    private parseJSONC(content: string): any {
        try {
            // Remove comments and trailing commas (simplified JSONC parser)
            const cleanContent = content
                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
                .replace(/\/\/.*$/gm, '') // Remove // comments
                .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
            
            return JSON.parse(cleanContent);
        } catch (error) {
            console.warn('Failed to parse JSONC:', error);
            return {};
        }
    }

    /**
     * Extract workspace paths from VS Code storage data
     */
    private extractWorkspacePaths(data: any, workspaces: string[]): void {
        try {
            // Common paths where VS Code stores recent workspaces
            const possibleKeys = [
                'recentlyOpenedPathsList',
                'openedPathsList',
                'workspaces',
                'folders',
                'files'
            ];

            for (const key of possibleKeys) {
                if (data[key] && Array.isArray(data[key])) {
                    for (const item of data[key]) {
                        if (typeof item === 'string') {
                            workspaces.push(item);
                        } else if (item && typeof item === 'object') {
                            // Handle different object structures
                            if (item.folderPath) {
                                workspaces.push(item.folderPath);
                            }
                            if (item.path) {
                                workspaces.push(item.path);
                            }
                            if (item.uri) {
                                const uri = this.parseUri(item.uri);
                                if (uri) {
                                    workspaces.push(uri);
                                }
                            }
                        }
                    }
                }
            }

            // Also check nested structures
            if (data.recently && data.recently.opened) {
                this.extractWorkspacePaths(data.recently.opened, workspaces);
            }

        } catch (error) {
            console.warn('Failed to extract workspace paths:', error);
        }
    }

    /**
     * Parse URI to local path
     */
    private parseUri(uri: string): string | null {
        try {
            if (uri.startsWith('file://')) {
                return decodeURIComponent(uri.slice(7));
            }
            if (uri.startsWith('vscode-remote://')) {
                // Handle remote URIs
                return uri;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get workspaces from VS Code API (if available)
     */
    private async getWorkspacesFromAPI(): Promise<string[]> {
        const workspaces: string[] = [];
        
        try {
            // Use VS Code API to get recent workspaces if available
            // This is a fallback method
            
            // Check if we can access workspace state
            const workspaceState = vscode.workspace.getConfiguration('workspaceManager');
            const recentPaths = workspaceState.get<string[]>('recentPaths', []);
            workspaces.push(...recentPaths);
            
        } catch (error) {
            console.warn('Failed to get workspaces from API:', error);
        }

        return workspaces;
    }

    /**
     * Check if path is valid and accessible
     */
    private isValidPath(workspacePath: string): boolean {
        try {
            if (!workspacePath || workspacePath.length === 0) {
                return false;
            }

            // Handle remote paths
            if (workspacePath.startsWith('vscode-remote://') || 
                workspacePath.startsWith('ssh://') ||
                workspacePath.includes('@')) {
                return true; // Assume remote paths are valid
            }

            // Check local paths
            return fs.existsSync(workspacePath);
        } catch (error) {
            return false;
        }
    }

    /**
     * Create a workspace item from a path
     */
    private async createWorkspaceItem(workspacePath: string): Promise<WorkspaceItem | null> {
        try {
            console.log('创建工作区项目:', workspacePath);
            
            const location = this.detectLocation(workspacePath);
            console.log('检测到的位置类型:', location.type);
            
            let stats: fs.Stats;
            let projectInfo: ProjectInfo | undefined;
            
            // For remote and WSL workspaces, we can't check file existence locally
            if (location.type === 'remote' || location.type === 'wsl') {
                console.log('远程/WSL工作区，跳过本地文件检查');
                // Create dummy stats for remote workspaces
                stats = {
                    mtime: new Date(),
                    isDirectory: () => true,
                    isFile: () => false
                } as fs.Stats;
                
                // We can't detect project info for remote workspaces
                projectInfo = undefined;
            } else {
                // Local workspace - check if exists
                if (!fs.existsSync(workspacePath)) {
                    console.log('本地工作区路径不存在:', workspacePath);
                    return null;
                }
                
                stats = fs.statSync(workspacePath);
                projectInfo = await this.detectProjectInfo(workspacePath);
            }
            
            const autoTags = this.detectAutoTags(workspacePath, projectInfo);

            // Generate a unique ID based on path
            const id = Buffer.from(workspacePath).toString('base64');
            
            const workspaceItem: WorkspaceItem = {
                id,
                name: this.extractWorkspaceName(workspacePath),
                path: workspacePath,
                type: this.detectType(workspacePath, stats),
                location,
                lastOpened: stats.mtime,
                isFavorite: false,
                isPinned: false,
                tags: autoTags,
                projectInfo
            };

            console.log('成功创建工作区项目:', workspaceItem.name, workspaceItem.location.type);
            return workspaceItem;
        } catch (error) {
            console.error(`Failed to create workspace item for ${workspacePath}:`, error);
            return null;
        }
    }

    /**
     * Create workspace item with proper lastOpened time based on order in VS Code history
     */
    private async createWorkspaceItemWithOrder(workspacePath: string, order: number, totalItems: number): Promise<WorkspaceItem | null> {
        try {
            console.log('创建工作区项目 (带顺序):', workspacePath, '顺序:', order);
            
            const location = this.detectLocation(workspacePath);
            console.log('检测到的位置类型:', location.type);
            
            let stats: fs.Stats;
            let projectInfo: ProjectInfo | undefined;
            
            // Calculate lastOpened based on order in history
            // Most recent (order 0) gets current time, others get progressively older
            const now = new Date();
            const minutesAgo = order * 5; // Each item is 5 minutes older than the previous
            const lastOpened = new Date(now.getTime() - minutesAgo * 60 * 1000);
            
            // For remote and WSL workspaces, we can't check file existence locally
            if (location.type === 'remote' || location.type === 'wsl') {
                console.log('远程/WSL工作区，跳过本地文件检查');
                // Create dummy stats with calculated lastOpened time
                stats = {
                    mtime: lastOpened,
                    isDirectory: () => true,
                    isFile: () => false
                } as fs.Stats;
                
                // We can't detect project info for remote workspaces
                projectInfo = undefined;
            } else {
                // Local workspace - check if exists
                if (!fs.existsSync(workspacePath)) {
                    console.log('本地工作区路径不存在:', workspacePath);
                    return null;
                }
                
                const fileStats = fs.statSync(workspacePath);
                // Use calculated time instead of file mtime for consistency
                stats = {
                    ...fileStats,
                    mtime: lastOpened
                } as fs.Stats;
                projectInfo = await this.detectProjectInfo(workspacePath);
            }
            
            const autoTags = this.detectAutoTags(workspacePath, projectInfo);

            // Generate a unique ID based on path
            const id = Buffer.from(workspacePath).toString('base64');
            
            const workspaceItem: WorkspaceItem = {
                id,
                name: this.extractWorkspaceName(workspacePath),
                path: workspacePath,
                type: this.detectType(workspacePath, stats),
                location,
                lastOpened: stats.mtime,
                isFavorite: false,
                isPinned: false,
                tags: autoTags,
                projectInfo
            };

            console.log('成功创建工作区项目 (带顺序):', workspaceItem.name, workspaceItem.location.type, '最后打开:', workspaceItem.lastOpened);
            return workspaceItem;
        } catch (error) {
            console.error(`Failed to create workspace item for ${workspacePath}:`, error);
            return null;
        }
    }

    /**
     * Extract workspace name from path, handling different URI formats
     */
    private extractWorkspaceName(workspacePath: string): string {
        try {
            // Handle SSH remote paths
            if (workspacePath.startsWith('ssh://')) {
                const parts = workspacePath.split('/');
                return parts[parts.length - 1] || 'Remote Workspace';
            }
            
            // Handle GitHub paths
            if (workspacePath.startsWith('github://')) {
                const parts = workspacePath.split('/');
                return parts[parts.length - 1] || 'GitHub Workspace';
            }
            
            // Handle Codespaces
            if (workspacePath.includes('codespaces')) {
                const parts = workspacePath.split('/');
                return parts[parts.length - 1] || 'Codespaces Workspace';
            }
            
            // Handle WSL paths
            if (workspacePath.startsWith('\\\\wsl$\\')) {
                const parts = workspacePath.split('\\');
                return parts[parts.length - 1] || 'WSL Workspace';
            }
            
            // Handle remote authority paths
            if (workspacePath.includes(':')) {
                const parts = workspacePath.split('/');
                const name = parts[parts.length - 1];
                if (name && name !== '') {
                    return name;
                }
                // Fallback to authority part
                const authorityMatch = workspacePath.match(/([^:]+):/);
                return authorityMatch ? `Remote (${authorityMatch[1]})` : 'Remote Workspace';
            }
            
            // Default: use path.basename for local paths
            return path.basename(workspacePath) || 'Unknown Workspace';
        } catch (error) {
            console.warn('Failed to extract workspace name from path:', workspacePath, error);
            return 'Unknown Workspace';
        }
    }

    /**
     * Detect workspace location type
     */
    private detectLocation(workspacePath: string): WorkspaceLocation {
        // WSL patterns
        if (workspacePath.startsWith('\\\\wsl$\\') || 
            workspacePath.startsWith('/mnt/wsl/') ||
            workspacePath.includes('wsl+') ||
            workspacePath.includes('/mnt/c/') ||
            workspacePath.includes('/mnt/d/')) {
            const wslDistribution = this.extractWSLDistribution(workspacePath);
            return {
                type: 'wsl',
                displayName: wslDistribution !== 'Unknown' ? `WSL: ${wslDistribution}` : 'WSL',
                details: {
                    wslDistribution: wslDistribution
                }
            };
        }
        
        // Remote patterns
        if (workspacePath.startsWith('ssh://') || 
            workspacePath.includes('@') ||
            workspacePath.startsWith('github://') ||
            workspacePath.includes('ssh-remote') ||
            workspacePath.includes('vscode-remote') ||
            workspacePath.includes('codespaces') ||
            workspacePath.includes('dev-container')) {
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
                driveLetter: workspacePath.length > 0 ? workspacePath.charAt(0).toUpperCase() : 'C'
            }
        };
    }

    /**
     * Extract WSL distribution name from path
     */
    private extractWSLDistribution(workspacePath: string): string {
        // \\wsl$\Ubuntu-20.04\home\user\project
        let match = workspacePath.match(/\\\\wsl\$\\([^\\]+)/);
        if (match) {
            let distro = match[1];
            // Handle URL-encoded distribution names (e.g., wsl%2Bubuntu -> wsl+ubuntu)
            try {
                distro = decodeURIComponent(distro);
            } catch (decodeError) {
                // If decode fails, use original
            }
            // If the distribution name starts with 'wsl+', extract the actual name
            if (distro.startsWith('wsl+')) {
                distro = distro.substring(4); // Remove 'wsl+' prefix
            }
            return distro;
        }

        // wsl+Ubuntu-20.04
        match = workspacePath.match(/wsl\+([^:/]+)/);
        if (match) {
            return match[1];
        }

        // /mnt/c/ or /mnt/d/ paths
        if (workspacePath.includes('/mnt/')) {
            return 'WSL';
        }
        
        return 'Unknown';
    }

    /**
     * Detect workspace type
     */
    private detectType(workspacePath: string, stats: fs.Stats): 'workspace' | 'folder' {
        if (!stats.isDirectory()) {
            // Check if it's a .code-workspace file
            if (path.extname(workspacePath) === '.code-workspace') {
                return 'workspace';
            }
            // For other files, treat as folder (they shouldn't be workspaces)
            return 'folder';
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
        // Normalize paths for comparison (handle case sensitivity and path separators)
        const normalizePath = (p: string) => path.resolve(p).toLowerCase();
        
        const existingMap = new Map(existing.map(w => [normalizePath(w.path), w]));
        const result: WorkspaceItem[] = [];

        // Add all discovered workspaces, preserving user data from existing ones
        for (const discoveredWorkspace of discovered) {
            const normalizedPath = normalizePath(discoveredWorkspace.path);
            const existingWorkspace = existingMap.get(normalizedPath);
            
            if (existingWorkspace) {
                // Merge with existing data, keeping user modifications but updating lastOpened
                result.push({
                    ...discoveredWorkspace, // This includes the updated lastOpened time
                    isFavorite: existingWorkspace.isFavorite,
                    isPinned: existingWorkspace.isPinned,
                    description: existingWorkspace.description,
                    tags: [...new Set([...discoveredWorkspace.tags, ...existingWorkspace.tags])]
                });
                console.log(`更新工作区最后使用时间: ${discoveredWorkspace.name} -> ${discoveredWorkspace.lastOpened}`);
                existingMap.delete(normalizedPath);
            } else {
                // Check if this workspace already exists in result (additional deduplication)
                const isDuplicate = result.some(w => normalizePath(w.path) === normalizedPath);
                if (!isDuplicate) {
                    result.push(discoveredWorkspace);
                }
            }
        }

        // Add remaining existing workspaces that weren't discovered
        for (const [, existingWorkspace] of existingMap) {
            // Check if this workspace already exists in result
            const normalizedPath = normalizePath(existingWorkspace.path);
            const isDuplicate = result.some(w => normalizePath(w.path) === normalizedPath);
            if (!isDuplicate) {
                result.push(existingWorkspace);
            }
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

    /**
     * Capture current workspace to ensure it's in our list
     */
    private async captureCurrentWorkspace(): Promise<void> {
        try {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const currentPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                
                // Get current cached paths
                const config = vscode.workspace.getConfiguration('workspaceManager');
                const cachedPaths = config.get<string[]>('cachedRecentPaths', []);
                
                // Add current path if not already present
                if (!cachedPaths.includes(currentPath)) {
                    cachedPaths.unshift(currentPath);
                    
                    // Keep only last 20 paths to avoid bloat
                    const limitedPaths = cachedPaths.slice(0, 20);
                    
                    // Update configuration
                    await config.update('cachedRecentPaths', limitedPaths, vscode.ConfigurationTarget.Global);
                }
            }
        } catch (error) {
            console.warn('Failed to capture current workspace:', error);
        }
    }
}
