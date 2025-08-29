import * as vscode from 'vscode';
import { WorkspaceManager } from './workspaceManager';
import { WorkspaceWebviewProvider } from './webview/workspaceWebviewProvider';
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
    
    // Initialize webview provider
    const webviewProvider = new WorkspaceWebviewProvider(context.extensionUri, workspaceManager);
    
    // Register webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('workspaceManagerView', webviewProvider)
    );

    // Register commands
    registerCommands(context, workspaceManager, webviewProvider);
    
    // Start sync service if auto-sync is enabled
    if (vscode.workspace.getConfiguration('workspaceManager').get('autoSync', true)) {
        syncService.startAutoSync();
    }
    
    console.log('Workspace Manager extension activated successfully!');
}

/**
 * Register all extension commands
 */
function registerCommands(
    context: vscode.ExtensionContext, 
    workspaceManager: WorkspaceManager,
    webviewProvider: WorkspaceWebviewProvider
): void {
    const commands = [
        vscode.commands.registerCommand('workspaceManager.showWorkspaces', () => {
            webviewProvider.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.refreshWorkspaces', async () => {
            await workspaceManager.refreshWorkspaces();
            webviewProvider.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'workspaceManager');
        }),
        
        vscode.commands.registerCommand('workspaceManager.openWorkspace', async (workspaceId: string) => {
            await workspaceManager.openWorkspace(workspaceId);
        }),
        
        vscode.commands.registerCommand('workspaceManager.addToFavorites', async (workspaceId: string) => {
            await workspaceManager.addToFavorites(workspaceId);
            webviewProvider.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.removeFromFavorites', async (workspaceId: string) => {
            await workspaceManager.removeFromFavorites(workspaceId);
            webviewProvider.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.editTags', async (workspaceId: string) => {
            await workspaceManager.editTags(workspaceId);
            webviewProvider.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.editDescription', async (workspaceId: string) => {
            await workspaceManager.editDescription(workspaceId);
            webviewProvider.refresh();
        }),
        
        vscode.commands.registerCommand('workspaceManager.removeWorkspace', async (workspaceId: string) => {
            await workspaceManager.removeWorkspace(workspaceId);
            webviewProvider.refresh();
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
