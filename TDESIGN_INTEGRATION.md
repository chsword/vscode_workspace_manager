# TDesign 集成文档

## 概述

本项目已成功集成 TDesign 图标库，提供了更加现代化和统一的视觉体验。

## 已安装的包

- `tdesign-icons-vue@0.4.1` - TDesign Vue 图标库

## 集成内容

### 1. 图标系统

已将所有界面图标从 Codicons 迁移到 TDesign Icons：

#### 顶部操作栏图标
- **刷新按钮**: `t-icon-refresh` - 同步 VS Code 历史记录
- **回滚按钮**: `t-icon-rollback` - 刷新列表
- **切换按钮**: `t-icon-swap` - 切换自动同步
- **设置按钮**: `t-icon-setting` - 打开设置

#### 搜索栏图标
- **搜索图标**: `t-icon-search` - 搜索提示
- **关闭图标**: `t-icon-close` - 清除搜索

#### 过滤器图标
- **列表视图**: `t-icon-view-list` - 全部视图
- **笔记本**: `t-icon-laptop` - 本地工作区
- **服务器**: `t-icon-server` - WSL 工作区
- **互联网**: `t-icon-internet` - 远程工作区
- **模块视图**: `t-icon-view-module` - 全部类型
- **打开文件夹**: `t-icon-folder-open` - 工作区类型
- **文件夹**: `t-icon-folder` - 文件夹类型
- **时间**: `t-icon-time` - 最近使用
- **星标**: `t-icon-star-filled` - 收藏夹
- **图钉**: `t-icon-pin-filled` - 已固定

#### 工作区操作图标
- **打开**: `t-icon-folder-open` - 打开工作区
- **收藏**: `t-icon-star` / `t-icon-star-filled` - 添加/取消收藏
- **固定**: `t-icon-pin` / `t-icon-pin-filled` - 固定/取消固定
- **标签**: `t-icon-discount` - 编辑标签
- **编辑**: `t-icon-edit` - 编辑描述
- **删除**: `t-icon-delete` - 移除工作区

#### 标签过滤器图标
- **折扣标签**: `t-icon-discount` - 标签过滤器标题

#### 加载状态图标
- **加载中**: `t-icon-loading` - 配合 `rotating` class 实现旋转动画

### 2. 样式更新

#### 图标基础样式
```css
.t-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    line-height: 1;
}
```

#### 旋转动画
```css
.rotating {
    animation: rotate 1s linear infinite;
}
```

#### 搜索图标定位
```css
.search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--vscode-input-foreground);
    opacity: 0.6;
    pointer-events: none;
    font-size: 14px;
}
```

### 3. 交互优化

- 所有按钮都采用 TDesign 的图标，保持统一的视觉风格
- 图标大小和间距符合 TDesign 设计规范
- 支持图标旋转动画（用于加载状态）
- 图标在不同状态下有清晰的视觉反馈

### 4. 国际化

所有界面文本已本地化为中文：
- 按钮提示文本
- 过滤器标签
- 统计信息
- 空状态提示

## 使用示例

### HTML 中使用图标
```html
<button class="icon-button" title="刷新">
    <i class="t-icon t-icon-refresh"></i>
</button>
```

### 带旋转动画的图标
```html
<i class="t-icon t-icon-loading rotating"></i>
```

### JavaScript 中切换图标状态
```javascript
const icon = button.querySelector('.t-icon');
icon.classList.add('rotating');  // 开始旋转
icon.classList.remove('rotating');  // 停止旋转
```

## TDesign 图标资源

TDesign 图标库提供了超过 1000+ 的图标，涵盖：
- 基础图标
- 方向图标  
- 提示建议类
- 编辑类
- 数据类
- 品牌类
- 地图类

完整图标列表：https://tdesign.tencent.com/vue/components/icon

## 设计原则

1. **统一性** - 所有图标来自同一图标库，保持视觉统一
2. **清晰性** - 图标语义明确，易于理解
3. **响应式** - 图标在不同主题下都有良好表现
4. **动画流畅** - 状态转换有平滑的动画效果

## 未来优化

1. 按需加载图标以减小打包体积
2. 支持更多 TDesign 组件（如 Button、Tag 等）
3. 完善主题定制功能
4. 添加更多动画效果

## 参考资料

- [TDesign 官网](https://tdesign.tencent.com/)
- [TDesign Vue Icons](https://www.npmjs.com/package/tdesign-icons-vue)
- [TDesign 设计指南](https://tdesign.tencent.com/design/overview)
