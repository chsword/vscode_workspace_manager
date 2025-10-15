# Design Document: Architecture Modernization

**Change ID:** `refactor-architecture-modernization`  
**Related Proposal:** [proposal.md](./proposal.md)

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layer Design](#layer-design)
3. [Dependency Flow](#dependency-flow)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [Technical Decisions](#technical-decisions)
7. [Design Patterns](#design-patterns)
8. [API Contracts](#api-contracts)

## Architecture Overview

### Layered Architecture

The new architecture follows a clean, layered design inspired by Domain-Driven Design and Hexagonal Architecture principles:

```
┌───────────────────────────────────────────────────────────────┐
│                      Presentation Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Commands   │  │   WebView    │  │  Status Bar  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────┬──────────────────────────────────┘
                             │ Use Case Interfaces
┌────────────────────────────▼──────────────────────────────────┐
│                      Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Use Cases   │  │   Services   │  │   Handlers   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────┬──────────────────────────────────┘
                             │ Domain Interfaces
┌────────────────────────────▼──────────────────────────────────┐
│                        Domain Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Entities   │  │Value Objects │  │   Services   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────┬──────────────────────────────────┘
                             │ Repository Interfaces
┌────────────────────────────▼──────────────────────────────────┐
│                    Infrastructure Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Repositories │  │   Adapters   │  │  External    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└───────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Dependency Inversion**: High-level modules do not depend on low-level modules
2. **Separation of Concerns**: Each layer has a single, well-defined responsibility
3. **Testability**: Easy to mock dependencies and test in isolation
4. **Flexibility**: Easy to swap implementations without changing core logic

## Layer Design

### 1. Domain Layer (`src/core/domain/`)

**Purpose:** Contains core business logic and domain models

**Responsibilities:**
- Define entities with behavior
- Define value objects
- Define domain services
- Define repository interfaces
- Enforce business rules

**Dependencies:** None (pure business logic)

#### Entities

```typescript
// src/core/domain/entities/Workspace.ts
export class Workspace {
  constructor(
    private readonly _id: WorkspaceId,
    private _name: WorkspaceName,
    private _path: WorkspacePath,
    private _type: WorkspaceType,
    private _location: WorkspaceLocation,
    private _metadata: WorkspaceMetadata
  ) {}

  // Business logic methods
  toggleFavorite(): void { /* ... */ }
  addTag(tag: Tag): Result<void, ValidationError> { /* ... */ }
  removeTag(tagId: TagId): void { /* ... */ }
  updateLastOpened(): void { /* ... */ }
  
  // Getters
  get id(): WorkspaceId { return this._id; }
  get name(): WorkspaceName { return this._name; }
  // ... other getters
  
  // Domain validation
  private validateTags(): Result<void, ValidationError> { /* ... */ }
}
```

#### Value Objects

```typescript
// src/core/domain/value-objects/WorkspacePath.ts
export class WorkspacePath {
  private constructor(private readonly value: string) {}

  static create(path: string): Result<WorkspacePath, ValidationError> {
    if (!path || path.trim().length === 0) {
      return Result.fail(new ValidationError('Path cannot be empty'));
    }
    return Result.ok(new WorkspacePath(path));
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkspacePath): boolean {
    return this.value === other.value;
  }
}
```

#### Repository Interfaces

```typescript
// src/core/domain/repositories/IWorkspaceRepository.ts
export interface IWorkspaceRepository {
  findById(id: WorkspaceId): Promise<Result<Workspace, NotFoundError>>;
  findAll(filter?: WorkspaceFilter): Promise<Result<Workspace[], StorageError>>;
  save(workspace: Workspace): Promise<Result<void, StorageError>>;
  delete(id: WorkspaceId): Promise<Result<void, StorageError>>;
  exists(path: WorkspacePath): Promise<boolean>;
}
```

### 2. Application Layer (`src/core/use-cases/`)

**Purpose:** Orchestrates domain objects to fulfill use cases

**Responsibilities:**
- Implement use cases
- Coordinate between domain and infrastructure
- Handle application logic (not business logic)
- Transaction management
- Input validation

**Dependencies:** Domain layer only

#### Use Case Structure

```typescript
// src/core/use-cases/workspace/GetWorkspaces.ts
export interface GetWorkspacesRequest {
  filter?: WorkspaceFilter;
  sortBy?: SortCriteria;
  pagination?: PaginationOptions;
}

export interface GetWorkspacesResponse {
  workspaces: Workspace[];
  total: number;
  page: number;
}

@injectable()
export class GetWorkspaces {
  constructor(
    @inject('IWorkspaceRepository') 
    private readonly repository: IWorkspaceRepository,
    @inject('ILogger') 
    private readonly logger: ILogger
  ) {}

  async execute(
    request: GetWorkspacesRequest
  ): Promise<Result<GetWorkspacesResponse, ApplicationError>> {
    try {
      this.logger.debug('GetWorkspaces.execute', { request });

      const result = await this.repository.findAll(request.filter);
      
      if (result.isFailure) {
        return Result.fail(result.error);
      }

      const workspaces = result.value;
      const sorted = this.sortWorkspaces(workspaces, request.sortBy);
      const paginated = this.paginateWorkspaces(sorted, request.pagination);

      return Result.ok({
        workspaces: paginated,
        total: workspaces.length,
        page: request.pagination?.page ?? 1
      });
    } catch (error) {
      this.logger.error('GetWorkspaces.execute failed', { error, request });
      return Result.fail(new ApplicationError('Failed to get workspaces', error));
    }
  }

  private sortWorkspaces(workspaces: Workspace[], criteria?: SortCriteria): Workspace[] {
    // Sorting logic
  }

  private paginateWorkspaces(workspaces: Workspace[], options?: PaginationOptions): Workspace[] {
    // Pagination logic
  }
}
```

### 3. Infrastructure Layer (`src/infrastructure/`)

**Purpose:** Provides concrete implementations for domain interfaces

**Responsibilities:**
- Implement repositories
- Integrate with external services (VS Code API, SQLite, etc.)
- Handle data persistence
- Manage external communications
- Dependency injection configuration

**Dependencies:** Domain layer (for interfaces), external libraries

#### Repository Implementation

```typescript
// src/infrastructure/repositories/VSCodeWorkspaceRepository.ts
@injectable()
export class VSCodeWorkspaceRepository implements IWorkspaceRepository {
  private readonly STORAGE_KEY = 'workspaces';

  constructor(
    @inject('ExtensionContext') 
    private readonly context: vscode.ExtensionContext,
    @inject('ILogger') 
    private readonly logger: ILogger
  ) {}

  async findById(id: WorkspaceId): Promise<Result<Workspace, NotFoundError>> {
    try {
      const workspaces = await this.getAllWorkspaces();
      const workspace = workspaces.find(w => w.id.equals(id));
      
      if (!workspace) {
        return Result.fail(new NotFoundError(`Workspace not found: ${id}`));
      }
      
      return Result.ok(workspace);
    } catch (error) {
      this.logger.error('findById failed', { id, error });
      return Result.fail(new NotFoundError('Failed to find workspace', error));
    }
  }

  async findAll(filter?: WorkspaceFilter): Promise<Result<Workspace[], StorageError>> {
    try {
      const workspaces = await this.getAllWorkspaces();
      const filtered = filter ? this.applyFilter(workspaces, filter) : workspaces;
      return Result.ok(filtered);
    } catch (error) {
      this.logger.error('findAll failed', { filter, error });
      return Result.fail(new StorageError('Failed to retrieve workspaces', error));
    }
  }

  async save(workspace: Workspace): Promise<Result<void, StorageError>> {
    try {
      const workspaces = await this.getAllWorkspaces();
      const index = workspaces.findIndex(w => w.id.equals(workspace.id));
      
      if (index >= 0) {
        workspaces[index] = workspace;
      } else {
        workspaces.push(workspace);
      }
      
      await this.saveAllWorkspaces(workspaces);
      return Result.ok(undefined);
    } catch (error) {
      this.logger.error('save failed', { workspace, error });
      return Result.fail(new StorageError('Failed to save workspace', error));
    }
  }

  // ... other methods

  private async getAllWorkspaces(): Promise<Workspace[]> {
    const data = this.context.globalState.get<any[]>(this.STORAGE_KEY, []);
    return data.map(d => this.mapToEntity(d));
  }

  private async saveAllWorkspaces(workspaces: Workspace[]): Promise<void> {
    const data = workspaces.map(w => this.mapToData(w));
    await this.context.globalState.update(this.STORAGE_KEY, data);
  }

  private mapToEntity(data: any): Workspace {
    // Map storage data to domain entity
  }

  private mapToData(workspace: Workspace): any {
    // Map domain entity to storage data
  }
}
```

#### Adapter Pattern for External Services

```typescript
// src/infrastructure/adapters/VSCodeHistoryAdapter.ts
export interface IHistoryAdapter {
  readHistory(): Promise<Result<HistoryEntry[], AdapterError>>;
}

@injectable()
export class VSCodeHistoryAdapter implements IHistoryAdapter {
  constructor(
    @inject('SQLiteAdapter') 
    private readonly sqlite: SQLiteAdapter,
    @inject('ILogger') 
    private readonly logger: ILogger
  ) {}

  async readHistory(): Promise<Result<HistoryEntry[], AdapterError>> {
    try {
      const dbPath = this.getStateDbPath();
      const entries = await this.sqlite.query(dbPath, this.getHistoryQuery());
      return Result.ok(entries.map(e => this.mapToHistoryEntry(e)));
    } catch (error) {
      this.logger.error('readHistory failed', { error });
      return Result.fail(new AdapterError('Failed to read VS Code history', error));
    }
  }

  private getStateDbPath(): string {
    // Determine VS Code state.vscdb path based on OS
  }

  private getHistoryQuery(): string {
    return `SELECT * FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'`;
  }

  private mapToHistoryEntry(row: any): HistoryEntry {
    // Map database row to domain model
  }
}
```

### 4. Presentation Layer (`src/presentation/`)

**Purpose:** Handles user interactions and displays data

**Responsibilities:**
- Register VS Code commands
- Handle command execution
- Manage WebView
- Update status bar
- Handle user input

**Dependencies:** Application layer (use cases)

#### Command Handler

```typescript
// src/presentation/commands/WorkspaceCommands.ts
@injectable()
export class WorkspaceCommands {
  constructor(
    @inject('GetWorkspaces') 
    private readonly getWorkspaces: GetWorkspaces,
    @inject('OpenWorkspace') 
    private readonly openWorkspace: OpenWorkspace,
    @inject('ToggleFavorite') 
    private readonly toggleFavorite: ToggleFavorite,
    @inject('ILogger') 
    private readonly logger: ILogger
  ) {}

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'workspaceManager.openWorkspace',
        (workspaceId: string) => this.handleOpenWorkspace(workspaceId)
      ),
      vscode.commands.registerCommand(
        'workspaceManager.toggleFavorite',
        (workspaceId: string) => this.handleToggleFavorite(workspaceId)
      )
    );
  }

  private async handleOpenWorkspace(workspaceId: string): Promise<void> {
    try {
      const result = await this.openWorkspace.execute({ workspaceId });
      
      if (result.isFailure) {
        vscode.window.showErrorMessage(`Failed to open workspace: ${result.error.message}`);
        return;
      }

      vscode.window.showInformationMessage('Workspace opened successfully');
    } catch (error) {
      this.logger.error('handleOpenWorkspace failed', { workspaceId, error });
      vscode.window.showErrorMessage('An unexpected error occurred');
    }
  }

  private async handleToggleFavorite(workspaceId: string): Promise<void> {
    try {
      const result = await this.toggleFavorite.execute({ workspaceId });
      
      if (result.isFailure) {
        vscode.window.showErrorMessage(`Failed to toggle favorite: ${result.error.message}`);
        return;
      }

      // Notify webview to refresh
      WebviewController.getInstance().refresh();
    } catch (error) {
      this.logger.error('handleToggleFavorite failed', { workspaceId, error });
    }
  }
}
```

## Dependency Flow

### IoC Container Configuration

```typescript
// src/infrastructure/ioc/container.ts
import { container } from 'tsyringe';
import 'reflect-metadata';

export function configureContainer(context: vscode.ExtensionContext): void {
  // Register context
  container.registerInstance('ExtensionContext', context);

  // Register infrastructure
  container.registerSingleton<ILogger>('ILogger', VSCodeLogger);
  container.registerSingleton<IWorkspaceRepository>(
    'IWorkspaceRepository',
    VSCodeWorkspaceRepository
  );
  container.registerSingleton<ITagRepository>(
    'ITagRepository',
    VSCodeTagRepository
  );

  // Register adapters
  container.registerSingleton('SQLiteAdapter', SQLiteAdapter);
  container.registerSingleton('IHistoryAdapter', VSCodeHistoryAdapter);

  // Register use cases
  container.registerSingleton('GetWorkspaces', GetWorkspaces);
  container.registerSingleton('CreateWorkspace', CreateWorkspace);
  container.registerSingleton('UpdateWorkspace', UpdateWorkspace);
  container.registerSingleton('DeleteWorkspace', DeleteWorkspace);
  container.registerSingleton('SyncVSCodeHistory', SyncVSCodeHistory);
  
  // Register presentation
  container.registerSingleton('WorkspaceCommands', WorkspaceCommands);
  container.registerSingleton('WebviewController', WebviewController);
}

export { container };
```

### Extension Entry Point

```typescript
// src/extension.ts
import { container, configureContainer } from './infrastructure/ioc/container';

export function activate(context: vscode.ExtensionContext): void {
  // Configure DI container
  configureContainer(context);

  // Resolve and register commands
  const commands = container.resolve<WorkspaceCommands>('WorkspaceCommands');
  commands.register(context);

  // Resolve and initialize webview
  const webview = container.resolve<WebviewController>('WebviewController');
  webview.initialize(context);

  // Start auto-sync if enabled
  const syncService = container.resolve<AutoSyncService>('AutoSyncService');
  if (getConfig('autoSync')) {
    syncService.start();
  }
}
```

## Data Flow

### User Action Flow

```
User clicks "Open Workspace"
         ↓
Command Handler (Presentation)
         ↓
OpenWorkspace Use Case (Application)
         ↓
IWorkspaceRepository.findById (Domain Interface)
         ↓
VSCodeWorkspaceRepository.findById (Infrastructure)
         ↓
VS Code Storage API
         ↓
Return Workspace Entity (Domain)
         ↓
Execute business logic
         ↓
Open workspace in VS Code
         ↓
Update UI
```

### Sync Flow

```
Auto-sync timer triggers
         ↓
SyncVSCodeHistory Use Case
         ↓
VSCodeHistoryAdapter.readHistory
         ↓
SQLiteAdapter.query (read state.vscdb)
         ↓
Map to HistoryEntry domain models
         ↓
DetectProjectInfo for each entry
         ↓
Create/Update Workspace entities
         ↓
Save via IWorkspaceRepository
         ↓
Emit change event
         ↓
Notify WebView to refresh
```

## Technical Decisions

### 1. Dependency Injection: TSyringe

**Decision:** Use TSyringe for dependency injection

**Rationale:**
- Lightweight and TypeScript-first
- Decorator-based API (familiar pattern)
- Good performance
- Easy to configure and use
- Supports constructor injection

**Alternatives Considered:**
- InversifyJS: More features but heavier, more complex
- Manual DI: Simple but error-prone and harder to maintain

### 2. Frontend Framework: Svelte

**Decision:** Use Svelte for WebView UI

**Rationale:**
- Compiles to vanilla JS (no runtime overhead)
- Excellent performance
- Simple and intuitive API
- Great TypeScript support
- Perfect for embedded UIs like VS Code webviews
- Small bundle size

**Alternatives Considered:**
- React: Larger bundle, runtime overhead, but more familiar
- Vue: Good option but larger than Svelte
- Vanilla JS: Current approach, hard to maintain

### 3. Schema Validation: Zod

**Decision:** Use Zod for runtime type validation

**Rationale:**
- TypeScript-first design
- Type inference (compile-time + runtime)
- Excellent error messages
- Composable schemas
- Small bundle size

**Alternatives Considered:**
- Yup: Popular but not TypeScript-first
- io-ts: Functional but more complex API
- class-validator: Good but decorator-based, heavier

### 4. Testing Framework: Vitest

**Decision:** Use Vitest for testing

**Rationale:**
- Extremely fast (Vite-powered)
- Native ESM support
- Excellent TypeScript support
- Jest-compatible API
- Great developer experience
- Built-in coverage

**Alternatives Considered:**
- Jest: Slower, requires more configuration
- Mocha + Chai: More setup required
- VS Code Test: Keep for integration tests

### 5. CSS Solution: TailwindCSS

**Decision:** Use TailwindCSS for styling

**Rationale:**
- Utility-first approach (rapid development)
- Excellent purge/tree-shaking
- Consistent design system
- Great IntelliSense support
- Easy to customize

**Alternatives Considered:**
- CSS Modules: Good isolation but verbose
- Styled Components: Runtime overhead
- Plain CSS: Current approach, hard to maintain

## Design Patterns

### 1. Repository Pattern

Abstracts data access logic from business logic.

```typescript
interface IRepository<T> {
  findById(id: string): Promise<T | undefined>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### 2. Use Case Pattern (Command Pattern)

Encapsulates a single user action.

```typescript
interface IUseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<Result<TResponse, Error>>;
}
```

### 3. Result Pattern

Replaces exceptions with explicit error handling.

```typescript
class Result<T, E> {
  static ok<T>(value: T): Result<T, never>;
  static fail<E>(error: E): Result<never, E>;
  
  isSuccess: boolean;
  isFailure: boolean;
  value: T;
  error: E;
}
```

### 4. Factory Pattern

Creates domain entities with validation.

```typescript
class WorkspaceFactory {
  static create(props: WorkspaceProps): Result<Workspace, ValidationError> {
    // Validate props
    // Create entity
  }
}
```

### 5. Adapter Pattern

Adapts external services to domain interfaces.

```typescript
interface IHistoryAdapter {
  readHistory(): Promise<HistoryEntry[]>;
}

class VSCodeHistoryAdapter implements IHistoryAdapter {
  // Adapts VS Code SQLite DB to our domain model
}
```

### 6. Observer Pattern

Notifies subscribers of data changes.

```typescript
class WorkspaceStore {
  private listeners: Set<Listener> = new Set();
  
  subscribe(listener: Listener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify(workspaces: Workspace[]): void {
    this.listeners.forEach(listener => listener(workspaces));
  }
}
```

## API Contracts

### WebView Message Protocol

```typescript
// Messages from Extension to WebView
type ExtensionMessage = 
  | { type: 'workspaces-updated'; data: WorkspaceDTO[] }
  | { type: 'tags-updated'; data: TagDTO[] }
  | { type: 'config-updated'; data: ConfigDTO }
  | { type: 'error'; message: string };

// Messages from WebView to Extension
type WebViewMessage =
  | { type: 'get-workspaces'; filter?: WorkspaceFilter }
  | { type: 'open-workspace'; workspaceId: string }
  | { type: 'toggle-favorite'; workspaceId: string }
  | { type: 'update-tags'; workspaceId: string; tags: string[] }
  | { type: 'sync-now' };
```

### DTOs (Data Transfer Objects)

```typescript
interface WorkspaceDTO {
  id: string;
  name: string;
  path: string;
  type: 'workspace' | 'folder';
  location: {
    type: 'local' | 'wsl' | 'remote';
    displayName: string;
    details?: Record<string, string>;
  };
  lastOpened: string; // ISO date string
  isFavorite: boolean;
  isPinned: boolean;
  description?: string;
  tags: string[];
  projectInfo?: {
    framework?: string;
    language?: string;
    packageManager?: string;
  };
}

interface TagDTO {
  id: string;
  name: string;
  color: string;
  isSystem: boolean;
  usageCount: number;
}
```

---

## Summary

This design provides:

✅ **Clear separation of concerns** - Each layer has a single responsibility  
✅ **Loose coupling** - Layers depend on abstractions, not implementations  
✅ **High testability** - Easy to mock dependencies and test in isolation  
✅ **Flexibility** - Easy to swap implementations without changing core logic  
✅ **Maintainability** - Code is organized logically and easy to navigate  
✅ **Scalability** - Easy to add new features without modifying existing code  
✅ **Type safety** - Strong typing throughout with runtime validation  
✅ **Error handling** - Explicit, consistent error handling with Result pattern  

The architecture is production-ready and follows industry best practices while remaining pragmatic for a VS Code extension.
