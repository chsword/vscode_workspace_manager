# Workspace Manager

*Read this in other languages: [English](README.md), [中文](README.zh-cn.md)*

A powerful VS Code extension for managing and organizing your workspaces with advanced features like tagging, location tracking, and **real VS Code history synchronization**.

## ✨ Features

### 🗂️ Workspace Management
- **Real VS Code Sync**: Directly reads from VS Code's SQLite database (`state.vscdb`) for accurate history
- **Automatic Detection**: Syncs with VS Code's recently opened workspaces and files
- **Smart Organization**: Categorizes workspaces by location (Local, WSL, Remote)
- **Multiple Types**: Supports workspaces, folders, and individual files

### 🏷️ Advanced Tagging System
- **System Tags**: Auto-detects project types (Vue, React, .NET, Java, Python, etc.)
- **Custom Tags**: Create your own tags with custom colors and descriptions
- **Smart Filtering**: Filter workspaces by tags, location, and project type

### 📍 Location Intelligence
- **Local Workspaces**: Organize by drive and external storage
- **WSL Integration**: Seamlessly manage Windows Subsystem for Linux projects
- **Remote Development**: Track SSH and remote server workspaces with proper labels

### ⭐ Personal Organization
- **Favorites**: Mark important workspaces for quick access
- **Pinning**: Pin frequently used workspaces to the top
- **Descriptions**: Add custom descriptions to remember project details

### 🔄 Real-Time Synchronization
- **SQLite Database Reader**: Reads VS Code's actual storage for 100% accurate history
- **Cross-Platform Support**: Works on Windows, macOS, and Linux
- **Remote Workspace Support**: Handles WSL, SSH, and other remote connections
- **Configurable Intervals**: Set custom sync frequency
- **Project Detection**: Auto-detects frameworks, languages, and tools

## 🚀 Getting Started

1. **Install the Extension**: Search for "Workspace Manager" in VS Code extensions
2. **Open the Panel**: Click on the Workspace Manager icon in the activity bar
3. **Automatic Setup**: The extension will automatically sync from VS Code's history database
4. **Start Organizing**: Add tags, descriptions, and favorites to your workspaces

## 📖 Usage

### Opening Workspaces
- **Single Click**: Open in current window
- **Ctrl/Cmd + Click**: Open in new window
- **Right Click**: Access context menu with more options

### Managing Tags
- Click on tag chips to filter workspaces
- Use the gear icon to access tag management
- Create custom tags with colors and descriptions

### Organizing Workspaces
- ⭐ **Star**: Add to favorites
- 📌 **Pin**: Pin to top of list
- 📝 **Edit**: Add descriptions and manage tags
- 🗑️ **Remove**: Remove from workspace list

### Filtering and Search
- **Search Bar**: Search by name, path, or description
- **Location Filters**: Filter by Local, WSL, or Remote
- **View Options**: Switch between Recent, Favorites, and Pinned
- **Tag Filters**: Filter by one or multiple tags

## ⚙️ Configuration

Access settings through VS Code Settings → Extensions → Workspace Manager:

```json
{
  "workspaceManager.autoSync": true,
  "workspaceManager.syncInterval": 5,
  "workspaceManager.maxRecentWorkspaces": 50,
  "workspaceManager.showFullPath": true,
  "workspaceManager.autoTagging": true,
  "workspaceManager.excludedFolders": ["node_modules", ".git", "dist", "build"],
  "workspaceManager.defaultTags": ["Work", "Personal", "Frontend", "Backend"]
}
```

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `autoSync` | Automatically sync VS Code history | `true` |
| `syncInterval` | Sync interval in minutes | `5` |
| `maxRecentWorkspaces` | Maximum workspaces to track | `50` |
| `showFullPath` | Show full paths in workspace list | `true` |
| `autoTagging` | Auto-detect and apply system tags | `true` |
| `excludedFolders` | Folders to exclude from scanning | `["node_modules", ".git", ...]` |
| `defaultTags` | Default custom tags to create | `["Work", "Personal", ...]` |

## 🎨 System Tags

The extension automatically detects and applies system tags based on project content:

- **Frontend**: Vue, React, Angular, Svelte
- **Backend**: Node.js, .NET, Java, Python, Go, Rust, PHP
- **Frameworks**: Spring Boot, Django
- **Languages**: TypeScript, JavaScript

## 🔧 Commands

Access these commands through the Command Palette (Ctrl/Cmd + Shift + P):

- `Workspace Manager: Show Workspaces` - Open the workspace panel
- `Workspace Manager: Refresh Workspaces` - Manually sync workspaces
- `Workspace Manager: Open Settings` - Open extension settings

## 📊 Statistics

The status bar shows useful statistics:
- Total number of tracked workspaces
- Recent activity (this week)
- Favorites and pinned workspaces count

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/chsword/vscode_workspace_manager.git
cd vscode_workspace_manager

# Install dependencies
npm install

# Compile the extension
npm run compile

# Watch for changes during development
npm run watch
```

### Running Tests

```bash
npm test
```

### Packaging

```bash
# Install vsce globally
npm install -g vsce

# Package the extension
vsce package
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues and Support

- **Bug Reports**: [GitHub Issues](https://github.com/chsword/vscode_workspace_manager/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/chsword/vscode_workspace_manager/discussions)
- **Support**: Check the [FAQ](docs/FAQ.md) or open an issue

## 🙏 Acknowledgments

- VS Code Extension API documentation
- The VS Code community for inspiration and feedback
- All contributors who help improve this extension

---

**Made with ❤️ for the VS Code community**

## 🐛 Known Issues

- WSL workspace paths may require proper URL encoding in some cases
- Large workspace databases may take longer to sync initially
- Some remote workspace types may not be fully supported

## 📋 Release Notes

### 0.0.1

Initial release of Workspace Manager with the following features:
- Real VS Code history synchronization
- WSL workspace support
- Advanced tagging system
- Location-based organization
- Modern webview interface
- SQLite database integration

---

## 📚 Extension Guidelines

This extension follows VS Code extension best practices and guidelines.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## 🛠️ Development

Built with modern TypeScript and VS Code Extension API.

**Enjoy managing your workspaces!**
