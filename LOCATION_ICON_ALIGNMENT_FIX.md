# Local/WSL/Remote 图标对齐优化

## 完成日期
2025年10月15日

## 问题描述
Local、WSL、Remote 位置标签中的图标与文字垂直对齐不佳,看起来不够整齐。

## 解决方案

### 1. 工作区卡片中的位置标签 (`.workspace-location`)

#### 优化前的问题:
- 图标和文字垂直位置不一致
- 行高设置不合理(1.4 太大)
- 缺少 `vertical-align` 属性

#### 优化后的改进:
```css
.workspace-location {
    font-size: 10px;
    padding: 3px 6px;
    border-radius: 8px;
    background-color: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-weight: 500;
    border: 1px solid var(--vscode-badge-background);
    transition: all var(--transition-duration);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 1.2;           /* 从 1.4 降低到 1.2 */
    vertical-align: middle;      /* 新增 */
}

.workspace-location .codicon,
.workspace-location > .codicon {
    font-size: 12px;            /* 从 14px 降低到 12px,更协调 */
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;      /* 新增 */
    flex-shrink: 0;             /* 新增,防止图标被压缩 */
}

/* 确保 emoji fallback 也对齐 */
.workspace-location .codicon::after {
    line-height: 1;
    vertical-align: middle;
}
```

### 2. 筛选按钮中的图标 (`.filter-btn`)

#### 优化前的问题:
- 图标过大(16px)
- 文字缺少对齐属性

#### 优化后的改进:
```css
/* 统一图标大小和对齐 */
.filter-btn .codicon,
.view-btn .codicon,
.type-btn .codicon {
    font-size: 14px;            /* 从 16px 降低到 14px */
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;      /* 新增 */
    flex-shrink: 0;             /* 新增 */
}

/* 统一文本对齐 */
.filter-btn > span:not(.codicon),
.view-btn > span:not(.codicon),
.type-btn > span:not(.codicon) {
    line-height: 1.4;           /* 新增 */
    vertical-align: middle;      /* 新增 */
}
```

## 技术要点

### 1. **Flexbox 居中**
- 使用 `display: inline-flex` + `align-items: center` 实现水平方向居中
- 适用于容器级别的对齐

### 2. **Vertical-align**
- 补充 `vertical-align: middle` 确保行内元素垂直对齐
- 对 inline 和 inline-flex 元素都有效

### 3. **Line-height 调整**
- 图标: `line-height: 1` (消除额外空间)
- 容器: `line-height: 1.2` (适度的行高,既不过大也不过小)
- 文字: `line-height: 1.4` (保持可读性)

### 4. **Flex-shrink 控制**
- `flex-shrink: 0` 防止图标在空间不足时被压缩
- 保持图标固定大小和形状

### 5. **字体大小平衡**
- 工作区标签图标: 12px (与 10px 文字搭配)
- 筛选按钮图标: 14px (与 12px 文字搭配)
- 保持视觉平衡和层次感

## 测试验证

### 测试场景:
1. ✅ 工作区卡片中的 Local/WSL/Remote 标签
2. ✅ 顶部筛选栏的 Local/WSL/Remote 按钮
3. ✅ 不同浏览器/缩放级别
4. ✅ Emoji fallback 模式

### 预期效果:
- 图标与文字基线对齐
- 视觉上居中
- 不同大小图标保持一致对齐
- 无压缩或变形

## 浏览器兼容性
- ✅ Chromium (VS Code Webview 内核)
- ✅ Chrome/Edge (现代版本)
- ✅ Firefox (现代版本)
- ✅ Safari (现代版本)

## 性能影响
- 无性能开销,纯 CSS 实现
- 不增加 DOM 节点
- 不影响渲染性能

## 相关文件
- `media/main.css` (样式定义)
- `media/main.js` (图标 HTML 生成)
- `src/webview/workspaceWebviewProvider.ts` (筛选按钮 HTML)
- `src/webview/workspaceWebviewPanel.ts` (筛选按钮 HTML)
