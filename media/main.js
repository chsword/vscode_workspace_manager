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
        type: 'all',
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
        // Detect codicon font availability and set fallback class
        try {
            const codiconOk = (document.fonts && document.fonts.check) ? document.fonts.check('16px "codicon"') : true;
            if (codiconOk) {
                document.body.classList.add('codicon-loaded');
            } else {
                document.body.classList.add('codicon-fallback');
            }
        } catch (_) {
            // If detection fails, prefer graceful fallback
            document.body.classList.add('codicon-fallback');
        }
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
            syncBtn.querySelector('.codicon').classList.add('rotating');
            syncBtn.disabled = true;
            vscode.postMessage({ type: 'syncWorkspaces' });
            
            // Reset button state after a delay
            setTimeout(() => {
                syncBtn.querySelector('.codicon').classList.remove('rotating');
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

        // Type filters
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                setActiveFilter('.type-btn', e.target);
                currentFilter.type = type;
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
                    icon.classList.add('rotating');
                    autoSyncBtn.classList.remove('disabled');
                    autoSyncBtn.classList.add('active');
                    autoSyncBtn.title = '自动同步已启用 - 点击禁用';
                } else {
                    icon.classList.remove('rotating');
                    autoSyncBtn.classList.remove('active');
                    autoSyncBtn.classList.add('disabled');
                    autoSyncBtn.title = '自动同步已禁用 - 点击启用';
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
            tagFilters.innerHTML = '<div style="font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; padding: 8px;">暂无标签</div>';
            return;
        }

        // Sort tags by usage count
        const sortedTags = [...currentTags].sort((a, b) => b.usageCount - a.usageCount);

        let html = '<div class="tag-container">';
        sortedTags.forEach(tag => {
            const isSelected = currentFilter.tags.includes(tag.name);
            const tagIcon = tag.isSystem 
                ? '<span class="codicon codicon-bookmark"></span>' 
                : '<span class="codicon codicon-discount"></span>';
            // 增强未选中标签的对比度
            const bgOpacity = isSelected ? '' : '20';
            const style = isSelected 
                ? '' // 选中时使用 CSS 类样式
                : `background-color: ${tag.color}${bgOpacity}; color: ${tag.color}; border-color: ${tag.color};`;
            
            html += `
                <span class="tag-chip ${isSelected ? 'selected' : ''}" 
                      data-tag="${tag.name}" 
                      style="${style}"
                      title="${tag.description || tag.name}${tag.isSystem ? ' (System)' : ''}">
                    <span class="tag-text">${tagIcon} ${tag.name}${tag.usageCount > 0 ? ` (${tag.usageCount})` : ''}</span>
                </span>
            `;
        });
        html += '</div>';

        tagFilters.innerHTML = html;

        // Add click handlers for tag chips
        tagFilters.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                // Find the tag chip element (in case clicked on child elements)
                const tagChip = e.target.closest('.tag-chip');
                const tagName = tagChip ? tagChip.dataset.tag : e.target.dataset.tag;
                console.log('Tag clicked:', tagName); // Debug log
                if (tagName) {
                    toggleTagFilter(tagName);
                }
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
                    <span class="codicon codicon-folder" style="font-size: 48px; opacity: 0.5;"></span>
                    <div>未找到工作区</div>
                    <div style="font-size: 11px; margin-top: 8px; opacity: 0.7;">
                        ${currentFilter.searchText ? '尝试调整搜索词' : '在 VS Code 中打开一些文件夹或工作区以查看它们'}
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
        let headerIcon = '';
        if (currentFilter.view === 'favorites') {
            headerIcon = '<span class="codicon codicon-star-full"></span>';
            headerText = '收藏夹';
        } else if (currentFilter.view === 'pinned') {
            headerIcon = '<span class="codicon codicon-bookmark"></span>';
            headerText = '已固定';
        } else if (currentFilter.view === 'recent') {
            headerIcon = '<span class="codicon codicon-watch"></span>';
            headerText = '最近使用';
        } else if (currentFilter.searchText) {
            headerIcon = '<span class="codicon codicon-search"></span>';
            headerText = `搜索 "${currentFilter.searchText}" 的结果`;
        } else if (currentFilter.location && currentFilter.location !== 'all') {
            const locationIcons = { 
                local: '<span class="codicon codicon-device-desktop"></span>', 
                wsl: '<span class="codicon codicon-server"></span>', 
                remote: '<span class="codicon codicon-globe"></span>' 
            };
            const locationNames = { local: '本地', wsl: 'WSL', remote: '远程' };
            headerIcon = locationIcons[currentFilter.location] || '<span class="codicon codicon-folder"></span>';
            headerText = locationNames[currentFilter.location] || '工作区';
        } else if (currentFilter.tags && currentFilter.tags.length > 0) {
            headerIcon = '<span class="codicon codicon-symbol-snippet"></span>';
            headerText = `标签: ${currentFilter.tags.join(', ')}`;
        } else {
            headerIcon = '<span class="codicon codicon-folder"></span>';
            headerText = '全部工作区';
        }

        // Render pinned workspaces (if any and not in pinned-only view)
        if (pinnedWorkspaces.length > 0 && currentFilter.view !== 'pinned') {
            html += `<div style="font-size: 12px; font-weight: 500; margin-bottom: 8px; color: var(--vscode-sideBarTitle-foreground); display: flex; align-items: center; gap: 6px;"><span class="codicon codicon-bookmark"></span> 已固定</div>`;
            pinnedWorkspaces.forEach(workspace => {
                html += renderWorkspaceItem(workspace);
            });
        }

        // Render other workspaces with dynamic header
        if (otherWorkspaces.length > 0 || currentFilter.view === 'pinned') {
            const workspacesToShow = currentFilter.view === 'pinned' ? pinnedWorkspaces : otherWorkspaces;
            if (workspacesToShow.length > 0) {
                html += `<div style="font-size: 12px; font-weight: 500; margin-bottom: 8px; ${pinnedWorkspaces.length > 0 && currentFilter.view !== 'pinned' ? 'margin-top: 16px;' : ''} color: var(--vscode-sideBarTitle-foreground); display: flex; align-items: center; gap: 6px;">${headerIcon} ${headerText}</div>`;
                workspacesToShow.forEach(workspace => {
                    html += renderWorkspaceItem(workspace);
                });
            }
        }

        workspaceList.innerHTML = html;

        // Add event listeners
        workspaceList.querySelectorAll('.workspace-item').forEach(item => {
            const workspaceId = item.dataset.workspaceId;
            
            item.addEventListener('click', (e) => {
                // Only handle clicks on the item itself, not on action buttons
                if (e.target.closest('.workspace-actions') || e.target.closest('.action-btn')) {
                    return; // Don't handle workspace opening if clicking on action buttons
                }
                
                // For now, clicking the card does nothing - users should use the open button
                // This prevents accidental workspace opening
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e, workspaceId);
            });

            // 双击编辑描述
            const descriptionEl = item.querySelector('.workspace-description');
            if (descriptionEl) {
                descriptionEl.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    makeDescriptionEditable(descriptionEl, workspaceId);
                });
            }

            // 双击编辑标签
            const tagsContainer = item.querySelector('.workspace-location-and-tags');
            if (tagsContainer) {
                const tags = tagsContainer.querySelectorAll('.workspace-tag-inline');
                tags.forEach(tag => {
                    tag.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        handleWorkspaceAction('editTags', workspaceId);
                    });
                });
            }
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

    // 使描述可编辑
    function makeDescriptionEditable(element, workspaceId) {
        const currentText = element.textContent.replace(/^"|"$/g, '').trim();
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'workspace-description editing';
        input.style.width = '100%';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        input.style.color = 'inherit';
        
        element.replaceWith(input);
        input.focus();
        input.select();

        const save = () => {
            const newText = input.value.trim();
            if (newText !== currentText) {
                // 发送更新请求
                vscode.postMessage({
                    type: 'updateDescription',
                    id: workspaceId,
                    description: newText
                });
            }
            
            const newDesc = document.createElement('div');
            newDesc.className = 'workspace-description';
            newDesc.textContent = newText ? `"${newText}"` : '';
            input.replaceWith(newDesc);
            
            // 重新添加双击事件
            newDesc.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                makeDescriptionEditable(newDesc, workspaceId);
            });
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                save();
            } else if (e.key === 'Escape') {
                const newDesc = document.createElement('div');
                newDesc.className = 'workspace-description';
                newDesc.textContent = currentText ? `"${currentText}"` : '';
                input.replaceWith(newDesc);
                
                newDesc.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    makeDescriptionEditable(newDesc, workspaceId);
                });
            }
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
                        <button class="action-btn open-btn" data-action="openWorkspace" 
                                title="打开工作区">
                            <span class="codicon codicon-folder-opened"></span>
                        </button>
                        <button class="action-btn" data-action="${workspace.isFavorite ? 'removeFromFavorites' : 'addToFavorites'}" 
                                title="${workspace.isFavorite ? '取消收藏' : '添加到收藏'}">
                            <span class="codicon codicon-star${workspace.isFavorite ? '-full' : ''}"></span>
                        </button>
                        <button class="action-btn" data-action="${workspace.isPinned ? 'unpinWorkspace' : 'pinWorkspace'}" 
                                title="${workspace.isPinned ? '取消固定' : '固定到顶部'}">
                            <span class="codicon codicon-bookmark"></span>
                        </button>
                        <button class="action-btn" data-action="editTags" title="编辑标签">
                            <span class="codicon codicon-symbol-snippet"></span>
                        </button>
                        <button class="action-btn" data-action="editDescription" title="编辑描述">
                            <span class="codicon codicon-edit"></span>
                        </button>
                        <button class="action-btn" data-action="removeWorkspace" title="从列表中移除">
                            <span class="codicon codicon-delete"></span>
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
            { label: '<span class="codicon codicon-multiple-windows"></span> 新窗口打开', action: 'openInNewWindow' },
            { label: '<span class="codicon codicon-folder-opened"></span> 当前窗口打开', action: 'openInCurrent' },
            { separator: true },
            { label: `<span class="codicon codicon-star${workspace.isFavorite ? '-full' : ''}"></span> ${workspace.isFavorite ? '取消收藏' : '添加到收藏'}`, action: workspace.isFavorite ? 'removeFromFavorites' : 'addToFavorites' },
            { label: '<span class="codicon codicon-bookmark"></span> 固定/取消固定', action: workspace.isPinned ? 'unpinWorkspace' : 'pinWorkspace' },
            { label: '<span class="codicon codicon-symbol-snippet"></span> 编辑标签', action: 'editTags' },
            { label: '<span class="codicon codicon-edit"></span> 编辑描述', action: 'editDescription' },
            { separator: true },
            { label: '<span class="codicon codicon-delete"></span> 从列表中移除', action: 'removeWorkspace' }
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
            'openWorkspace': { type: 'openWorkspace', id: workspaceId, newWindow: false },
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
            总计: ${totalWorkspaces} • 
            最近: ${recentWorkspaces} • 
            收藏: ${favoriteWorkspaces} • 
            固定: ${pinnedWorkspaces}
        `;
    }

    // Utility functions
    function getLocationIcon(locationType) {
        const icons = {
            'local': '<span class="codicon codicon-laptop"></span>',
            'wsl': '<span class="codicon codicon-server"></span>',
            'remote': '<span class="codicon codicon-internet"></span>'
        };
        return icons[locationType] || '<span class="codicon codicon-folder"></span>';
    }

    function getTypeIcon(type) {
        const icons = {
            'workspace': '<span class="codicon codicon-folder-open"></span>',
            'folder': '<span class="codicon codicon-folder"></span>'
        };
        return icons[type] || '<span class="codicon codicon-folder"></span>';
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
