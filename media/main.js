// @ts-check

/**
 * VS Code Webview for Workspace Manager
 */
(function() {
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // State management
    let currentWorkspaces = [];
    let currentTags = [];
    let currentFilter = {
        searchText: '',
        location: 'all',
        view: 'all',
        tags: []
    };

    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const syncBtn = document.getElementById('syncBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const autoSyncBtn = document.getElementById('autoSyncBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const workspaceList = document.getElementById('workspaceList');
    const tagFilters = document.getElementById('tagFilters');
    const stats = document.getElementById('stats');

    // Initialize
    function init() {
        setupEventListeners();
        setupMessageHandling();
        
        // Request initial data
        vscode.postMessage({ type: 'ready' });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search input with real-time filtering
        searchInput.addEventListener('input', (e) => {
            const searchText = e.target.value;
            currentFilter.searchText = searchText;
            
            console.log('Search input changed:', searchText); // Debug log
            
            // Show/hide clear button
            if (clearSearchBtn) {
                clearSearchBtn.style.display = searchText ? 'flex' : 'none';
            }
            
            // Real-time filtering (no debounce for immediate response)
            filterWorkspaces();
        });

        // Clear search button
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                currentFilter.searchText = '';
                clearSearchBtn.style.display = 'none';
                filterWorkspaces();
                searchInput.focus();
            });
        }

        // Refresh button
        refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'refreshWorkspaces' });
        });

        // Sync button
        syncBtn.addEventListener('click', () => {
            syncBtn.querySelector('.codicon').classList.add('codicon-loading');
            syncBtn.disabled = true;
            vscode.postMessage({ type: 'syncWorkspaces' });
            
            // Reset button state after a delay
            setTimeout(() => {
                syncBtn.querySelector('.codicon').classList.remove('codicon-loading');
                syncBtn.disabled = false;
            }, 2000);
        });

        // Auto sync toggle button
        autoSyncBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'toggleAutoSync' });
        });

        // Settings button
        settingsBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'openSettings' });
        });

        // Location filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const location = e.target.dataset.location;
                setActiveFilter('.filter-btn', e.target);
                currentFilter.location = location;
                filterWorkspaces();
            });
        });

        // View filters
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                setActiveFilter('.view-btn', e.target);
                currentFilter.view = view;
                filterWorkspaces();
            });
        });

        // Context menu handling
        document.addEventListener('click', (e) => {
            // Close any open context menus
            const existingMenu = document.querySelector('.context-menu');
            if (existingMenu) {
                existingMenu.remove();
            }
        });
    }

    // Setup message handling from extension
    function setupMessageHandling() {
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'updateWorkspaces':
                    currentWorkspaces = message.workspaces || [];
                    if (message.tags) {
                        currentTags = message.tags;
                        renderTagFilters();
                    }
                    // Update auto sync button state
                    if (message.config) {
                        updateAutoSyncButton(message.config.autoSync);
                    }
                    renderWorkspaces();
                    updateStatistics();
                    break;
                    
                default:
                    console.warn('Unknown message type:', message.type);
            }
        });
    }

    // Set active filter button
    function setActiveFilter(selector, activeBtn) {
        document.querySelectorAll(selector).forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }

    // Update auto sync button state
    function updateAutoSyncButton(isEnabled) {
        if (autoSyncBtn) {
            const icon = autoSyncBtn.querySelector('.codicon');
            if (icon) {
                if (isEnabled) {
                    icon.className = 'codicon codicon-sync';
                    autoSyncBtn.classList.add('active');
                    autoSyncBtn.title = 'Auto Sync Enabled - Click to disable';
                } else {
                    icon.className = 'codicon codicon-sync-ignored';
                    autoSyncBtn.classList.remove('active');
                    autoSyncBtn.title = 'Auto Sync Disabled - Click to enable';
                }
            }
        }
    }

    // Filter workspaces based on current filter
    function filterWorkspaces() {
        console.log('Filtering workspaces with:', currentFilter); // Debug log
        vscode.postMessage({
            type: 'filterWorkspaces',
            filter: currentFilter
        });
    }

    // Render tag filters
    function renderTagFilters() {
        if (!currentTags.length) {
            tagFilters.innerHTML = '';
            return;
        }

        // Sort tags by usage count
        const sortedTags = [...currentTags].sort((a, b) => b.usageCount - a.usageCount);
        
        const systemTags = sortedTags.filter(tag => tag.isSystem);
        const customTags = sortedTags.filter(tag => !tag.isSystem);

        let html = '';
        
        if (systemTags.length > 0) {
            html += '<div style="font-size: 10px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">System Tags:</div>';
            html += '<div class="tag-container">';
            systemTags.forEach(tag => {
                const isSelected = currentFilter.tags.includes(tag.name);
                html += `
                    <span class="tag-chip ${isSelected ? 'selected' : ''}" 
                          data-tag="${tag.name}" 
                          style="background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}40;"
                          title="${tag.description || tag.name}">
                        ${tag.name}
                        ${tag.usageCount > 0 ? `<span style="opacity: 0.7;">(${tag.usageCount})</span>` : ''}
                    </span>
                `;
            });
            html += '</div>';
        }

        if (customTags.length > 0) {
            html += '<div style="font-size: 10px; color: var(--vscode-descriptionForeground); margin: 8px 0 4px;">Custom Tags:</div>';
            html += '<div class="tag-container">';
            customTags.forEach(tag => {
                const isSelected = currentFilter.tags.includes(tag.name);
                html += `
                    <span class="tag-chip ${isSelected ? 'selected' : ''}" 
                          data-tag="${tag.name}" 
                          style="background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}40;"
                          title="${tag.description || tag.name}">
                        ${tag.name}
                        ${tag.usageCount > 0 ? `<span style="opacity: 0.7;">(${tag.usageCount})</span>` : ''}
                    </span>
                `;
            });
            html += '</div>';
        }

        tagFilters.innerHTML = html;

        // Add click handlers for tag chips
        tagFilters.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagName = e.target.dataset.tag;
                console.log('Tag clicked:', tagName); // Debug log
                toggleTagFilter(tagName);
            });
        });
    }

    // Toggle tag filter
    function toggleTagFilter(tagName) {
        if (!currentFilter.tags) {
            currentFilter.tags = [];
        }
        
        const index = currentFilter.tags.indexOf(tagName);
        if (index > -1) {
            currentFilter.tags.splice(index, 1);
        } else {
            currentFilter.tags.push(tagName);
        }
        
        console.log('Updated filter tags:', currentFilter.tags); // Debug log
        filterWorkspaces();
        renderTagFilters(); // Re-render tag filters to update selected state
    }

    // Render workspaces
    function renderWorkspaces() {
        if (!currentWorkspaces.length) {
            workspaceList.innerHTML = `
                <div class="empty-state">
                    <div class="codicon codicon-folder"></div>
                    <div>No workspaces found</div>
                    <div style="font-size: 11px; margin-top: 8px; opacity: 0.7;">
                        ${currentFilter.searchText ? 'Try adjusting your search terms' : 'Open some folders or workspaces in VS Code to see them here'}
                    </div>
                </div>
            `;
            return;
        }

        // Group workspaces
        const pinnedWorkspaces = currentWorkspaces.filter(w => w.isPinned);
        const otherWorkspaces = currentWorkspaces.filter(w => !w.isPinned);

        let html = '';

        // Generate dynamic header based on current filter
        let headerText = '';
        if (currentFilter.view === 'favorites') {
            headerText = '⭐ Favorites';
        } else if (currentFilter.view === 'pinned') {
            headerText = '📌 Pinned';
        } else if (currentFilter.view === 'recent') {
            headerText = '📋 Recent';
        } else if (currentFilter.searchText) {
            headerText = `🔍 Search results for "${currentFilter.searchText}"`;
        } else if (currentFilter.location && currentFilter.location !== 'all') {
            const locationNames = { local: '💻 Local', wsl: '🐧 WSL', remote: '🌐 Remote' };
            headerText = locationNames[currentFilter.location] || '📁 Workspaces';
        } else if (currentFilter.tags && currentFilter.tags.length > 0) {
            headerText = `🏷️ Tagged: ${currentFilter.tags.join(', ')}`;
        } else {
            headerText = '📁 All Workspaces';
        }

        // Render pinned workspaces (if any and not in pinned-only view)
        if (pinnedWorkspaces.length > 0 && currentFilter.view !== 'pinned') {
            html += `<div style="font-size: 12px; font-weight: 500; margin-bottom: 8px; color: var(--vscode-sideBarTitle-foreground);">📌 Pinned</div>`;
            pinnedWorkspaces.forEach(workspace => {
                html += renderWorkspaceItem(workspace);
            });
        }

        // Render other workspaces with dynamic header
        if (otherWorkspaces.length > 0 || currentFilter.view === 'pinned') {
            const workspacesToShow = currentFilter.view === 'pinned' ? pinnedWorkspaces : otherWorkspaces;
            if (workspacesToShow.length > 0) {
                html += `<div style="font-size: 12px; font-weight: 500; margin-bottom: 8px; ${pinnedWorkspaces.length > 0 && currentFilter.view !== 'pinned' ? 'margin-top: 16px;' : ''} color: var(--vscode-sideBarTitle-foreground);">${headerText}</div>`;
                workspacesToShow.forEach(workspace => {
                    html += renderWorkspaceItem(workspace);
                });
            }
        }

        workspaceList.innerHTML = html;

        // Add event listeners
        workspaceList.querySelectorAll('.workspace-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.workspace-actions') || e.target.closest('.action-btn')) {
                    return; // Don't open workspace if clicking on action buttons
                }
                
                const workspaceId = item.dataset.workspaceId;
                const newWindow = e.ctrlKey || e.metaKey;
                
                vscode.postMessage({
                    type: 'openWorkspace',
                    id: workspaceId,
                    newWindow
                });
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e, item.dataset.workspaceId);
            });
        });

        // Add action button listeners
        workspaceList.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const workspaceId = btn.closest('.workspace-item').dataset.workspaceId;
                handleWorkspaceAction(action, workspaceId);
            });
        });
    }

    // Render single workspace item
    function renderWorkspaceItem(workspace) {
        const locationIcon = getLocationIcon(workspace.location.type);
        const typeIcon = getTypeIcon(workspace.type);
        const lastOpened = formatLastOpened(workspace.lastOpened);
        
        const tagsHtml = workspace.tags.map(tagName => {
            const tag = currentTags.find(t => t.name === tagName);
            const color = tag ? tag.color : '#666';
            return `<span class="workspace-tag" style="background-color: ${color}20; color: ${color}; border-color: ${color}40;">${tagName}</span>`;
        }).join('');

        return `
            <div class="workspace-item ${workspace.isPinned ? 'pinned' : ''} ${workspace.isFavorite ? 'favorite' : ''}" 
                 data-workspace-id="${workspace.id}">
                <div class="workspace-header">
                    <div class="workspace-name">
                        <span class="workspace-type workspace-type-${workspace.type}">${typeIcon}</span>
                        ${escapeHtml(workspace.name)}
                    </div>
                    <div class="workspace-actions">
                        <button class="action-btn" data-action="${workspace.isFavorite ? 'removeFromFavorites' : 'addToFavorites'}" 
                                title="${workspace.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <span class="codicon codicon-star${workspace.isFavorite ? '-full' : '-empty'}"></span>
                        </button>
                        <button class="action-btn" data-action="${workspace.isPinned ? 'unpinWorkspace' : 'pinWorkspace'}" 
                                title="${workspace.isPinned ? 'Unpin' : 'Pin to top'}">
                            <span class="codicon codicon-pin${workspace.isPinned ? '' : ''}"></span>
                        </button>
                        <button class="action-btn" data-action="editTags" title="Edit tags">
                            <span class="codicon codicon-tag"></span>
                        </button>
                        <button class="action-btn" data-action="editDescription" title="Edit description">
                            <span class="codicon codicon-edit"></span>
                        </button>
                        <button class="action-btn" data-action="removeWorkspace" title="Remove from list">
                            <span class="codicon codicon-trash"></span>
                        </button>
                    </div>
                </div>
                
                ${workspace.description ? `<div class="workspace-description">"${escapeHtml(workspace.description)}"</div>` : ''}
                
                <div class="workspace-path">${escapeHtml(workspace.path)}</div>
                
                <div class="workspace-meta">
                    <div class="workspace-location-and-tags">
                        <span class="workspace-location">${locationIcon} ${workspace.location.displayName}</span>
                        ${workspace.tags.length > 0 ? workspace.tags.map(tagName => {
                            const tag = currentTags.find(t => t.name === tagName);
                            const color = tag ? tag.color : '#666';
                            return `<span class="workspace-tag-inline" style="background-color: ${color}20; color: ${color}; border-color: ${color}40;">${tagName}</span>`;
                        }).join('') : ''}
                    </div>
                    <span class="workspace-time">${lastOpened}</span>
                </div>
            </div>
        `;
    }

    // Show context menu
    function showContextMenu(event, workspaceId) {
        const workspace = currentWorkspaces.find(w => w.id === workspaceId);
        if (!workspace) return;

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        const menuItems = [
            { label: '🚀 Open in New Window', action: 'openInNewWindow' },
            { label: '📂 Open in Current Window', action: 'openInCurrent' },
            { separator: true },
            { label: `${workspace.isFavorite ? '★' : '☆'} ${workspace.isFavorite ? 'Remove from' : 'Add to'} Favorites`, action: workspace.isFavorite ? 'removeFromFavorites' : 'addToFavorites' },
            { label: `📌 ${workspace.isPinned ? 'Unpin' : 'Pin to Top'}`, action: workspace.isPinned ? 'unpinWorkspace' : 'pinWorkspace' },
            { label: '🏷️ Edit Tags', action: 'editTags' },
            { label: '📝 Edit Description', action: 'editDescription' },
            { separator: true },
            { label: '🗑️ Remove from List', action: 'removeWorkspace' }
        ];

        let menuHtml = '';
        menuItems.forEach(item => {
            if (item.separator) {
                menuHtml += '<div class="context-menu-separator"></div>';
            } else {
                menuHtml += `<div class="context-menu-item" data-action="${item.action}">${item.label}</div>`;
            }
        });

        menu.innerHTML = menuHtml;
        document.body.appendChild(menu);

        // Add click handlers
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.target.dataset.action;
                handleWorkspaceAction(action, workspaceId);
                menu.remove();
            });
        });

        // Remove menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', () => {
                if (menu.parentNode) {
                    menu.remove();
                }
            }, { once: true });
        }, 0);
    }

    // Handle workspace actions
    function handleWorkspaceAction(action, workspaceId) {
        const messageMap = {
            'addToFavorites': { type: 'addToFavorites', id: workspaceId },
            'removeFromFavorites': { type: 'removeFromFavorites', id: workspaceId },
            'pinWorkspace': { type: 'pinWorkspace', id: workspaceId },
            'unpinWorkspace': { type: 'unpinWorkspace', id: workspaceId },
            'editTags': { type: 'editTags', id: workspaceId },
            'editDescription': { type: 'editDescription', id: workspaceId },
            'removeWorkspace': { type: 'removeWorkspace', id: workspaceId },
            'openInNewWindow': { type: 'openWorkspace', id: workspaceId, newWindow: true },
            'openInCurrent': { type: 'openWorkspace', id: workspaceId, newWindow: false }
        };

        const message = messageMap[action];
        if (message) {
            vscode.postMessage(message);
        }
    }

    // Update statistics
    function updateStatistics() {
        const totalWorkspaces = currentWorkspaces.length;
        const favoriteWorkspaces = currentWorkspaces.filter(w => w.isFavorite).length;
        const pinnedWorkspaces = currentWorkspaces.filter(w => w.isPinned).length;
        
        const recentWorkspaces = currentWorkspaces.filter(w => {
            const lastOpened = new Date(w.lastOpened);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return lastOpened > weekAgo;
        }).length;

        stats.innerHTML = `
            Total: ${totalWorkspaces} • 
            Recent: ${recentWorkspaces} • 
            Favorites: ${favoriteWorkspaces} • 
            Pinned: ${pinnedWorkspaces}
        `;
    }

    // Utility functions
    function getLocationIcon(locationType) {
        const icons = {
            'local': '💻',
            'wsl': '🐧',
            'remote': '🌐'
        };
        return icons[locationType] || '📁';
    }

    function getTypeIcon(type) {
        const icons = {
            'workspace': '📂',
            'folder': '📁',
            'file': '📄'
        };
        return icons[type] || '📁';
    }

    function formatLastOpened(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
