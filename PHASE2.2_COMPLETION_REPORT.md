# Phase 2.2 完成报告: 创建核心 Use Cases

## 📋 任务概述

Phase 2.2 的目标是创建应用层 (Application Layer) 的核心 Use Cases,实现业务用例的编排,连接领域实体与基础设施仓储。

## ✅ 完成内容

### 1. 创建 Use Case 基础接口

**文件**: `src/core/application/interfaces/IUseCase.ts` (12 行)

```typescript
export interface IUseCase<TRequest, TResponse> {
    execute(request: TRequest): Promise<TResponse>;
}
```

- 泛型接口,支持任意请求/响应类型
- 所有 Use Case 实现此接口,保证一致性
- 返回 Promise 支持异步操作

### 2. 创建 8 个核心 Use Cases

#### 2.1 GetWorkspacesUseCase (145 行)
**功能**: 获取工作区列表,支持过滤、搜索、排序

**请求参数**:
- `locationType?`: 按位置类型过滤 (local/wsl/remote)
- `isFavorite?`: 按收藏状态过滤
- `tagIds?`: 按标签过滤
- `searchQuery?`: 搜索查询
- `sortBy?`: 排序字段 (name/lastOpened/isPinned)
- `sortOrder?`: 排序顺序 (asc/desc)

**响应**:
- `workspaces`: Workspace 实体数组
- `total`: 总数量

**特性**:
- 支持多条件组合过滤
- 使用实体的 `matchesSearch()` 方法进行搜索
- 默认排序: 置顶优先,然后按最后打开时间倒序

#### 2.2 GetWorkspaceByIdUseCase (48 行)
**功能**: 通过 ID 获取单个工作区

**请求**: `workspaceId` (string)
**响应**: Workspace 实体

**特性**:
- ID 验证通过 WorkspaceId 值对象
- NotFoundError 处理

#### 2.3 CreateWorkspaceUseCase (62 行)
**功能**: 创建新工作区

**请求参数**:
- `name`, `path`, `type`, `location` (必需)
- `description`, `tags`, `isFavorite`, `isPinned` (可选)

**响应**: 新创建的 Workspace 实体

**特性**:
- 使用 Workspace.create() 工厂方法
- 检查路径是否已存在 (existsByPath)
- 完整的验证错误处理

#### 2.4 UpdateWorkspaceUseCase (121 行)
**功能**: 更新工作区属性

**请求参数**:
- `workspaceId` (必需)
- `name?`, `description?`, `tagsToAdd?`, `tagsToRemove?` (可选)

**响应**: 更新后的 Workspace 实体

**特性**:
- 支持部分更新 (只更新提供的字段)
- 批量添加/删除标签
- 每个更新操作独立验证

#### 2.5 DeleteWorkspaceUseCase (54 行)
**功能**: 删除工作区

**请求**: `workspaceId` (string)
**响应**: void

**特性**:
- 先验证工作区是否存在
- NotFoundError 友好提示

#### 2.6 ToggleFavoriteUseCase (85 行)
**功能**: 切换工作区收藏状态

**请求**: `workspaceId` (string)
**响应**: 
- `workspace`: 更新后的实体
- `isFavorite`: 新的收藏状态

**特性**:
- 直接调用实体的 markAsFavorite()/unmarkAsFavorite()
- 自动保存更新

#### 2.7 TogglePinUseCase (85 行)
**功能**: 切换工作区置顶状态

**请求**: `workspaceId` (string)
**响应**: 
- `workspace`: 更新后的实体
- `isPinned`: 新的置顶状态

**特性**:
- 直接调用实体的 pin()/unpin()
- 自动保存更新

#### 2.8 SyncWorkspacesUseCase (137 行)
**功能**: 同步 VS Code 历史记录与本地数据

**请求**: `vscodeWorkspaces` (WorkspaceItem[])
**响应**:
- `added`: 新增数量
- `updated`: 更新数量
- `removed`: 删除数量
- `total`: 同步后总数

**特性**:
- 新工作区: 自动添加
- 已存在工作区: 更新 lastOpened 时间戳
- 不在历史记录的工作区: 自动删除 (保留收藏和置顶)
- 路径验证容错 (跳过无效路径)

### 3. 创建 WorkspaceDomainRepositoryAdapter (120 行)

**作用**: 桥接领域层 (Workspace 实体) 与基础设施层 (WorkspaceItem)

**接口**: `IWorkspaceDomainRepository`
- `getAll()`: 返回 Workspace[]
- `getById(id: WorkspaceId)`: 返回 Workspace
- `getByPath(path: WorkspacePath)`: 返回 Workspace
- `existsByPath(path)`: boolean
- `save(workspace)`: void
- `delete(id)`: void
- `count()`: number

