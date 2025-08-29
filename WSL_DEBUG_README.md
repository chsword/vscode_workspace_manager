# WSL Workspace Debug Guide

## 问题描述
如果您的WSL工作区无法正确打开，请按照以下步骤进行调试。

## 调试步骤

### 1. 查看详细日志
当您尝试打开WSL工作区时，扩展会生成详细的日志信息：

1. 打开VS Code
2. 按 `Ctrl+Shift+P` (或 `Cmd+Shift+P` on Mac)
3. 输入 "Developer: Toggle Developer Tools" 并选择
4. 在开发者工具中切换到 "Console" 标签
5. 尝试打开WSL工作区
6. 查看控制台中的日志信息

### 2. 日志格式说明
扩展现在会输出带时间戳的详细日志：

```
[2025-01-29T10:30:45.123Z] WorkspaceManager.openWorkspace: { id: "xxx", newWindow: false }
[2025-01-29T10:30:45.124Z] WorkspaceManager.openWorkspace.found: { workspaceId: "xxx", workspaceName: "xxx", ... }
[2025-01-29T10:30:45.125Z] WorkspaceManager.openWorkspace.wsl.start: { originalPath: "xxx", workspaceType: "xxx" }
```

### 3. 运行调试脚本
我们提供了一个调试脚本来测试WSL路径处理：

```bash
node debug-wsl.js
```

这个脚本会：
- 测试不同的WSL路径格式
- 显示路径转换过程
- 生成最终的URI
- 提供手动测试的指导

### 4. 常见问题排查

#### 问题1: WSL扩展未安装
**症状**: 日志显示 "command 'vscode.openFolder' not found"
**解决**: 安装 "Remote WSL" 扩展

#### 问题2: WSL发行版未运行
**症状**: 连接超时或连接被拒绝
**解决**:
```bash
wsl -l -v  # 查看WSL状态
wsl -d Ubuntu  # 启动Ubuntu发行版
```

#### 问题3: 路径格式错误
**症状**: 日志显示路径转换异常
**解决**: 检查路径格式是否正确

#### 问题4: 权限问题
**症状**: 访问被拒绝
**解决**: 确保对WSL文件系统有适当的权限

### 5. 手动测试URI
从调试脚本或日志中复制生成的URI，然后：

1. 按 `Ctrl+Shift+P`
2. 输入 "Remote-WSL: New Window" 或直接使用URI
3. 手动测试URI是否能正确打开

### 6. 收集调试信息
如果问题仍然存在，请收集以下信息：

1. **VS Code版本**: Help → About
2. **WSL版本**: `wsl --version`
3. **WSL发行版**: `wsl -l -v`
4. **安装的扩展**: 特别是Remote相关扩展
5. **完整的日志输出**: 从开发者控制台复制
6. **调试脚本输出**: `node debug-wsl.js` 的完整输出

### 7. 故障排除清单

- [ ] WSL已安装并运行
- [ ] VS Code Remote WSL扩展已安装
- [ ] 工作区路径格式正确
- [ ] 对WSL文件系统有访问权限
- [ ] 防火墙未阻止WSL连接
- [ ] VS Code有足够权限访问WSL

## 获取帮助

如果按照以上步骤仍然无法解决问题，请提供：
1. 完整的调试日志
2. 调试脚本的输出
3. 您的系统配置信息
4. 具体的错误消息
