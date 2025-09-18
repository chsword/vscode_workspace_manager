# VS Code 扩展沙箱机制研究报告

## 🔒 VS Code 扩展安全机制概述

根据对VS Code API文档和扩展开发指南的研究，VS Code扩展确实有一些安全限制，但并不是传统意义上的严格沙箱：

### 1. 扩展执行环境

#### ✅ **Node.js 主进程环境**
- VS Code扩展运行在Node.js主进程中，不是沙箱化的
- 可以完全访问Node.js的所有API（fs, path, os, child_process等）
- 可以执行系统命令和访问文件系统

#### ⚠️ **Webview 沙箱化**
- 扩展的Webview部分是沙箱化的
- 受到Content Security Policy (CSP) 限制
- 无法直接访问Node.js API或文件系统

### 2. 文件系统访问权限

#### ✅ **完全文件系统访问**
- 扩展可以读写任何文件系统位置
- 包括用户主目录、系统目录等
- 可以访问VS Code的配置和数据文件

#### 📁 **推荐的存储位置**
- `context.globalStoragePath` - 扩展全局存储目录
- `context.storageUri` - 工作区特定存储目录
- `context.extensionPath` - 扩展安装目录（只读）

### 3. SQLite访问分析

#### ✅ **理论上可行**
- 扩展可以访问VS Code的SQLite数据库文件
- 位置：`%APPDATA%/Code/User/globalStorage/state.vscdb` (Windows)
- 没有特殊的沙箱限制阻止这种访问

#### ⚠️ **实际可能的限制**
1. **文件锁定** - VS Code运行时可能锁定数据库文件
2. **权限问题** - 某些系统配置可能限制访问
3. **SQLite版本兼容性** - 不同SQLite版本的兼容性问题
4. **打包后的模块问题** - 扩展打包后native模块可能无法正常工作

## 🧪 需要测试的关键点

### 1. 实际环境测试
- [ ] 扩展在VS Code中运行时的文件访问能力
- [ ] SQLite3模块在扩展环境中的工作状态
- [ ] VS Code数据库文件的实际访问权限

### 2. 打包后测试
- [ ] 扩展打包后native模块是否仍然可用
- [ ] VSIX安装后的权限变化
- [ ] 不同操作系统下的行为差异

### 3. 权限边界测试
- [ ] 访问系统敏感文件的能力
- [ ] 网络访问权限
- [ ] 子进程执行权限

## 🔍 潜在问题分析

### 1. Native模块打包问题
**最可能的问题**：SQLite3是native模块，在扩展打包过程中可能出现问题：
- esbuild可能无法正确处理native二进制文件
- 不同架构的兼容性问题
- 运行时动态加载失败

### 2. 文件访问时机问题
- VS Code启动时数据库可能被锁定
- 需要确保在合适的时机访问数据库

### 3. 跨平台兼容性
- 不同操作系统的路径差异
- 权限管理机制差异

## 💡 推荐解决方案

### 1. 使用VS Code API优先
```typescript
// 推荐：使用VS Code API获取历史记录
vscode.workspace.workspaceFolders
vscode.workspace.getConfiguration()
```

### 2. SQLite访问优化
```typescript
// 检查文件锁定状态
// 使用只读模式打开数据库
// 添加重试机制
```

### 3. Fallback机制
```typescript
// 主要方案：SQLite访问
// 备用方案：VS Code API + 配置缓存
// 最后方案：用户手动添加
```

## 📋 测试计划

1. **开发环境测试** - 在F5调试模式下测试所有功能
2. **打包测试** - 创建VSIX包并安装测试
3. **生产环境测试** - 在实际用户环境中测试
4. **跨平台测试** - Windows、macOS、Linux环境测试

## 结论

VS Code扩展**没有严格的沙箱限制**，主要问题可能来自：
1. 🔧 **Native模块打包** - SQLite3的打包和部署问题
2. 🔒 **文件锁定** - VS Code运行时的数据库锁定
3. 📦 **部署差异** - 开发环境vs生产环境的差异

建议优先解决native模块打包问题，并完善fallback机制。