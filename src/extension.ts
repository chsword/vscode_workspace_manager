import * as vscode from 'vscode';
import { WorkspaceManager } from './workspaceManager';
import { WorkspaceWebviewPanel } from './webview/workspaceWebviewPanel';
import { WorkspaceSyncService } from './services/workspaceSyncService';
import { WorkspaceStorage } from './storage/workspaceStorage';

/**
 * Extension activation function
 * Called when the extension is first activated
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('Workspace Manager extension is being activated...');

    // Initialize storage
    const storage = new WorkspaceStorage(context);
    
    // Initialize sync service
    const syncService = new WorkspaceSyncService(storage);
    
    // Initialize workspace manager
    const workspaceManager = new WorkspaceManager(storage, syncService);
    
    // Create status bar items
    createStatusBarItems(context, workspaceManager, syncService);
    
    // Register commands
    registerCommands(context, workspaceManager);
    
    // Start sync service if auto-sync is enabled
    if (vscode.workspace.getConfiguration('workspaceManager').get('autoSync', true)) {
        syncService.startAutoSync();
    }
    
    // Auto-open workspace manager in editor on startup
    setTimeout(() => {
        WorkspaceWebviewPanel.createOrShow(context.extensionUri, workspaceManager);
    }, 1000); // Delay to ensure VS Code is fully loaded
    
    console.log('Workspace Manager extension activated successfully!');
}

/**
 * Create status bar items for quick access
 */
function createStatusBarItems(
    context: vscode.ExtensionContext,
    workspaceManager: WorkspaceManager,
    syncService: WorkspaceSyncService
): void {
    // Workspace Manager status bar item
    const workspaceManagerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    workspaceManagerItem.text = "$(folder-library) Workspaces";
    workspaceManagerItem.tooltip = "Open Workspace Manager";
    workspaceManagerItem.command = 'workspaceManager.openInEditor';
    workspaceManagerItem.show();
    context.subscriptions.push(workspaceManagerItem);

    // Sync status bar item
    const syncItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    syncItem.text = "$(sync) Sync";
    syncItem.tooltip = "Sync VS Code History";
    syncItem.command = 'workspaceManager.syncWorkspaces';
    syncItem.show();
    context.subscriptions.push(syncItem);
}

/**
 * Register all extension commands
 */
function registerCommands(
    context: vscode.ExtensionContext, 
    workspaceManager: WorkspaceManager
): void {
    // Get sync service from workspace manager
    const syncService = (workspaceManager as any).syncService as WorkspaceSyncService;
    
    const commands = [
        vscode.commands.registerCommand('workspaceManager.showWorkspaces', () => {
            // Open in editor instead of sidebar view
            WorkspaceWebviewPanel.createOrShow(context.extensionUri, workspaceManager);
        }),
        
        vscode.commands.registerCommand('workspaceManager.refreshWorkspaces', async () => {
            await workspaceManager.refreshWorkspaces();
            // Refresh any open webview panels
            WorkspaceWebviewPanel.refresh();
        }),

        // 新增：手动同步命令
        vscode.commands.registerCommand('workspaceManager.syncWorkspaces', async () => {
            try {
                vscode.window.showInformationMessage('正在同步 VS Code 工作区历史记录...');
                const synced = await syncService.syncWorkspaces();
                vscode.window.showInformationMessage(`同步完成！发现 ${synced.length} 个工作区`);
                WorkspaceWebviewPanel.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`同步失败: ${error}`);
            }
        }),

        // 新增：启用/禁用自动同步
        vscode.commands.registerCommand('workspaceManager.toggleAutoSync', async () => {
            const config = vscode.workspace.getConfiguration('workspaceManager');
            const currentAutoSync = config.get<boolean>('autoSync', true);
            
            await config.update('autoSync', !currentAutoSync, vscode.ConfigurationTarget.Global);
            
            if (!currentAutoSync) {
                syncService.startAutoSync();
                vscode.window.showInformationMessage('自动同步已启用');
            } else {
                syncService.stopAutoSync();
                vscode.window.showInformationMessage('自动同步已禁用');
            }
        }),

        // 新增：配置同步间隔
        vscode.commands.registerCommand('workspaceManager.configureSyncInterval', async () => {
            const config = vscode.workspace.getConfiguration('workspaceManager');
            const currentInterval = config.get<number>('syncInterval', 5);
            
            const newInterval = await vscode.window.showInputBox({
                prompt: '设置自动同步间隔（分钟）',
                value: currentInterval.toString(),
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 60) {
                        return '请输入 1-60 之间的数字';
                    }
                    return null;
                }
            });
            
            if (newInterval) {
                await config.update('syncInterval', parseInt(newInterval), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`同步间隔已设置为 ${newInterval} 分钟`);
                
                // 重启自动同步以应用新间隔
                if (config.get<boolean>('autoSync', true)) {
                    syncService.startAutoSync();
                }
            }
        }),
        
        vscode.commands.registerCommand('workspaceManager.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'workspaceManager');
        }),
        
        vscode.commands.registerCommand('workspaceManager.openWorkspace', async (workspaceId: string) => {
            await workspaceManager.openWorkspace(workspaceId);
        }),
        
        vscode.commands.registerCommand('workspaceManager.addToFavorites', async (workspaceId: string) => {
            await workspaceManager.addToFavorites(workspaceId);
            WorkspaceWebviewPanel.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.removeFromFavorites', async (workspaceId: string) => {
            await workspaceManager.removeFromFavorites(workspaceId);
            WorkspaceWebviewPanel.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.editTags', async (workspaceId: string) => {
            await workspaceManager.editTags(workspaceId);
            WorkspaceWebviewPanel.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.editDescription', async (workspaceId: string) => {
            await workspaceManager.editDescription(workspaceId);
            WorkspaceWebviewPanel.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.removeWorkspace', async (workspaceId: string) => {
            await workspaceManager.removeWorkspace(workspaceId);
            WorkspaceWebviewPanel.refresh();
        }),

        // 新增：在编辑器中打开工作区管理器
        vscode.commands.registerCommand('workspaceManager.openInEditor', () => {
            WorkspaceWebviewPanel.createOrShow(context.extensionUri, workspaceManager);
        })
    ];

    context.subscriptions.push(...commands);
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export function deactivate(): void {
    console.log('Workspace Manager extension is being deactivated...');
}
