# Spec: Workspace Sync Service

**Capability ID:** `workspace-sync-service`  
**Version:** 1.0.0  
**Status:** Current  
**Last Updated:** 2025-01-15

## Overview

The Workspace Sync Service automatically discovers and imports workspaces from VS Code's internal history database, ensuring the workspace manager stays synchronized with VS Code's recently opened workspaces.

## Requirements

### Functional Requirements

#### REQ-WSS-001: VS Code History Reading
**Priority:** Critical  
**Status:** Implemented

The system SHALL read workspace history from VS Code's SQLite state database (`state.vscdb`).

**Acceptance Criteria:**
- Locate state.vscdb on Windows, macOS, and Linux
- Query the ItemTable for history entries
- Parse workspace and folder URIs
- Handle database connection errors gracefully

#### Scenario: Read VS Code history
```
GIVEN VS Code has opened multiple workspaces
WHEN the sync service reads the state database
THEN all recently opened workspaces are discovered
AND workspace URIs are correctly parsed
```

#### REQ-WSS-002: Automatic Synchronization
**Priority:** High  
**Status:** Implemented

The system SHALL automatically sync workspaces at configurable intervals.

**Acceptance Criteria:**
- Auto-sync can be enabled/disabled
- Sync interval is configurable (default: 5 minutes)
- Manual sync can be triggered anytime
- Sync runs in background without blocking UI

#### Scenario: Auto-sync on interval
```
GIVEN auto-sync is enabled with 5-minute interval
WHEN 5 minutes have elapsed since last sync
THEN the sync service automatically runs
AND new workspaces are discovered and added
```

#### REQ-WSS-003: Workspace Type Detection
**Priority:** High  
**Status:** Implemented

The system SHALL detect and categorize workspace locations:
- **Local**: File system paths on the local machine
- **WSL**: Windows Subsystem for Linux workspaces
- **Remote**: SSH, containers, or other remote workspaces

