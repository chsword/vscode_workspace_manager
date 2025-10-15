# Spec Delta: Workspace Sync Service - Architecture Refactoring

**Change ID:** `refactor-architecture-modernization`  
**Affects Spec:** `workspace-sync-service`  
**Version:** 1.0.0 → 2.0.0

## MODIFIED Requirements

### REQ-WSS-001: VS Code History Reading (MODIFIED)
**Previous:** The system SHALL read workspace history from VS Code's SQLite state database.

**New:** The system SHALL read workspace history through an adapter abstraction that encapsulates SQLite database access.

**Rationale:** Apply adapter pattern to isolate external dependencies, improve testability, and allow alternative history sources in the future.

**Acceptance Criteria:**
- Locate state.vscdb on Windows, macOS, and Linux
- Query the ItemTable for history entries
- Parse workspace and folder URIs
- Handle database connection errors gracefully
- **NEW:** Access database only through `IHistoryAdapter` interface
- **NEW:** SQLite operations isolated in `SQLiteAdapter` class
- **NEW:** Adapter returns domain models, not raw database rows
- **NEW:** All operations return `Result<T, Error>` for error handling

#### Scenario: Read history through adapter
```
GIVEN a VSCodeHistoryAdapter instance
WHEN readHistory() is called
THEN the adapter locates the state.vscdb file
AND queries the database through SQLiteAdapter
AND maps results to HistoryEntry domain models
AND returns Result<HistoryEntry[], AdapterError>
AND handles database errors gracefully
```

### REQ-WSS-002: Automatic Synchronization (MODIFIED)
**Previous:** The system SHALL automatically sync workspaces at configurable intervals.

**New:** The system SHALL provide automatic synchronization through a dedicated `AutoSyncService` that coordinates sync operations.

**Rationale:** Extract auto-sync logic into focused service following Single Responsibility Principle.

**Acceptance Criteria:**
- Auto-sync can be enabled/disabled
- Sync interval is configurable (default: 5 minutes)
- Manual sync can be triggered anytime
- Sync runs in background without blocking UI
- **NEW:** AutoSyncService manages timer and scheduling
- **NEW:** Sync operations delegated to SyncVSCodeHistory use case
- **NEW:** Service is lifecycle-managed (start/stop)
- **NEW:** Sync errors don't crash the service (error recovery)

#### Scenario: Auto-sync lifecycle management
```
GIVEN an AutoSyncService instance
WHEN start() is called with 5-minute interval
THEN a timer is created for periodic sync
AND sync executes every 5 minutes
WHEN stop() is called
THEN the timer is cleared
AND no more syncs occur until restarted
```

### REQ-WSS-003: Workspace Type Detection (MODIFIED)
**Previous:** The system SHALL detect and categorize workspace locations.

**New:** The system SHALL detect and categorize workspace locations through specialized detector services.

**Rationale:** Split detection logic into focused, testable services.