**实现**: `WorkspaceDomainRepositoryAdapter`
- 依赖注入 `IWorkspaceRepository` (Infrastructure层)
- 自动转换: WorkspaceItem ↔ Workspace
- 使用 `Workspace.fromItem()` / `workspace.toItem()`
- 错误转换: StorageError → RepositoryError

**优势**:
- Use Cases 完全不感知 WorkspaceItem
- 领域层与基础设施层解耦
- 单一转换点,易于维护

### 4. 扩展错误类型

**文件**: `src/shared/errors/index.ts`

新增 **RepositoryError** 类:
```typescript
export class RepositoryError extends StorageError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}
```

- 语义化错误命名 (领域层使用 RepositoryError)
- 继承自 StorageError,保持错误处理一致性

### 5. 更新 Workspace 实体

**新增方法**: `updateName(name: WorkspaceName): void`

```typescript
updateName(name: WorkspaceName): void {
    this._name = name;
}
```

- 支持 UpdateWorkspaceUseCase 更新名称
- 接受 WorkspaceName 值对象,保证验证

### 6. 注册到 IoC 容器

**文件**: `src/infrastructure/ioc/container.ts`

注册内容:
```typescript
// Adapter
container.registerSingleton<IWorkspaceDomainRepository>('IWorkspaceDomainRepository', WorkspaceDomainRepositoryAdapter);

// Use Cases
container.registerSingleton('GetWorkspacesUseCase', GetWorkspacesUseCase);
container.registerSingleton('GetWorkspaceByIdUseCase', GetWorkspaceByIdUseCase);
container.registerSingleton('CreateWorkspaceUseCase', CreateWorkspaceUseCase);
container.registerSingleton('UpdateWorkspaceUseCase', UpdateWorkspaceUseCase);
container.registerSingleton('DeleteWorkspaceUseCase', DeleteWorkspaceUseCase);
container.registerSingleton('ToggleFavoriteUseCase', ToggleFavoriteUseCase);
container.registerSingleton('TogglePinUseCase', TogglePinUseCase);
container.registerSingleton('SyncWorkspacesUseCase', SyncWorkspacesUseCase);
```

- Singleton 生命周期
- 依赖自动注入
- 类型安全

## 📊 代码统计

### 新增文件 (10 个)

| 文件 | 行数 | 说明 |
|------|------|------|
| IUseCase.ts | 12 | Use Case 接口 |
| GetWorkspacesUseCase.ts | 145 | 获取工作区列表 |
| GetWorkspaceByIdUseCase.ts | 48 | 获取单个工作区 |
| CreateWorkspaceUseCase.ts | 62 | 创建工作区 |
| UpdateWorkspaceUseCase.ts | 121 | 更新工作区 |
| DeleteWorkspaceUseCase.ts | 54 | 删除工作区 |
| ToggleFavoriteUseCase.ts | 85 | 切换收藏 |
| TogglePinUseCase.ts | 85 | 切换置顶 |
| SyncWorkspacesUseCase.ts | 137 | 同步历史记录 |
| WorkspaceDomainRepositoryAdapter.ts | 120 | 仓储适配器 |
| **总计** | **869 行** | |

### 修改文件 (3 个)

| 文件 | 变更 | 说明 |
|------|------|------|
| errors/index.ts | +8 行 | 新增 RepositoryError |
| Workspace.ts | +8 行 | 新增 updateName() |
| container.ts | +17 行 | 注册 Use Cases 和 Adapter |

**Phase 2.2 总代码量**: **902 行**

## 🎯 架构设计亮点

### 1. CQRS 模式雏形
- **查询 Use Cases**: GetWorkspaces, GetWorkspaceById
- **命令 Use Cases**: Create, Update, Delete, Toggle*, Sync

### 2. 单一职责原则
- 每个 Use Case 只负责一个业务用例
- UpdateWorkspace 支持部分更新,避免多个 Use Case

### 3. 依赖倒置
```
Use Cases → IWorkspaceDomainRepository (接口)
                    ↑
      WorkspaceDomainRepositoryAdapter (实现)
                    ↓
           IWorkspaceRepository (Infrastructure)
```

- Use Cases 依赖抽象 (IWorkspaceDomainRepository)
- Adapter 桥接两个层次的接口

### 4. 适配器模式
- WorkspaceDomainRepositoryAdapter 隐藏 WorkspaceItem
- Use Cases 只操作 Workspace 实体
- 自动双向转换 (fromItem/toItem)

### 5. Result 模式
- 所有 Use Case 返回 `Result<T, E>`
- 类型安全的错误处理
- 无异常抛出,错误可预测

## 📝 使用示例

### 示例 1: 获取本地工作区并排序

