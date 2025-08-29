import * as vscode from 'vscode';
import { WorkspaceManager } from '../workspaceManager';

/**
 * Webview panel for displaying workspace manager in editor area
 */
export class WorkspaceWebviewPanel {
    public static readonly viewType = 'workspaceManagerPanel';
    private static currentPanel: WorkspaceWebviewPanel | undefined;

    public static createOrShow(extensionUri: vscode.Uri, workspaceManager: WorkspaceManager): void {
        // Always open in the main editor area
        const column = vscode.ViewColumn.One;

        // If panel already exists, show it
        if (WorkspaceWebviewPanel.currentPanel) {
            WorkspaceWebviewPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Create new panel in editor area
        const panel = vscode.window.createWebviewPanel(
            WorkspaceWebviewPanel.viewType,
            'Workspace Manager',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        WorkspaceWebviewPanel.currentPanel = new WorkspaceWebviewPanel(panel, extensionUri, workspaceManager);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, workspaceManager: WorkspaceManager): void {
        WorkspaceWebviewPanel.currentPanel = new WorkspaceWebviewPanel(panel, extensionUri, workspaceManager);
    }

    private constructor(
        public readonly panel: vscode.WebviewPanel,
        private readonly extensionUri: vscode.Uri,
        private readonly workspaceManager: WorkspaceManager
    ) {
        this.update();
        this.panel.onDidDispose(() => this.dispose(), null);
        this.panel.onDidChangeViewState(() => {
            if (this.panel.visible) {
                this.update();
            }
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined
        );
    }

    public dispose(): void {
        WorkspaceWebviewPanel.currentPanel = undefined;
        this.panel.dispose();
    }

    public refresh(): void {
        this.update();
    }

    private async update(): Promise<void> {
        this.panel.title = 'Workspace Manager';
        this.panel.webview.html = this.getHtmlForWebview();
        
        // Send initial data
        try {
            const workspaces = await this.workspaceManager.getWorkspaces();
            const tags = await this.workspaceManager.getTags();
            
            this.panel.webview.postMessage({
                type: 'updateWorkspaces',
                workspaces,
                tags
            });
        } catch (error) {
            console.error('Failed to update webview panel:', error);
        }
    }

    private async handleMessage(data: any): Promise<void> {
        try {
            switch (data.type) {
                case 'openWorkspace':
                    await this.workspaceManager.openWorkspace(data.id, data.newWindow);
                    break;

                case 'addToFavorites':
                    await this.workspaceManager.addToFavorites(data.id);
                    this.refresh();
                    break;

                case 'removeFromFavorites':
                    await this.workspaceManager.removeFromFavorites(data.id);
                    this.refresh();
                    break;

                case 'editTags':
                    await this.workspaceManager.editTags(data.id);
                    this.refresh();
                    break;

                case 'editDescription':
                    await this.workspaceManager.editDescription(data.id);
                    this.refresh();
                    break;

                case 'removeWorkspace':
                    await this.workspaceManager.removeWorkspace(data.id);
                    this.refresh();
                    break;

                case 'refreshWorkspaces':
                    await this.workspaceManager.refreshWorkspaces();
                    this.refresh();
                    break;

                case 'syncWorkspaces':
                    await vscode.commands.executeCommand('workspaceManager.syncWorkspaces');
                    this.refresh();
                    break;

                case 'toggleAutoSync':
                    await vscode.commands.executeCommand('workspaceManager.toggleAutoSync');
                    break;

                case 'openSettings':
                    await vscode.commands.executeCommand('workspaceManager.openSettings');
                    break;

                case 'ready':
                    this.update();
                    break;
            }
        } catch (error) {
            console.error('Error handling webview message:', error);
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    }

    private getHtmlForWebview(): string {
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js')
        );
        const styleUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src ${this.panel.webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>Workspace Manager</title>
    <style>
        body {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            margin-bottom: 20px;
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 15px;
        }
        .header h1 {
            margin: 0 0 10px 0;
            color: var(--vscode-foreground);
            font-size: 24px;
        }
        .workspace-item {
            margin-bottom: 10px;
            padding: 15px;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div id="app">
        <div class="header">
            <h1>📁 Workspace Manager</h1>
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="🔍 Search workspaces..." />
            </div>
            <div class="actions">
                <button id="syncBtn" class="icon-button" title="Sync VS Code History">
                    <span class="codicon codicon-sync"></span>
                </button>
                <button id="refreshBtn" class="icon-button" title="Refresh">
                    <span class="codicon codicon-refresh"></span>
                </button>
                <button id="autoSyncBtn" class="icon-button" title="Toggle Auto Sync">
                    <span class="codicon codicon-sync-ignored"></span>
                </button>
                <button id="settingsBtn" class="icon-button" title="Settings">
                    <span class="codicon codicon-gear"></span>
                </button>
            </div>
        </div>

        <div class="filters">
            <div class="location-filters">
                <button class="filter-btn active" data-location="all">All</button>
                <button class="filter-btn" data-location="local">📂 Local</button>
                <button class="filter-btn" data-location="wsl">🐧 WSL</button>
                <button class="filter-btn" data-location="remote">🌐 Remote</button>
            </div>
            
            <div class="view-filters">
                <button class="view-btn active" data-view="recent">📋 Recent</button>
                <button class="view-btn" data-view="favorites">⭐ Favorites</button>
                <button class="view-btn" data-view="pinned">📌 Pinned</button>
            </div>
        </div>

        <div class="tag-filters">
            <div id="tagFilters"></div>
        </div>

        <div class="content">
            <div id="workspaceList">
                <div class="loading">
                    <span class="codicon codicon-loading"></span>
                    Loading workspaces...
                </div>
            </div>
        </div>

        <div class="statistics">
            <div id="stats"></div>
        </div>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
