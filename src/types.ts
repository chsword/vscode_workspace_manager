/**
 * Workspace item type definitions
 */
export interface WorkspaceItem {
    id: string;
    name: string;
    path: string;
    type: 'workspace' | 'folder' | 'file';
    location: WorkspaceLocation;
    lastOpened: Date;
    isFavorite: boolean;
    isPinned: boolean;
    description?: string;
    tags: string[];
    projectInfo?: ProjectInfo;
}

/**
 * Workspace location information
 */
export interface WorkspaceLocation {
    type: 'local' | 'wsl' | 'remote';
    displayName: string;
    details?: {
        serverName?: string;
        serverUrl?: string;
        wslDistribution?: string;
        driveLetter?: string;
    };
}

/**
 * Project information detected from workspace
 */
export interface ProjectInfo {
    framework?: string;
    language?: string;
    packageManager?: string;
    gitRepository?: string;
    hasPackageJson?: boolean;
    hasDockerfile?: boolean;
}

/**
 * Tag definition
 */
export interface Tag {
    id: string;
    name: string;
    color: string;
    description?: string;
    isSystem: boolean;
    usageCount: number;
}

/**
 * Workspace filter options
 */
export interface WorkspaceFilter {
    searchText?: string;
    tags?: string[];
    location?: string;
    view?: string;
    type?: ('workspace' | 'folder' | 'file')[];
    showFavoritesOnly?: boolean;
    showPinnedOnly?: boolean;
}

/**
 * Extension configuration
 */
export interface WorkspaceManagerConfig {
    autoSync: boolean;
    syncInterval: number;
    maxRecentWorkspaces: number;
    showFullPath: boolean;
    autoTagging: boolean;
    excludedFolders: string[];
    defaultTags: string[];
}

/**
 * System tags that are automatically detected
 */
export const SYSTEM_TAGS: Readonly<Record<string, Omit<Tag, 'id' | 'usageCount'>>> = {
    vue: {
        name: 'Vue',
        color: '#42b883',
        description: 'Vue.js project',
        isSystem: true
    },
    react: {
        name: 'React',
        color: '#61dafb',
        description: 'React project',
        isSystem: true
    },
    angular: {
        name: 'Angular',
        color: '#dd0031',
        description: 'Angular project',
        isSystem: true
    },
    dotnet: {
        name: '.NET',
        color: '#512bd4',
        description: '.NET project',
        isSystem: true
    },
    java: {
        name: 'Java',
        color: '#ed8b00',
        description: 'Java project',
        isSystem: true
    },
    python: {
        name: 'Python',
        color: '#3776ab',
        description: 'Python project',
        isSystem: true
    },
    nodejs: {
        name: 'Node.js',
        color: '#339933',
        description: 'Node.js project',
        isSystem: true
    },
    typescript: {
        name: 'TypeScript',
        color: '#3178c6',
        description: 'TypeScript project',
        isSystem: true
    },
    javascript: {
        name: 'JavaScript',
        color: '#f7df1e',
        description: 'JavaScript project',
        isSystem: true
    },
    go: {
        name: 'Go',
        color: '#00add8',
        description: 'Go project',
        isSystem: true
    },
    rust: {
        name: 'Rust',
        color: '#000000',
        description: 'Rust project',
        isSystem: true
    },
    php: {
        name: 'PHP',
        color: '#777bb4',
        description: 'PHP project',
        isSystem: true
    },
    svelte: {
        name: 'Svelte',
        color: '#ff3e00',
        description: 'Svelte project',
        isSystem: true
    },
    springboot: {
        name: 'Spring Boot',
        color: '#6db33f',
        description: 'Spring Boot project',
        isSystem: true
    },
    django: {
        name: 'Django',
        color: '#092e20',
        description: 'Django project',
        isSystem: true
    }
} as const;

/**
 * Events emitted by workspace manager
 */
export interface WorkspaceEvents {
    workspaceAdded: WorkspaceItem;
    workspaceRemoved: string;
    workspaceUpdated: WorkspaceItem;
    syncCompleted: WorkspaceItem[];
    syncError: Error;
}