```typescript
const useCase = container.resolve<GetWorkspacesUseCase>('GetWorkspacesUseCase');

const result = await useCase.execute({
    locationType: 'local',
    sortBy: 'lastOpened',
    sortOrder: 'desc'
});

if (result.isSuccess) {
    console.log(`找到 ${result.value.total} 个本地工作区`);
    result.value.workspaces.forEach(ws => {
        console.log(`- ${ws.name.toString()}: ${ws.path.toString()}`);
    });
}
```

### 示例 2: 创建新工作区

```typescript
const useCase = container.resolve<CreateWorkspaceUseCase>('CreateWorkspaceUseCase');

const result = await useCase.execute({
    name: 'My New Project',
    path: '/home/user/projects/new-project',
    type: 'folder',
    location: {
        type: 'local',
        displayName: 'Local'
    },
    tags: ['react', 'typescript'],
    isFavorite: true
});

if (result.isSuccess) {
    console.log(`工作区已创建: ID = ${result.value.id.toString()}`);
} else {
    console.error(`创建失败: ${result.error.message}`);
}
```

### 示例 3: 更新工作区

```typescript
const useCase = container.resolve<UpdateWorkspaceUseCase>('UpdateWorkspaceUseCase');

const result = await useCase.execute({
    workspaceId: 'workspace-123',
    name: 'Renamed Project',
    description: 'Updated description',
    tagsToAdd: ['vue'],
    tagsToRemove: ['react']
});

if (result.isSuccess) {
    console.log(`工作区已更新,新名称: ${result.value.name.toString()}`);
}
```

### 示例 4: 同步 VS Code 历史

```typescript
const useCase = container.resolve<SyncWorkspacesUseCase>('SyncWorkspacesUseCase');
const vscodeHistory = getVSCodeRecentlyOpened(); // 获取 VS Code 历史

const result = await useCase.execute({
    vscodeWorkspaces: vscodeHistory
});

if (result.isSuccess) {
    console.log(`同步完成:`);
    console.log(`  新增: ${result.value.added}`);
    console.log(`  更新: ${result.value.updated}`);
    console.log(`  删除: ${result.value.removed}`);
    console.log(`  总数: ${result.value.total}`);
}
```

## 🔄 与 Phase 2.1 的集成

Phase 2.2 Use Cases 完全基于 Phase 2.1 创建的领域实体:

### 实体方法使用

| Use Case | 使用的实体方法 |
|----------|---------------|
| GetWorkspaces | matchesSearch() |
| CreateWorkspace | Workspace.create() |
| UpdateWorkspace | updateName(), updateDescription(), addTag(), removeTag() |
| ToggleFavorite | markAsFavorite(), unmarkAsFavorite() |
| TogglePin | pin(), unpin() |
| SyncWorkspaces | Workspace.fromItem(), updateLastOpened() |

### 值对象使用

- **WorkspaceId**: GetWorkspaceById, UpdateWorkspace, Delete, Toggle*
- **WorkspaceName**: UpdateWorkspace
- **WorkspacePath**: CreateWorkspace, SyncWorkspaces

## ✅ 编译结果

```bash
npm run compile

✓ check-types - 0 errors
✓ lint - 0 errors  
✓ esbuild - build finished

Exit code: 0
```

**无编译错误,无 Lint 警告!**

## 🎓 设计原则遵循

### 1. Clean Architecture
- **应用层 (Use Cases)** 编排业务流程
- **领域层 (Entities)** 封装业务逻辑
- **基础设施层 (Repositories)** 处理持久化

### 2. SOLID 原则
- **SRP**: 每个 Use Case 单一职责
- **OCP**: 通过接口扩展,无需修改现有代码
- **LSP**: IWorkspaceDomainRepository 可替换
- **ISP**: 接口精简,Use Case 只依赖所需方法
- **DIP**: Use Cases 依赖抽象接口

### 3. DDD 战术设计
- **Use Cases**: Application Services
- **Entities**: 富领域模型
- **Value Objects**: 值对象验证
- **Repositories**: 聚合根持久化

## 📈 下一步 (Phase 2.3)

重构 WorkspaceManager:
- 移除直接仓储访问
- 使用 Use Cases 替代业务逻辑
- 转变为协调器角色
- 简化复杂度

## 🎉 成就总结

✅ **8 个核心 Use Cases** 覆盖所有工作区操作  
✅ **适配器模式** 解耦领域层与基础设施层  
✅ **Result 模式** 类型安全错误处理  
✅ **IoC 容器** 自动依赖注入  
✅ **902 行** 高质量业务逻辑代码  
✅ **0 编译错误** 类型系统验证通过  
✅ **完整文档** 使用示例和架构说明  

**Phase 2.2 圆满完成!** 🎊
