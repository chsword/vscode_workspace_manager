import * as vscode from 'vscode';
import { WorkspaceManager } from '../workspaceManager';
import { WorkspaceItem, WorkspaceFilter } from '../types';

/**
 * Webview provider for the workspace manager view
 */
export class WorkspaceWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'workspaceManagerView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly workspaceManager: WorkspaceManager
    ) {
        // Listen for workspace changes
        this.workspaceManager.onWorkspacesChanged(() => {
            this.refresh();
        });
    }

    /**
     * Resolve webview view
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this.handleMessage(data);
        });

        // Initial load
        this.updateContent();
    }

    /**
     * Refresh the webview content
     */
    public refresh(): void {
        if (this._view) {
            this.updateContent();
        }
    }

    /**
     * Update webview content with current workspace data
     */
    private async updateContent(): Promise<void> {
        if (!this._view) {
            return;
        }

        try {
            const workspaces = await this.workspaceManager.getWorkspaces();
            const tags = await this.workspaceManager.getTags();
            
            this._view.webview.postMessage({
                type: 'updateWorkspaces',
                workspaces,
                tags
            });
        } catch (error) {
            console.error('Failed to update webview content:', error);
        }
    }

    /**
     * Handle messages from webview
     */
    private async handleMessage(data: any): Promise<void> {
        try {
            switch (data.type) {
                case 'openWorkspace':
                    await this.workspaceManager.openWorkspace(data.id, data.newWindow);
                    break;

                case 'addToFavorites':
                    await this.workspaceManager.addToFavorites(data.id);
                    break;

                case 'removeFromFavorites':
                    await this.workspaceManager.removeFromFavorites(data.id);
                    break;

                case 'pinWorkspace':
                    await this.workspaceManager.pinWorkspace(data.id);
                    break;

                case 'unpinWorkspace':
                    await this.workspaceManager.unpinWorkspace(data.id);
                    break;

                case 'editTags':
                    await this.workspaceManager.editTags(data.id);
                    break;

                case 'editDescription':
                    await this.workspaceManager.editDescription(data.id);
                    break;

                case 'removeWorkspace':
                    await this.workspaceManager.removeWorkspace(data.id);
                    break;

                case 'refreshWorkspaces':
                    await this.workspaceManager.refreshWorkspaces();
                    break;

                case 'filterWorkspaces':
                    await this.handleFilterWorkspaces(data.filter);
                    break;

                case 'ready':
                    await this.updateContent();
                    break;

                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling webview message:', error);
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    }

    /**
     * Handle workspace filtering
     */
    private async handleFilterWorkspaces(filter: WorkspaceFilter): Promise<void> {
        if (!this._view) {
            return;
        }

        const workspaces = await this.workspaceManager.getWorkspaces(filter);
        
        this._view.webview.postMessage({
            type: 'updateWorkspaces',
            workspaces
        });
    }

    /**
     * Get HTML content for webview
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        // Get URIs for resources
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Workspace Manager</title>
</head>
<body>
    <div id="app">
        <div class="header">
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="🔍 Search workspaces..." />
            </div>
            <div class="actions">
                <button id="refreshBtn" class="icon-button" title="Refresh">
                    <span class="codicon codicon-refresh"></span>
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