**Acceptance Criteria:**
- Correctly identify local file paths
- Parse WSL URIs (vscode-remote://wsl+...)
- Parse remote URIs (vscode-remote://ssh-remote+...)
- Extract WSL distribution name
- Extract remote server information
- **NEW:** `WorkspaceLocationDetector` service handles location detection
- **NEW:** `WSLPathResolver` service handles WSL-specific logic
- **NEW:** `RemoteWorkspaceHandler` service handles remote workspaces
- **NEW:** Each detector is independently testable

#### Scenario: Detect location through service composition
```
GIVEN a workspace URI
WHEN WorkspaceLocationDetector processes it
THEN it delegates to appropriate specialized detector
AND WSLPathResolver handles WSL URIs
AND RemoteWorkspaceHandler handles remote URIs
AND a WorkspaceLocation value object is returned
AND all errors are properly typed and handled
```

## ADDED Requirements

### REQ-WSS-007: Service Decomposition (NEW)
**Priority:** Critical  
**Status:** Planned

The monolithic WorkspaceSyncService SHALL be decomposed into smaller, focused services following Single Responsibility Principle.

**Acceptance Criteria:**
- VSCodeHistoryReader: Read and parse VS Code history
- SQLiteAdapter: Low-level database operations
- WorkspaceLocationDetector: Detect workspace location type
- ProjectInfoDetector: Auto-detect project metadata
- WSLPathResolver: Handle WSL path conversion
- RemoteWorkspaceHandler: Process remote workspaces
- SyncVSCodeHistory (use case): Orchestrate sync workflow
- AutoSyncService: Manage automatic sync scheduling

#### Scenario: Execute sync through composed services
```
GIVEN a sync operation is triggered
WHEN SyncVSCodeHistory use case executes
THEN VSCodeHistoryReader retrieves history entries
AND WorkspaceLocationDetector categorizes each entry
AND ProjectInfoDetector enriches with metadata
AND workspace entities are created via factory
AND repository saves/updates workspaces
AND each service handles its specific responsibility
```

### REQ-WSS-008: Async Operation Optimization (NEW)
**Priority:** High  
**Status:** Planned

Sync operations SHALL be optimized for performance with parallel processing where safe.

**Acceptance Criteria:**
- History entries processed in parallel (when independent)
- Project info detection uses caching
- Database queries are batched when possible
- Progress reporting for long operations
- Cancellable sync operations
- No blocking of main thread

#### Scenario: Parallel processing of entries
```
GIVEN 100 history entries to sync
WHEN sync executes
THEN entries are processed in parallel batches
AND independent operations don't block each other
AND progress is reported incrementally
AND total time is significantly reduced vs sequential
```

### REQ-WSS-009: Error Recovery Strategies (NEW)
**Priority:** High  
**Status:** Planned

Sync operations SHALL implement robust error recovery strategies.

**Acceptance Criteria:**
- Individual entry failures don't abort entire sync
- Transient errors trigger retry with exponential backoff
- Permanent errors are logged and skipped
- Partial sync results are saved
- Error metrics collected for monitoring
- User notified of partial failures with details

#### Scenario: Handle partial sync failure
```
GIVEN 50 history entries, 5 of which have errors
WHEN sync executes
THEN 45 successful entries are processed and saved
AND 5 failed entries are logged with details
AND sync completes (doesn't abort)
AND user sees notification: "Synced 45 workspaces, 5 skipped"
AND failed entries can be retried later
```

### REQ-WSS-010: Caching Layer (NEW)
**Priority:** Medium  
**Status:** Planned

Expensive operations SHALL be cached to improve performance.

**Acceptance Criteria:**
- Project info detection results cached
- WSL distribution list cached
- Cache invalidation on configuration change
- Cache size limits
- Cache expiration policy
- Cache can be cleared manually

#### Scenario: Use cached project info
```
GIVEN a workspace was scanned recently
WHEN sync processes the same workspace again
THEN cached project info is used
AND file system scanning is skipped
AND sync completes faster
AND cache expires after configured time
```

## MODIFIED API Surface

### Sync Service API (Refactored)

```typescript
// Previous: Monolithic service
class WorkspaceSyncService {
  syncWorkspaces(): Promise<WorkspaceItem[]>;
  startAutoSync(): void;
  stopAutoSync(): void;
  // ... 1551 lines of mixed concerns
}

// New: Focused use case
interface SyncVSCodeHistoryRequest {
  force?: boolean;  // Bypass cache
  maxEntries?: number;  // Limit processing
}

interface SyncVSCodeHistoryResponse {
  syncedWorkspaces: Workspace[];
  skippedCount: number;
  errors: SyncError[];
  duration: number;
}

@injectable()
class SyncVSCodeHistory implements IUseCase<SyncVSCodeHistoryRequest, SyncVSCodeHistoryResponse> {
  constructor(
    private readonly historyReader: IHistoryReader,
    private readonly locationDetector: IWorkspaceLocationDetector,
    private readonly projectDetector: IProjectInfoDetector,
    private readonly repository: IWorkspaceRepository,
    private readonly logger: ILogger
  ) {}

  async execute(request: SyncVSCodeHistoryRequest): Promise<Result<SyncVSCodeHistoryResponse, SyncError>> {
    // Orchestrate sync workflow
  }
}
```

### New Service Interfaces

```typescript
// History reading
interface IHistoryReader {
  readHistory(): Promise<Result<HistoryEntry[], AdapterError>>;
  getLastReadTime(): Date | undefined;
}

// Location detection
interface IWorkspaceLocationDetector {
  detect(uri: string): Result<WorkspaceLocation, DetectionError>;
  isWSL(uri: string): boolean;
  isRemote(uri: string): boolean;
  isLocal(uri: string): boolean;
}

// Project info detection
interface IProjectInfoDetector {
  detect(path: string): Promise<Result<ProjectInfo, DetectionError>>;
  detectFramework(path: string): Promise<string | undefined>;
  detectLanguage(path: string): Promise<string | undefined>;
  detectPackageManager(path: string): Promise<string | undefined>;
}

// WSL path handling
interface IWSLPathResolver {
  resolve(wslUri: string): Result<ResolvedWSLPath, PathError>;
  extractDistribution(wslUri: string): Result<string, PathError>;
  getAvailableDistributions(): Promise<string[]>;
}

// SQLite operations
interface ISQLiteAdapter {
  query<T>(dbPath: string, sql: string, params?: any[]): Promise<Result<T[], DatabaseError>>;
  execute(dbPath: string, sql: string, params?: any[]): Promise<Result<void, DatabaseError>>;
  close(dbPath: string): Promise<void>;
}
```

### Auto-Sync Service (Extracted)

```typescript
interface AutoSyncConfiguration {
  enabled: boolean;
  intervalMinutes: number;
}

@injectable()
class AutoSyncService {
  private timer?: NodeJS.Timeout;
  private lastSyncTime?: Date;

  constructor(
    private readonly syncUseCase: SyncVSCodeHistory,
    private readonly config: IConfigurationService,
    private readonly logger: ILogger
  ) {}

  start(): void {
    if (this.timer) {
      this.logger.warn('AutoSyncService already started');
      return;
    }

    const config = this.config.get<AutoSyncConfiguration>('sync');
    if (!config.enabled) {
      this.logger.info('Auto-sync is disabled');
      return;
    }

    const intervalMs = config.intervalMinutes * 60 * 1000;
    this.timer = setInterval(() => this.runSync(), intervalMs);
    
    // Initial sync
    this.runSync();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      this.logger.info('AutoSyncService stopped');
    }
  }

  private async runSync(): Promise<void> {
    try {
      this.logger.debug('AutoSyncService running scheduled sync');
      const result = await this.syncUseCase.execute({});
      
      if (result.isSuccess) {
        this.lastSyncTime = new Date();
        this.logger.info('Auto-sync completed', { 
          syncedCount: result.value.syncedWorkspaces.length 
        });
      } else {
        this.logger.error('Auto-sync failed', { error: result.error });
      }
    } catch (error) {
      this.logger.error('Auto-sync crashed', { error });
    }
  }

  getLastSyncTime(): Date | undefined {
    return this.lastSyncTime;
  }

  isRunning(): boolean {
    return this.timer !== undefined;
  }
}
```

## MODIFIED Data Flow

```
Trigger (Auto/Manual)
         ↓
SyncVSCodeHistory Use Case
         ↓
VSCodeHistoryReader.readHistory()
         ↓
SQLiteAdapter.query(state.vscdb)
         ↓
Parse HistoryEntry models
         ↓
WorkspaceLocationDetector.detect() [parallel]
         ↓
WSLPathResolver / RemoteWorkspaceHandler (as needed)
         ↓
ProjectInfoDetector.detect() [parallel, cached]
         ↓
WorkspaceFactory.create() [validation]
         ↓
WorkspaceRepository.save() [batch]
         ↓
Emit domain event: WorkspacesSynced
         ↓
Update UI (event handler)
```

## ADDED Error Types

```typescript
// Sync-specific errors
class SyncError extends BaseError {
  constructor(message: string, public readonly partialResults?: Workspace[]) {
    super(message, 'SYNC_ERROR');
  }
}

class DatabaseError extends BaseError {
  constructor(message: string, public readonly dbPath: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', { dbPath, cause });
  }
}

class DetectionError extends BaseError {
  constructor(message: string, public readonly uri: string) {
    super(message, 'DETECTION_ERROR', { uri });
  }
}

class PathError extends BaseError {
  constructor(message: string, public readonly path: string) {
    super(message, 'PATH_ERROR', { path });
  }
}

class AdapterError extends BaseError {
  constructor(message: string, public readonly adapter: string, cause?: Error) {
    super(message, 'ADAPTER_ERROR', { adapter, cause });
  }
}
```

## MODIFIED Testing Requirements

### Unit Tests (Enhanced)

**New test coverage areas:**
- **VSCodeHistoryReader:** Mock SQLite adapter, test parsing
- **SQLiteAdapter:** Mock native sqlite3, test queries
- **WorkspaceLocationDetector:** Test URI parsing for all types
- **WSLPathResolver:** Test WSL path logic, distribution detection
- **RemoteWorkspaceHandler:** Test remote URI parsing
- **ProjectInfoDetector:** Mock file system, test detection logic
- **SyncVSCodeHistory Use Case:** Mock all dependencies, test orchestration
- **AutoSyncService:** Mock timer, test lifecycle

#### Scenario: Test sync use case with mocks
```
GIVEN all dependencies are mocked
  AND history reader returns 10 entries
  AND location detector succeeds for all
  AND project detector succeeds for all
  AND repository save succeeds
WHEN sync use case executes
THEN all services are called in correct order
AND results are aggregated correctly
AND Result.ok() with 10 workspaces is returned
```

### Integration Tests (Enhanced)

**New integration tests:**
- Read real state.vscdb file (test fixtures)
- Cross-service integration (history → detection → storage)
- Error propagation through layers
- Caching behavior verification
- Performance benchmarks with real data

### Edge Cases (Expanded)

**New edge cases to test:**
- Concurrent sync operations
- Database locked during read
- Malformed URIs in history
- Missing WSL distributions
- Unreachable remote servers
- Project detection timeout
- Cache corruption
- Partial sync with mixed success/failure

## Migration Strategy

### Phase 1: Extract Adapters (Week 3)
- Create `IHistoryAdapter` interface
- Implement `VSCodeHistoryAdapter`
- Create `ISQLiteAdapter` interface
- Implement `SQLiteAdapter`
- Migrate existing code to use adapters
- **Breaking Change:** None, internal only

### Phase 2: Service Decomposition (Week 3-4)
- Extract `WorkspaceLocationDetector`
- Extract `WSLPathResolver`
- Extract `RemoteWorkspaceHandler`
- Extract `ProjectInfoDetector`
- Create `SyncVSCodeHistory` use case
- Refactor existing code to use new services
- **Breaking Change:** None, internal only

### Phase 3: Auto-Sync Extraction (Week 4)
- Create `AutoSyncService`
- Migrate timer logic
- Update activation code
- Remove old WorkspaceSyncService
- **Breaking Change:** Configuration keys unchanged, behavior identical

### Phase 4: Optimization (Week 5)
- Add caching layer
- Implement parallel processing
- Add progress reporting
- Optimize performance
- **Breaking Change:** None, only improvements

## Performance Improvements

### Expected Gains

| Operation | Current | Target | Improvement |
|-----------|---------|--------|-------------|
| Full sync (100 items) | ~1.5s | ~0.9s | 40% faster |
| Incremental sync | ~300ms | ~150ms | 50% faster |
| Project detection | ~80ms | ~20ms | 75% faster (cache) |
| WSL path resolution | ~100ms | ~50ms | 50% faster |

### Optimization Techniques
- Parallel processing of independent operations
- Caching of expensive detections
- Batch repository operations
- Lazy loading of project info
- Debouncing of frequent syncs

## Backward Compatibility

### Configuration
- All existing settings preserved
- `autoSync` → remains unchanged
- `syncInterval` → remains unchanged
- `maxRecentWorkspaces` → remains unchanged
- No migration required

### Behavior
- Sync results identical to current implementation
- Order preservation maintained
- Duplicate prevention works the same
- User customizations preserved

### Public API
- `syncWorkspaces()` command remains
- `startAutoSync()` behavior unchanged
- `stopAutoSync()` behavior unchanged
- Extension API stable

## Breaking Changes

### For Users
- **None**: All functionality remains identical

### For Contributors
- **File Organization**: WorkspaceSyncService split into multiple files
- **Import Paths**: Need to import from new service locations
- **Testing**: Mock multiple services instead of one
- **Patterns**: Follow new service composition patterns

## Dependencies

**No new dependencies required** - refactoring uses existing libraries

## Success Criteria

- ✅ All sync functionality works correctly
- ✅ Performance improvements achieved
- ✅ Code split into focused services (<200 lines each)
- ✅ 80%+ test coverage
- ✅ All error scenarios handled
- ✅ Caching working effectively
- ✅ Backward compatibility maintained
- ✅ Documentation updated

---

**Impact:** High - Major refactoring of largest service  
**Risk:** Medium - Critical functionality, mitigated by thorough testing  
**Timeline:** 2-3 weeks for complete refactoring
