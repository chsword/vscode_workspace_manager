# Project Context

## Purpose
**VSCode Workspace Manager** is a powerful VS Code extension designed to help developers manage and organize their workspaces efficiently. The extension provides advanced workspace management capabilities including:

- **Real VS Code History Sync**: Direct SQLite database integration (`state.vscdb`) for accurate workspace history
- **Smart Organization**: Automatic categorization by location (Local, WSL, Remote)
- **Advanced Tagging**: System-detected and custom tags with filtering capabilities
- **Personal Organization**: Favorites, pinning, descriptions, and custom metadata
- **Cross-Platform Support**: Works seamlessly on Windows, macOS, and Linux with special handling for WSL and remote workspaces

**Target Users**: Developers who work with multiple projects and need efficient workspace organization and quick access to their frequently used projects.

## Tech Stack

### Core Technologies
- **TypeScript**: Primary language (ES2022, Node16 module system)
- **VS Code Extension API**: v1.103.0+
- **Node.js**: Runtime environment with native module support

### Build & Development Tools
- **esbuild**: Fast bundling and compilation
- **ESLint**: Code linting with TypeScript plugin
- **TypeScript Compiler**: Type checking and compilation (watch mode support)

### Key Libraries
- **uuid**: Unique identifier generation for workspace items
- **SQLite**: Reading VS Code's state database (via native node-sqlite3 bindings)

### Frontend (WebView)
- **Vanilla JavaScript**: Custom webview implementation
- **CSS3**: Modern styling with gradients, animations, and backdrop filters
- **Codicon Icons**: VS Code's official icon font

## Project Conventions

### Code Style
- **Naming Conventions**:
  - Classes: `PascalCase` (e.g., `WorkspaceManager`, `WorkspaceSyncService`)
  - Functions/Methods: `camelCase` (e.g., `syncWorkspaces`, `createOrShow`)
  - Imports: `camelCase` or `PascalCase`
  - Constants: `UPPER_SNAKE_CASE` for true constants
  
- **TypeScript Standards**:
  - Strict mode enabled
  - Explicit return types preferred
  - Interface-first approach for data structures
  - Strong typing with minimal `any` usage

- **Formatting Rules**:
  - Semicolons required
  - Curly braces required for all control structures
  - Use `===` and `!==` (eqeqeq rule)
  - No throw literals (throw Error objects instead)

- **File Organization**:
  - One class per file
  - Related functionality grouped in directories (`services/`, `storage/`, `webview/`)
  - Shared types in `types.ts`

### Architecture Patterns

**Layered Architecture**:
```
Extension Entry (extension.ts)
    ↓
Core Logic (workspaceManager.ts)
    ↓
Services Layer (workspaceSyncService.ts)
    ↓
Storage Layer (workspaceStorage.ts)
    ↓
Data Persistence (VS Code ExtensionContext)
```

**Key Patterns**:
- **Singleton Pattern**: WebView panels (createOrShow pattern)
- **Service Pattern**: Separated concerns (SyncService, Storage)
- **Observer Pattern**: Event-based communication between webview and extension
- **Repository Pattern**: WorkspaceStorage abstracts data access
- **Dependency Injection**: Services passed via constructor

**Webview Architecture**:
- Message-based communication (postMessage/onMessage)
- Command pattern for user actions
- State management in extension host
- HTML/CSS/JS bundled separately from extension code

### Testing Strategy
- **Unit Tests**: Located in `src/test/`
- **Test Framework**: VS Code's testing framework
- **Build Task**: Separate watch task for tests (`watch-tests`)
- **Integration Testing**: Focus on VS Code API integration and workspace operations
- **Manual Testing**: Extension launch configuration for debugging

### Git Workflow
- **Repository**: GitHub (chsword/vscode_workspace_manager)
- **Branching**: Main branch for stable releases
- **Commit Messages**: Descriptive messages in Chinese and English
- **Documentation**: Extensive markdown documentation for features and fixes
- **Change Management**: OpenSpec-based change proposals and planning

