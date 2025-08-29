import * as vscode from 'vscode';
import { WorkspaceItem, Tag, SYSTEM_TAGS } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages storage of workspace data using VS Code's storage APIs
 */
export class WorkspaceStorage {
    private readonly WORKSPACES_KEY = 'workspaces';
    private readonly TAGS_KEY = 'tags';
    private readonly SETTINGS_KEY = 'settings';

    constructor(private readonly context: vscode.ExtensionContext) {
        this.initializeDefaultTags();
    }

    /**
     * Initialize system tags if they don't exist
     */
    private async initializeDefaultTags(): Promise<void> {
        const existingTags = await this.getTags();
        const systemTagIds = new Set(existingTags.filter(tag => tag.isSystem).map(tag => tag.name.toLowerCase()));

        const tagsToAdd: Tag[] = [];
        
        for (const [key, tagData] of Object.entries(SYSTEM_TAGS)) {
            if (!systemTagIds.has(tagData.name.toLowerCase())) {
                tagsToAdd.push({
                    id: uuidv4(),
                    ...tagData,
                    usageCount: 0
                });
            }
        }

        if (tagsToAdd.length > 0) {
            const updatedTags = [...existingTags, ...tagsToAdd];
            await this.saveTags(updatedTags);
        }
    }

    /**
     * Get all workspace items
     */
    async getWorkspaces(): Promise<WorkspaceItem[]> {
        return this.context.globalState.get<WorkspaceItem[]>(this.WORKSPACES_KEY, []);
    }

    /**
     * Save workspace items
     */
    async saveWorkspaces(workspaces: WorkspaceItem[]): Promise<void> {
        await this.context.globalState.update(this.WORKSPACES_KEY, workspaces);
    }

    /**
     * Add or update a workspace item
     */
    async saveWorkspace(workspace: WorkspaceItem): Promise<void> {
        const workspaces = await this.getWorkspaces();
        const existingIndex = workspaces.findIndex(w => w.id === workspace.id);
        
        if (existingIndex >= 0) {
            workspaces[existingIndex] = workspace;
        } else {
            workspaces.push(workspace);
        }

        await this.saveWorkspaces(workspaces);
    }

    /**
     * Get a workspace by ID
     */
    async getWorkspace(id: string): Promise<WorkspaceItem | undefined> {
        const workspaces = await this.getWorkspaces();
        return workspaces.find(w => w.id === id);
    }

    /**
     * Remove a workspace
     */
    async removeWorkspace(id: string): Promise<void> {
        const workspaces = await this.getWorkspaces();
        const filteredWorkspaces = workspaces.filter(w => w.id !== id);
        await this.saveWorkspaces(filteredWorkspaces);
    }

    /**
     * Get all tags
     */
    async getTags(): Promise<Tag[]> {
        return this.context.globalState.get<Tag[]>(this.TAGS_KEY, []);
    }

    /**
     * Save tags
     */
    async saveTags(tags: Tag[]): Promise<void> {
        await this.context.globalState.update(this.TAGS_KEY, tags);
    }

    /**
     * Add or update a tag
     */
    async saveTag(tag: Tag): Promise<void> {
        const tags = await this.getTags();
        const existingIndex = tags.findIndex(t => t.id === tag.id);
        
        if (existingIndex >= 0) {
            tags[existingIndex] = tag;
        } else {
            tags.push(tag);
        }

        await this.saveTags(tags);
    }

    /**
     * Get a tag by ID
     */
    async getTag(id: string): Promise<Tag | undefined> {
        const tags = await this.getTags();
        return tags.find(t => t.id === id);
    }

    /**
     * Remove a tag
     */
    async removeTag(id: string): Promise<void> {
        const tags = await this.getTags();
        const filteredTags = tags.filter(t => t.id !== id);
        await this.saveTags(filteredTags);
    }

    /**
     * Get tags by names
     */
    async getTagsByNames(names: string[]): Promise<Tag[]> {
        const tags = await this.getTags();
        return tags.filter(tag => names.includes(tag.name));
    }

    /**
     * Increment tag usage count
     */
    async incrementTagUsage(tagName: string): Promise<void> {
        const tags = await this.getTags();
        const tag = tags.find(t => t.name === tagName);
        
        if (tag) {
            tag.usageCount++;
            await this.saveTags(tags);
        }
    }

    /**
     * Clear all data (for testing/reset purposes)
     */
    async clearAll(): Promise<void> {
        await this.context.globalState.update(this.WORKSPACES_KEY, undefined);
        await this.context.globalState.update(this.TAGS_KEY, undefined);
        await this.context.globalState.update(this.SETTINGS_KEY, undefined);
        await this.initializeDefaultTags();
    }

    /**
     * Export data for backup
     */
    async exportData(): Promise<{ workspaces: WorkspaceItem[], tags: Tag[] }> {
        const workspaces = await this.getWorkspaces();
        const tags = await this.getTags();
        return { workspaces, tags };
    }

    /**
     * Import data from backup
     */
    async importData(data: { workspaces?: WorkspaceItem[], tags?: Tag[] }): Promise<void> {
        if (data.workspaces) {
            await this.saveWorkspaces(data.workspaces);
        }
        
        if (data.tags) {
            await this.saveTags(data.tags);
        }
    }
}
