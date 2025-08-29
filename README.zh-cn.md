# 工作区管理器

*其他语言版本: [English](README.md), [中文](README.zh-cn.md)*

一个功能强大的VS Code扩展，用于管理和组织你的工作区，具有高级功能如标签管理、位置跟踪和自动同步。

## ✨ 功能特性

### 🗂️ 工作区管理
- **自动检测**：与VS Code最近打开的工作区和文件同步
- **智能组织**：按位置分类工作区（本地、WSL、远程）
- **多种类型**：支持工作区、文件夹和单个文件

### 🏷️ 高级标签系统
- **系统标签**：自动检测项目类型（Vue、React、.NET、Java、Python等）
- **自定义标签**：创建带有自定义颜色和描述的标签
- **智能过滤**：按标签、位置和项目类型过滤工作区

### 📍 位置智能
- **本地工作区**：按驱动器和外部存储组织
- **WSL集成**：无缝管理Windows子系统Linux项目
- **远程开发**：跟踪SSH和远程服务器工作区

### ⭐ 个人组织
- **收藏夹**：标记重要工作区以便快速访问
- **置顶**：将常用工作区置顶显示
- **描述**：添加自定义描述来记住项目详情

### 🔄 自动同步
- **实时同步**：自动跟踪新打开的工作区
- **可配置间隔**：设置自定义同步频率
- **项目检测**：自动检测框架、语言和工具

## 🚀 快速开始

1. **安装扩展**：在VS Code扩展中搜索"Workspace Manager"
2. **打开面板**：点击活动栏中的工作区管理器图标
3. **自动设置**：扩展将自动检测你最近的工作区
4. **开始组织**：为你的工作区添加标签、描述和收藏

## 📖 使用方法

### 打开工作区
- **单击**：在当前窗口打开
- **Ctrl/Cmd + 单击**：在新窗口打开
- **右键单击**：访问包含更多选项的上下文菜单

### 管理标签
- 点击标签芯片来过滤工作区
- 使用齿轮图标访问标签管理
- 创建带有颜色和描述的自定义标签

### 组织工作区
- ⭐ **收藏**：添加到收藏夹
- 📌 **置顶**：置顶到列表顶部
- 📝 **编辑**：添加描述和管理标签
- 🗑️ **移除**：从工作区列表移除

### 过滤和搜索
- **搜索栏**：按名称、路径或描述搜索
- **位置过滤器**：按本地、WSL或远程过滤
- **视图选项**：在最近、收藏和置顶之间切换
- **标签过滤器**：按一个或多个标签过滤

## ⚙️ 配置

通过VS Code设置 → 扩展 → 工作区管理器访问设置：

```json
{
  "workspaceManager.autoSync": true,
  "workspaceManager.syncInterval": 5,
  "workspaceManager.maxRecentWorkspaces": 50,
  "workspaceManager.showFullPath": true,
  "workspaceManager.autoTagging": true,
  "workspaceManager.excludedFolders": ["node_modules", ".git", "dist", "build"],
  "workspaceManager.defaultTags": ["工作", "个人", "前端", "后端"]
}
```

### 配置选项

| 设置 | 描述 | 默认值 |
|------|------|--------|
| `autoSync` | 自动同步VS Code历史记录 | `true` |
| `syncInterval` | 同步间隔（分钟） | `5` |
| `maxRecentWorkspaces` | 最大跟踪工作区数量 | `50` |
| `showFullPath` | 在工作区列表中显示完整路径 | `true` |
| `autoTagging` | 自动检测并应用系统标签 | `true` |
| `excludedFolders` | 扫描时排除的文件夹 | `["node_modules", ".git", ...]` |
| `defaultTags` | 要创建的默认自定义标签 | `["工作", "个人", ...]` |

## 🎨 系统标签

扩展根据项目内容自动检测并应用系统标签：

- **前端**：Vue、React、Angular、Svelte
- **后端**：Node.js、.NET、Java、Python、Go、Rust、PHP
- **框架**：Spring Boot、Django
- **语言**：TypeScript、JavaScript

## 🔧 命令

通过命令面板（Ctrl/Cmd + Shift + P）访问这些命令：

- `工作区管理器：显示工作区` - 打开工作区面板
- `工作区管理器：刷新工作区` - 手动同步工作区
- `工作区管理器：打开设置` - 打开扩展设置

## 📊 统计信息

状态栏显示有用的统计信息：
- 跟踪的工作区总数
- 最近活动（本周）
- 收藏和置顶工作区数量

## 🛠️ 开发

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/chsword/vscode_workspace_manager.git
cd vscode_workspace_manager

# 安装依赖
npm install

# 编译扩展
npm run compile

# 开发期间监听变化
npm run watch
```

### 运行测试

```bash
npm test
```

### 打包

```bash
# 全局安装vsce
npm install -g vsce

# 打包扩展
vsce package
```

## 🤝 贡献

我们欢迎贡献！详情请参见我们的[贡献指南](CONTRIBUTING.md)。

1. Fork仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开Pull Request

## 📝 许可证

本项目基于MIT许可证 - 详情请参见[LICENSE](LICENSE)文件。

## 🐛 问题和支持

- **错误报告**：[GitHub Issues](https://github.com/chsword/vscode_workspace_manager/issues)
- **功能请求**：[GitHub Discussions](https://github.com/chsword/vscode_workspace_manager/discussions)
- **支持**：查看[FAQ](docs/FAQ.md)或提交issue

## 🙏 致谢

- VS Code扩展API文档
- VS Code社区的灵感和反馈
- 所有帮助改进此扩展的贡献者

---

**为VS Code社区倾情打造 ❤️**
