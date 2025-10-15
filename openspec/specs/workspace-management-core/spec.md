# Spec: Workspace Management Core

**Capability ID:** `workspace-management-core`  
**Version:** 1.0.0  
**Status:** Current  
**Last Updated:** 2025-01-15

## Overview

The Workspace Management Core capability provides fundamental workspace organization, storage, and retrieval functionality for the VSCode Workspace Manager extension.

## Requirements

### Functional Requirements

#### REQ-WMC-001: Workspace Storage
**Priority:** Critical  
**Status:** Implemented

The system SHALL persist workspace data using VS Code's GlobalState API.

**Acceptance Criteria:**
- Workspace data persists across VS Code sessions
- Data is stored in JSON-serializable format
- Storage operations are atomic and error-safe

#### Scenario: Save new workspace
```
GIVEN a user has opened a new project
WHEN the workspace is detected and saved
THEN the workspace data is persisted to GlobalState
AND the workspace appears in the workspace list
```

#### REQ-WMC-002: Workspace Retrieval
**Priority:** Critical  
**Status:** Implemented

The system SHALL allow retrieval of workspaces by ID and by filter criteria.

**Acceptance Criteria:**
- Get workspace by unique ID
- Get all workspaces with optional filters
- Filter by location type, tags, favorite status
- Sort by last opened, name, or custom order

#### Scenario: Get all workspaces
```
GIVEN multiple workspaces are stored
WHEN a user requests all workspaces
THEN all workspace records are returned
AND workspaces are sorted by last opened date (default)
```

#### Scenario: Filter workspaces by location
```
GIVEN workspaces in different locations (Local, WSL, Remote)
WHEN a user filters by "WSL" location
THEN only WSL workspaces are returned
```

#### REQ-WMC-003: Workspace Metadata
**Priority:** High  
**Status:** Implemented

Each workspace SHALL store comprehensive metadata including:
- Unique identifier
- Name and path
- Type (workspace file or folder)
- Location information (Local/WSL/Remote)
- Last opened timestamp
- Favorite and pinned status
- Custom description
- Associated tags
- Project information (framework, language, etc.)

#### Scenario: Update workspace metadata
```
GIVEN an existing workspace
WHEN a user updates the description or tags
THEN the changes are persisted
AND the workspace list reflects the updates
```

#### REQ-WMC-004: Workspace Organization
**Priority:** High  
**Status:** Implemented

Users SHALL be able to organize workspaces using:
- Favorites (quick access to important workspaces)
- Pinning (keep workspaces at top of list)
- Tags (categorize and filter workspaces)
- Descriptions (add context and notes)

#### Scenario: Toggle favorite status
```
GIVEN a workspace in the list
WHEN a user clicks the favorite button
THEN the workspace's favorite status is toggled
AND the workspace appears in the favorites filter
```

#### REQ-WMC-005: Workspace Identification
**Priority:** Critical  
**Status:** Implemented

The system SHALL uniquely identify workspaces by:
- UUID for internal tracking
- File path for external identification
- Handling path variations (trailing slashes, case sensitivity)

#### Scenario: Prevent duplicate workspaces
```
GIVEN a workspace with path "/home/user/project"
WHEN the same workspace is opened again
THEN no duplicate entry is created
AND the existing workspace's last opened time is updated
```

### Non-Functional Requirements

#### REQ-WMC-NF-001: Performance
The system SHALL handle at least 1000 workspaces efficiently:
- List rendering < 100ms
- Storage operations < 50ms
- Filter/search operations < 100ms

#### REQ-WMC-NF-002: Data Integrity
The system SHALL ensure data integrity through:
- Atomic write operations
- Backup before destructive operations
- Validation on read and write
- Graceful handling of corrupted data

#### REQ-WMC-NF-003: Compatibility
The system SHALL maintain backward compatibility for:
- Existing workspace data format
- Configuration settings
- VS Code API versions (1.103.0+)

## Data Model

### Workspace Entity

```typescript
interface Workspace {
  id: string;              // UUID
  name: string;            // Display name
  path: string;            // Absolute file system path
  type: 'workspace' | 'folder';
  location: WorkspaceLocation;
  lastOpened: Date;
  isFavorite: boolean;
  isPinned: boolean;
  description?: string;
  tags: string[];
  projectInfo?: ProjectInfo;
}
```

### WorkspaceLocation

```typescript
interface WorkspaceLocation {
  type: 'local' | 'wsl' | 'remote';
  displayName: string;
  details?: {
    serverName?: string;
    serverUrl?: string;
    wslDistribution?: string;
    driveLetter?: string;
  };
}
```

## API Surface

### Storage API

```typescript
interface IWorkspaceStorage {
  getWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  saveWorkspace(workspace: Workspace): Promise<void>;
  saveWorkspaces(workspaces: Workspace[]): Promise<void>;
  removeWorkspace(id: string): Promise<void>;
}
```

### Filter API

```typescript
interface WorkspaceFilter {
  searchText?: string;
  locationType?: 'local' | 'wsl' | 'remote' | 'all';
  workspaceType?: 'workspace' | 'folder' | 'all';
  tags?: string[];
  favorites?: boolean;
  pinned?: boolean;
}
```

## Dependencies

- **VS Code API:** `vscode.ExtensionContext.globalState`
- **uuid library:** For generating workspace IDs

## Security Considerations

- Workspace paths may contain sensitive information
- Data is stored locally in VS Code's global state
- No data is transmitted over network
- File system access follows VS Code's security model

## Testing Requirements

### Unit Tests
- Storage operations (CRUD)
- Filter and sort logic
- Data validation
- Error handling

### Integration Tests
- VS Code GlobalState integration
- Workspace lifecycle management
- Data migration scenarios

## Change History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-15 | Initial specification |