**Acceptance Criteria:**
- Correctly identify local file paths
- Parse WSL URIs (vscode-remote://wsl+...)
- Parse remote URIs (vscode-remote://ssh-remote+...)
- Extract WSL distribution name
- Extract remote server information

#### Scenario: Detect WSL workspace
```
GIVEN a workspace URI "vscode-remote://wsl+Ubuntu/home/user/project"
WHEN the sync service processes this entry
THEN the workspace is categorized as WSL type
AND the distribution is identified as "Ubuntu"
AND the path is extracted as "/home/user/project"
```

#### Scenario: Detect remote workspace
```
GIVEN a workspace URI "vscode-remote://ssh-remote+server.example.com/projects/app"
WHEN the sync service processes this entry
THEN the workspace is categorized as remote type
AND the server name is "server.example.com"
```

#### REQ-WSS-004: Project Information Detection
**Priority:** Medium  
**Status:** Implemented

The system SHALL auto-detect project information when available:
- Framework (React, Vue, Angular, etc.)
- Language (TypeScript, Python, Go, etc.)
- Package manager (npm, yarn, pnpm, etc.)
- Git repository information
- Special files (package.json, Dockerfile, etc.)

**Acceptance Criteria:**
- Detect framework from package.json dependencies
- Identify primary language from file extensions
- Detect package manager from lock files
- Handle detection errors gracefully

#### Scenario: Detect Node.js project
```
GIVEN a workspace with package.json containing "react" dependency
WHEN project info is detected
THEN framework is identified as "React"
AND language is identified as "JavaScript/TypeScript"
AND package manager is detected from lock file presence
```

#### REQ-WSS-005: Duplicate Prevention
**Priority:** High  
**Status:** Implemented

The system SHALL prevent duplicate workspace entries.

**Acceptance Criteria:**
- Compare paths for exact matches
- Handle path normalization (slashes, case)
- Update existing workspace instead of creating duplicate
- Maintain user customizations on sync

#### Scenario: Update existing workspace
```
GIVEN a workspace already exists in the manager
WHEN the same workspace is found during sync
THEN the existing entry is updated (last opened time)
AND user customizations (tags, description) are preserved
AND no duplicate entry is created
```

#### REQ-WSS-006: Order Preservation
**Priority:** Medium  
**Status:** Implemented

The system SHALL preserve the order of workspaces from VS Code history.

**Acceptance Criteria:**
- Maintain chronological order from VS Code
- Most recently opened appears first
- Order is preserved across syncs

### Non-Functional Requirements

#### REQ-WSS-NF-001: Performance
Sync operations SHALL complete efficiently:
- Full sync of 100 workspaces < 2 seconds
- Incremental sync < 500ms
- No blocking of main thread
- Progress indication for slow operations

#### REQ-WSS-NF-002: Reliability
The sync service SHALL be reliable:
- Gracefully handle database lock errors
- Retry failed operations with exponential backoff
- Log errors for debugging
- Never corrupt existing data

#### REQ-WSS-NF-003: Cross-Platform Compatibility
The system SHALL work on all platforms:
- Windows (including WSL)
- macOS
- Linux
- Handle platform-specific path formats

## Data Flow

```
VS Code History (state.vscdb)
         ↓
SQLite Query (ItemTable)
         ↓
Parse URI (vscode-remote://...)
         ↓
Detect Location Type (Local/WSL/Remote)
         ↓
Extract Path & Metadata
         ↓
Detect Project Info (optional)
         ↓
Create/Update Workspace Entity
         ↓
Save to Storage
         ↓
Notify UI (refresh)
```

## API Surface

### Sync Service API

```typescript
interface IWorkspaceSyncService {
  syncWorkspaces(): Promise<Workspace[]>;
  startAutoSync(): void;
  stopAutoSync(): void;
  isAutoSyncEnabled(): boolean;
  getLastSyncTime(): Date | undefined;
}
```

### History Adapter API

```typescript
interface IHistoryAdapter {
  readHistory(): Promise<HistoryEntry[]>;
  getStateDbPath(): string;
}

interface HistoryEntry {
  workspace?: {
    id: string;
    configPath: string;
  };
  folderUri?: string;
  label?: string;
  remoteAuthority?: string;
}
```

## Configuration

```typescript
interface SyncConfiguration {
  autoSync: boolean;          // Enable/disable auto-sync
  syncInterval: number;       // Minutes between syncs
  maxRecentWorkspaces: number; // Limit on tracked workspaces
  autoTagging: boolean;       // Auto-detect and apply tags
}
```

## Error Handling

### Error Types

1. **DatabaseError**: Cannot access state.vscdb
2. **ParseError**: Invalid URI format
3. **PathError**: Cannot resolve file system path
4. **DetectionError**: Project info detection failed

### Recovery Strategies

- **DatabaseError**: Log error, skip this sync cycle, retry next interval
- **ParseError**: Log warning, skip invalid entry, continue with others
- **PathError**: Mark workspace as unavailable, continue sync
- **DetectionError**: Skip project info, use basic metadata

## Dependencies

- **SQLite**: For reading VS Code state database
- **Node.js fs/path**: For file system operations
- **VS Code API**: For current workspace context

## Security Considerations

- Read-only access to state.vscdb
- Handle file permissions errors
- Sanitize paths before storage
- No modification of VS Code's database

## Testing Requirements

### Unit Tests
- URI parsing (local, WSL, remote)
- Location type detection
- Project info detection
- Path normalization
- Error handling

### Integration Tests
- Read real state.vscdb file
- Cross-platform path handling
- WSL integration testing
- Remote workspace scenarios

### Edge Cases
- Empty history
- Corrupted database
- Invalid URIs
- Missing permissions
- Concurrent access

## Performance Metrics

| Operation | Target | Current |
|-----------|--------|---------|
| Full sync (100 items) | < 2s | ~1.5s |
| Incremental sync | < 500ms | ~300ms |
| Database read | < 200ms | ~150ms |
| Project detection | < 100ms/workspace | ~80ms |

## Change History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-15 | Initial specification |
