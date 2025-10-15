# Workspace Management Core - Delta Specification

## ADDED Requirements

### REQ-WMC-DL-001: Workspace Entity

**Description**: The system SHALL implement a Workspace domain entity with business logic and factory methods.

#### Scenario: Create new workspace
**Given** valid workspace parameters (id, name, path, location type)  
**When** calling `Workspace.create()`  
**Then** return Result with valid Workspace entity  
**And** entity has all required properties initialized

#### Scenario: Toggle favorite status
**Given** an existing Workspace entity  
**When** calling `workspace.toggleFavorite()`  
**Then** favorite status is inverted  
**And** updatedAt timestamp is updated

### REQ-WMC-DL-002: Tag Entity

**Description**: The system SHALL implement a Tag entity with usage tracking and validation.

#### Scenario: Track tag usage
**Given** an existing Tag entity  
**When** calling `tag.incrementUsage()` or `tag.decrementUsage()`  
**Then** usageCount is updated correctly  
**And** usageCount never goes below 0

### REQ-WMC-DL-003: Value Objects

**Description**: The system SHALL implement immutable value objects with validation for WorkspaceId, WorkspacePath, and WorkspaceName.

#### Scenario: WorkspaceId validation supports UUID and Base64
**Given** workspace ID string (UUID or Base64)  
**When** calling `WorkspaceId.create(id)`  
**Then** validate format using UUID or Base64 pattern  
**And** return Result with WorkspaceId or ValidationError

#### Scenario: WorkspacePath normalization
**Given** raw path string (Windows/WSL/Remote)  
**When** calling `WorkspacePath.create(path)`  
**Then** normalize path separators and casing  
**And** detect location type (Local/WSL/Remote)  
**And** return Result with WorkspacePath or ValidationError

### REQ-WMC-AL-001: Get Workspaces Use Case

**Description**: The system SHALL implement a use case to retrieve all workspaces with filtering and sorting.

#### Scenario: Get all workspaces with filters
**Given** repository contains workspaces  
**When** executing `GetWorkspacesUseCase`  
**Then** return Result with sorted workspace list  
**And** apply filters (favorites, tags, location)  
**And** apply sorting (name, lastOpened, createdAt)

### REQ-WMC-AL-002: Create Workspace Use Case

**Description**: The system SHALL implement a use case to create new workspace with validation.

#### Scenario: Create valid workspace
**Given** valid workspace creation parameters  
**When** executing `CreateWorkspaceUseCase`  
**Then** validate using WorkspaceValidationService  
**And** detect project info using WorkspaceDetectionService  
**And** save to repository  
**And** return Result with created Workspace

### REQ-WMC-AL-003: Update Workspace Use Case

**Description**: The system SHALL implement a use case to update existing workspace properties.

#### Scenario: Update workspace properties
**Given** workspace ID and updated properties  
**When** executing `UpdateWorkspaceUseCase`  
**Then** validate changes using WorkspaceValidationService  
**And** update entity  
**And** save to repository  
**And** return Result with updated Workspace

### REQ-WMC-DS-001: Workspace Path Service

**Description**: The system SHALL implement a service for workspace path operations and validation.

#### Scenario: Validate workspace path
**Given** workspace path string  
**When** calling `validatePath(path)`  
**Then** check if path exists  
**And** check if path is accessible  
**And** return Result with boolean and validation errors

#### Scenario: Parse WSL path
**Given** WSL path like `vscode-remote://wsl+Ubuntu/home/user/project`  
**When** calling `parseWslPath(path)`  
**Then** extract distribution name (Ubuntu)  
**And** extract Linux path (/home/user/project)  
**And** return Result with parsed components

### REQ-WMC-DS-002: Workspace Detection Service

**Description**: The system SHALL implement a service to detect project framework, language, and package manager.

#### Scenario: Detect Vue.js project
**Given** workspace contains package.json with vue dependency  
**When** calling `detectProjectInfo(path)`  
**Then** return framework="Vue.js"  
**And** detect version from package.json  
**And** set confidence=high

#### Scenario: Detect Spring Boot project
**Given** workspace contains pom.xml or build.gradle with spring-boot-starter  
**When** calling `detectProjectInfo(path)`  
**Then** return framework="Spring Boot"  
**And** return language="Java"  
**And** detect package manager (Maven/Gradle)  
**And** set confidence=high

### REQ-WMC-DS-003: Workspace Validation Service

**Description**: The system SHALL implement a service for entity validation and conflict detection.

#### Scenario: Validate workspace for creation
**Given** workspace creation data  
**When** calling `validateWorkspace(workspace, 'create')`  
**Then** validate required fields (name, path)  
**And** check path format  
**And** check for duplicate path in repository  
**And** return Result with validation errors if any

#### Scenario: Detect duplicate workspace by path
**Given** workspace path  
**When** calling `checkDuplicatePath(path, excludeId)`  
**Then** query repository for existing workspace with same path  
**And** exclude current workspace if excludeId provided  
**And** return Result with duplicate info

### REQ-WMC-IL-001: IoC Container Setup

**Description**: The system SHALL configure dependency injection container using TSyringe.

#### Scenario: Register domain services
**Given** application startup  
**When** setting up IoC container  
**Then** register IWorkspacePathService → WorkspacePathService  
**And** register IWorkspaceDetectionService → WorkspaceDetectionService  
**And** register IWorkspaceValidationService → WorkspaceValidationService  
**And** register as singletons

#### Scenario: Register use cases
**Given** application startup  
**When** setting up IoC container  
**Then** register all 8 use cases  
**And** inject required dependencies  
**And** register as transient (new instance per request)

### REQ-WMC-IL-002: Repository Implementations

**Description**: The system SHALL implement repositories using VS Code extension storage.

#### Scenario: Save workspace to storage
**Given** Workspace entity  
**When** calling `repository.save(workspace)`  
**Then** convert entity to WorkspaceItem  
**And** persist to VS Code globalState  
**And** return Result with saved entity

#### Scenario: Query workspaces with filters
**Given** filter criteria (tags, favorites, location)  
**When** calling `repository.findAll(filters)`  
**Then** load workspaces from storage  
**And** convert to domain entities  
**And** apply filters  
**And** return Result with filtered list

## MODIFIED Requirements

### REQ-WMC-IL-MOD-001: WorkspaceId Format Support

**Original Behavior**: WorkspaceId only accepted UUID format  
**New Behavior**: WorkspaceId accepts both UUID and Base64 formats

#### Scenario: Support legacy Base64 IDs
**Given** workspace ID in Base64 format from WorkspaceSyncService  
**When** calling `WorkspaceId.create(id)`  
**Then** validate against Base64 pattern (/^[A-Za-z0-9+/]+=*$/)  
**And** return Result.ok if valid  
**And** maintain backward compatibility with existing data

**Rationale**: WorkspaceSyncService generates Base64-encoded IDs from paths. Without this support, all synced workspaces would fail validation and not display in WebView.

## REMOVED Requirements

_None - This is a new implementation_