## Domain Context

### VS Code Extension Development
- **Activation Events**: `onStartupFinished` - lazy activation after VS Code loads
- **Contribution Points**: Commands, configuration, webviews, status bar items
- **Extension Host**: Runs in separate Node.js process from VS Code UI

### Workspace Types
- **Workspace Files**: `.code-workspace` multi-root workspaces
- **Folder Workspaces**: Single folder opened in VS Code
- **File Workspaces**: Individual files opened without folder context

### Location Types
- **Local**: Standard file system paths (Windows drives, Unix paths)
- **WSL**: Windows Subsystem for Linux (`\\wsl$\` or `vscode-remote://wsl+...`)
- **Remote**: SSH, Dev Containers, Codespaces (`vscode-remote://ssh-remote+...`)

### SQLite Database Schema
- VS Code stores workspace history in `state.vscdb`
- Key table: `ItemTable` with `key` and `value` columns
- Relevant keys: `history.recentlyOpenedPathsList`, workspace metadata
- JSON-encoded values requiring parsing

### System Tag Detection
Auto-detects project types based on file presence:
- **Frontend**: package.json with Vue/React/Angular dependencies
- **Backend**: pom.xml (Java), *.csproj (.NET), requirements.txt (Python)
- **Language-Specific**: Cargo.toml (Rust), go.mod (Go), composer.json (PHP)

## Important Constraints

### Technical Constraints
- **VS Code API Version**: Must support v1.103.0+
- **Node.js Compatibility**: Native modules require proper node-gyp setup
- **SQLite Access**: Read-only access to VS Code's database (no writes to prevent corruption)
- **Cross-Platform Paths**: Must handle Windows, Unix, and WSL path formats correctly
- **Webview Limitations**: CSP restrictions, no direct DOM access from extension

### Performance Constraints
- **Sync Interval**: Default 5 minutes to avoid excessive database reads
- **Max Workspaces**: Default limit of 50 to prevent UI performance issues
- **Database Reads**: Use cached results when possible, avoid blocking operations

### Security Constraints
- **File System Access**: Limited to VS Code's workspace folders and extension storage
- **SQLite Database**: Read-only to prevent corrupting VS Code's state
- **Webview CSP**: Strict content security policy in webview HTML

### UI/UX Constraints
- **VS Code Theme Integration**: Must respect user's color theme
- **Codicon Icons**: Use official VS Code icon font for consistency
- **Responsive Layout**: Support various editor sizes and layouts

## External Dependencies

### VS Code APIs
- **vscode.workspace**: Workspace and configuration management
- **vscode.window**: UI elements (status bar, notifications, webviews)
- **vscode.commands**: Command registration and execution
- **vscode.ExtensionContext**: Storage, subscriptions, extension lifecycle

### System Dependencies
- **VS Code State Database**: `~/.vscode/User/globalStorage/state.vscdb` (macOS/Linux) or `%APPDATA%\Code\User\globalStorage\state.vscdb` (Windows)
- **WSL Integration**: Requires WSL installed on Windows for WSL workspace detection
- **Remote Extensions**: Optional but enhances remote workspace support

### Build Dependencies
- **esbuild**: Fast JavaScript bundler
- **TypeScript**: Type system and compiler
- **ESLint**: Linting and code quality

### Runtime Dependencies
- **uuid**: MIT licensed, stable API
- **better-sqlite3** or **sqlite3**: Native SQLite bindings (optional, used for database reading)

### Development Tools
- **VS Code Extension Test Runner**: Built-in testing framework
- **OpenSpec CLI**: Change proposal management (`openspec` command)

### Known Integration Points
- **VS Code Settings**: `workspaceManager.*` configuration namespace
- **VS Code Commands**: Registered under `workspaceManager.*` category
- **Status Bar**: Left-aligned items for quick access
- **Webview Panel**: Custom editor for workspace management UI
