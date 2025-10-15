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

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>工作区管理器</title>
</head>
<body>
    <div id="app">
        <div class="header">
            <div class="search-container">
                <div class="search-input-wrapper">
                    <i class="t-icon t-icon-search search-icon"></i>
                    <input type="text" id="searchInput" placeholder="搜索工作区..." />
                    <button id="clearSearchBtn" class="clear-search-btn" style="display: none;" title="清除搜索">
                        <i class="t-icon t-icon-close"></i>
                    </button>
                </div>
            </div>
            <div class="actions">
                <button id="syncBtn" class="icon-button" title="同步 VS Code 历史记录">
                    <i class="t-icon t-icon-refresh"></i>
                </button>
                <button id="refreshBtn" class="icon-button" title="刷新">
                    <i class="t-icon t-icon-rollback"></i>
                </button>
                <button id="autoSyncBtn" class="icon-button" title="切换自动同步">
                    <i class="t-icon t-icon-swap"></i>
                </button>
                <button id="settingsBtn" class="icon-button" title="设置">
                    <i class="t-icon t-icon-setting"></i>
                </button>
            </div>
        </div>

        <div class="filters">
            <div class="location-filters">
                <span class="filter-label">
                    <i class="t-icon t-icon-location"></i>
                    位置
                </span>
                <button class="filter-btn active" data-location="all">
                    <i class="t-icon t-icon-view-list"></i>
                    <span>全部</span>
                </button>
                <button class="filter-btn" data-location="local">
                    <i class="t-icon t-icon-laptop"></i>
                    <span>本地</span>
                </button>
                <button class="filter-btn" data-location="wsl">
                    <i class="t-icon t-icon-server"></i>
                    <span>WSL</span>
                </button>
                <button class="filter-btn" data-location="remote">
                    <i class="t-icon t-icon-internet"></i>
                    <span>远程</span>
                </button>
            </div>

            <div class="type-filters">
                <span class="filter-label">
                    <i class="t-icon t-icon-folder"></i>
                    类型
                </span>
                <button class="type-btn active" data-type="all">
                    <i class="t-icon t-icon-view-module"></i>
                    <span>全部类型</span>
                </button>
                <button class="type-btn" data-type="workspace">
                    <i class="t-icon t-icon-folder-open"></i>
                    <span>工作区</span>
                </button>
                <button class="type-btn" data-type="folder">
                    <i class="t-icon t-icon-folder"></i>
                    <span>文件夹</span>
                </button>
            </div>

            <div class="view-filters">
                <span class="filter-label">
                    <i class="t-icon t-icon-view-list"></i>
                    视图
                </span>
                <button class="view-btn active" data-view="all">
                    <i class="t-icon t-icon-view-list"></i>
                    <span>全部</span>
                </button>
                <button class="view-btn" data-view="recent">
                    <i class="t-icon t-icon-time"></i>
                    <span>最近</span>
                </button>
                <button class="view-btn" data-view="favorites">
                    <i class="t-icon t-icon-star-filled"></i>
                    <span>收藏</span>
                </button>
                <button class="view-btn" data-view="pinned">
                    <i class="t-icon t-icon-pin-filled"></i>
                    <span>固定</span>
                </button>
            </div>
        </div>

        <div class="tag-filters">
            <div class="tag-filters-header">
                <i class="t-icon t-icon-discount"></i>
                <span>标签</span>
            </div>
            <div id="tagFilters"></div>
        </div>

        <div class="content">
            <div id="workspaceList">
                <div class="loading">
                    <i class="t-icon t-icon-loading rotating"></i>
                    <span>加载工作区中...</span>
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
