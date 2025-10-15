import * as vscode from 'vscode';
import { WorkspaceManager } from '../workspaceManager';
import { WorkspaceItem, WorkspaceFilter } from '../types';

/**
 * Webview    private getHtmlForWebview(webview: vscode.Webview): string {
        // Get URIs for resources
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'));
        
        // Get codicon font URI from VS Code
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${codiconsUri}" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>Workspace Manager</title>
</head>`; the workspace manager view
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
            localResourceRoots: [
                this.extensionUri,
                vscode.Uri.joinPath(this.extensionUri, 'media'),
                vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
            ]
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
            
            // Get auto sync configuration
            const config = vscode.workspace.getConfiguration('workspaceManager');
            const autoSync = config.get<boolean>('autoSync', true);
            
            this._view.webview.postMessage({
                type: 'updateWorkspaces',
                workspaces,
                tags,
                config: {
                    autoSync
                }
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

                case 'updateDescription':
                    await this.workspaceManager.updateDescription(data.id, data.description);
                    break;

                case 'removeWorkspace':
                    await this.workspaceManager.removeWorkspace(data.id);
                    break;

                case 'refreshWorkspaces':
                    await this.workspaceManager.refreshWorkspaces();
                    break;

                case 'syncWorkspaces':
                    vscode.commands.executeCommand('workspaceManager.syncWorkspaces');
                    break;

                case 'toggleAutoSync':
                    await vscode.commands.executeCommand('workspaceManager.toggleAutoSync');
                    // Refresh to update button state
                    await this.updateContent();
                    break;

                case 'configureSyncInterval':
                    vscode.commands.executeCommand('workspaceManager.configureSyncInterval');
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
        const tags = await this.workspaceManager.getTags();
        
        // Get auto sync configuration
        const config = vscode.workspace.getConfiguration('workspaceManager');
        const autoSync = config.get<boolean>('autoSync', true);
        
        this._view.webview.postMessage({
            type: 'updateWorkspaces',
            workspaces,
            tags,
            config: {
                autoSync
            }
        });
    }

    /**
     * Get HTML content for webview
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
    // Get URIs for resources
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'));
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'logo.svg'));
    // Use official codicon.css so the font is resolved via its relative URL
    const codiconCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));
    // Also prepare a direct font URL as a fallback (some webview envs resolve relative URLs differently)
    const codiconFontUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf'));
        
        // Add version parameter to force cache refresh
        const version = Date.now();
        
        // Get extension version from package.json
        const extensionVersion = vscode.extensions.getExtension('chsword.chsword-workspace-manager')?.packageJSON.version || '0.0.0';

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:; script-src ${webview.cspSource};">
    <link href="${codiconCssUri}" rel="stylesheet">
    <style>
        /* Fallback to ensure codicon font is available */
        @font-face {
            font-family: "codicon";
            font-display: block;
            src: url("${codiconFontUri}") format("truetype");
        }
    </style>
    <link href="${styleUri}?v=${version}" rel="stylesheet">
    <title>工作区管理器</title>
</head>
<body>
    <div id="app">
        <div class="header">
            <div class="brand">
                <img src="${logoUri}" class="app-logo" alt="Workspace Manager Logo" />
                <span class="brand-name">Workspace Manager</span>
                <span class="version-badge">v${extensionVersion}</span>
            </div>
            <div class="search-container">
                <div class="search-input-wrapper">
                    <span class="codicon codicon-search search-icon" data-emoji="🔍"></span>
                    <input type="text" id="searchInput" placeholder="搜索工作区..." />
                    <button id="clearSearchBtn" class="clear-search-btn" style="display: none;" title="清除搜索">
                        <span class="codicon codicon-close" data-emoji="✖️"></span>
                    </button>
                </div>
            </div>
            <div class="actions">
                <button id="syncBtn" class="icon-button" title="同步 VS Code 历史记录">
                    <span class="codicon codicon-sync" data-emoji="🔁"></span>
                </button>
                <button id="refreshBtn" class="icon-button" title="刷新">
                    <span class="codicon codicon-refresh" data-emoji="🔄"></span>
                </button>
                <button id="autoSyncBtn" class="icon-button" title="切换自动同步">
                    <span class="codicon codicon-sync" data-emoji="🔁"></span>
                </button>
                <button id="settingsBtn" class="icon-button" title="设置">
                    <span class="codicon codicon-settings-gear" data-emoji="⚙️"></span>
                </button>
            </div>
        </div>

        <div class="filters">
            <div class="location-filters">
                <span class="filter-label">
                    <span class="codicon codicon-location" data-emoji="📍"></span>
                    位置
                </span>
                <button class="filter-btn active" data-location="all">
                    <span class="codicon codicon-list-unordered" data-emoji="🗂️"></span>
                    <span>全部</span>
                </button>
                <button class="filter-btn" data-location="local">
                    <span class="codicon codicon-device-desktop" data-emoji="🖥️"></span>
                    <span>本地</span>
                </button>
                <button class="filter-btn" data-location="wsl">
                    <span class="codicon codicon-server" data-emoji="🖧"></span>
                    <span>WSL</span>
                </button>
                <button class="filter-btn" data-location="remote">
                    <span class="codicon codicon-globe" data-emoji="🌐"></span>
                    <span>远程</span>
                </button>
            </div>

            <div class="type-filters">
                <span class="filter-label">
                    <span class="codicon codicon-folder" data-emoji="📁"></span>
                    类型
                </span>
                <button class="type-btn active" data-type="all">
                    <span class="codicon codicon-list-tree" data-emoji="🧾"></span>
                    <span>全部类型</span>
                </button>
                <button class="type-btn" data-type="workspace">
                    <span class="codicon codicon-folder-opened" data-emoji="📂"></span>
                    <span>工作区</span>
                </button>
                <button class="type-btn" data-type="folder">
                    <span class="codicon codicon-folder" data-emoji="📁"></span>
                    <span>文件夹</span>
                </button>
            </div>

            <div class="view-filters">
                <span class="filter-label">
                    <span class="codicon codicon-list-unordered" data-emoji="🗂️"></span>
                    视图
                </span>
                <button class="view-btn active" data-view="all">
                    <span class="codicon codicon-list-unordered" data-emoji="🗂️"></span>
                    <span>全部</span>
                </button>
                <button class="view-btn" data-view="recent">
                    <span class="codicon codicon-watch" data-emoji="⏰"></span>
                    <span>最近</span>
                </button>
                <button class="view-btn" data-view="favorites">
                    <span class="codicon codicon-star-full" data-emoji="⭐"></span>
                    <span>收藏</span>
                </button>
                <button class="view-btn" data-view="pinned">
                    <span class="codicon codicon-bookmark" data-emoji="📌"></span>
                    <span>固定</span>
                </button>
            </div>
        </div>

        <div class="tag-filters">
            <div class="tag-filters-header">
                <span class="codicon codicon-symbol-snippet" data-emoji="🏷️"></span>
                <span>标签</span>
            </div>
            <div id="tagFilters"></div>
        </div>

        <div class="content">
            <div id="workspaceList">
                <div class="loading">
                    <span class="codicon codicon-loading rotating" data-emoji="⏳"></span>
                    <span>加载工作区中...</span>
                </div>
            </div>
        </div>

        <div class="statistics">
            <div id="stats"></div>
        </div>
    </div>

    <script src="${scriptUri}?v=${version}"></script>
</body>
</html>`;
    }
}
