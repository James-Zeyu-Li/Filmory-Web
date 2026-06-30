# Filmory-Web 前端模块化与 UI/UX 设计规范

这份文档将 Filmory-Web 项目的前端架构、组件复用策略、UI 设计哲学和交互体验准则合二为一。我们致力于打造一个极具质感、逻辑清晰且高度内聚的专业级数字资产管理 (DAM) 系统。

---

## 1. 核心设计哲学

### "视觉与交互的极度和谐 (Extreme Visual and Interactive Harmony)"
Filmory 的所有模块**必须**在视觉和交互上保持极度和谐，绝不允许出现“各自为战”的割裂感。即使是完全不同的功能模块（如器材、财务、胶卷），都必须严格复用同一套组件库和布局结构。

- **拒绝强行割裂**：尽量避免使用让用户完全丢失上下文的全局大 Tab 切换。优先使用“上下游结构”（例如上方是项目集，下方是单卷），或者“沉浸式全景展开”。
- **空间一致性**：导航栏、快捷入口、卡片布局，必须与其内在的业务逻辑严格对应。

---

## 2. 核心独立前端模块 (Frontend Modules & API)

为了贯彻绝对的组件复用，任何在多个页面重复出现的交互元素**必须**调用全局模块，**严禁在各个 View 中手动堆砌 div 临时实现**。

### A. 居中弹窗 `<Modal>`
**用途**：用于轻量级的输入、设置面板、快速新建表单等，需要打断用户当前流程的聚焦操作。
**文件位置**：`src/components/Modal.tsx`
**调用与配置示例**：
```tsx
import { Modal } from '../../components/Modal';

<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  style={{ maxWidth: '600px', maxHeight: '90vh' }} // 可选，定义弹窗内容区样式
  overlayStyle={{ backdropFilter: 'blur(8px)' }} // 可选，定义遮罩层样式
>
  <h3>新建项目</h3>
  {/* 内容 */}
</Modal>
```

### B. 侧滑抽屉 `<Drawer>`
**用途**：用于“深度编辑”、“长表单配置”和“重度详情查看”（如胶卷的具体参数修改）。它从右侧滑出，**不会阻断用户对底层列表的视觉连贯性**。
**文件位置**：`src/components/Drawer.tsx`
**调用与配置示例**：
```tsx
import { Drawer } from '../../components/Drawer';

<Drawer 
  isOpen={isDrawerOpen} 
  onClose={() => setIsDrawerOpen(false)} 
  width={600} // 可选，定义抽屉的宽度像素，默认为 500
>
  <div className="drawer-header">...</div>
  <div className="drawer-content">...</div>
  <div className="drawer-footer">...</div>
</Drawer>
```

### C. 空状态反馈 `<EmptyState>`
**用途**：任何列表、网格或面板如果数据为空，**必须**展示标准的空状态，禁止只留一片白。
**文件位置**：`src/components/EmptyState.tsx`
**调用与配置示例**：
```tsx
import { EmptyState } from '../../components/EmptyState';
import { Film } from 'lucide-react';

<EmptyState 
  icon={Film} 
  title="没有进行中的任务" 
  description="所有的拍摄任务都已归档，或者您还没有开始记录。" 
  actionButton={<button onClick={createNew}>新建</button>} // 可选
/>
```

### D. 危险操作的二次确认 `useConfirm`
**用途**：任何破坏性操作（如删除、归档、清空数据），**必须**通过全局确认拦截，杜绝使用原生的 `window.confirm`。
**文件位置**：`src/contexts/ConfirmContext.tsx`
**调用与配置示例**：
```tsx
import { useConfirm } from '../../contexts/ConfirmContext';

const MyComponent = () => {
  const { confirm } = useConfirm();

  const handleDelete = async () => {
    const isConfirmed = await confirm({
      title: '确认删除？',
      message: '删除后此数据将永久丢失，且无法恢复。',
      variant: 'danger', // 'danger' | 'warning' | 'info'
      confirmText: '永久删除'
    });
    
    if (isConfirmed) {
      // 真实删除逻辑
    }
  };
};
```

---

## 3. 视觉元素与默认标准

### A. 图标系统：严禁原生 Emoji
**绝对禁止**在生产代码中使用原生 Emoji。统一调用 `lucide-react` 矢量图。
- 默认尺寸推荐：大容器 `size={20}`，普通按钮 `size={16}`，小字号 meta 信息 `size={14}`。
- 图文对齐微调：如果图标与文字在一排，通常加一点间距：`marginRight: '4px'`。

### B. 圆角、阴影与拟物化
- 高频应用 `var(--radius-md)` (8px) 和 `var(--radius-lg)` (12px)。
- **毛玻璃效果**：在弹窗、顶栏或遮罩层上多运用 `backdrop-filter: blur(4px~8px)` 和含有透明度的背景。
- 拒绝死板的纯色，利用 `<Drawer>` 或 `<Modal>` 本身的磨砂遮罩带来高级感。

### C. 列表与表单配置 (iOS Style)
在需要堆叠大量选项的页面（如 Settings 或复杂的配置面），抛弃宽大的卡片，改用紧凑的 **类 iOS 分组列表风格 (Grouped List)**。
- 表单元素使用默认类：`form-control` (输入框/下拉栏), `primary` / `secondary` / `danger` / `warning` (按钮)。
- 图标按钮（仅有图没有字）必须增加类名 `icon-btn`。

---

## 4. 宏观布局与 Z-Index 规范

### App 层级骨架
- 主体骨架为 Flex 布局。左侧 `Sidebar`，右侧 `main.app-main-content` 必须设置 `flex: 1` 和 `overflow-y: auto`，让右侧主体能独立滚动且不影响侧边栏和全屏浮层。

### 层级叠放顺序 (Z-Index)
为了确保抽屉、弹窗和全屏警告不互相穿模，必须严守以下标准：
1. **基础布局**: `<MobileHeader>` 等 `(z-index: 100)`
2. **侧滑与抽屉**: `<Drawer>` 与侧边栏弹出态 `(z-index: 1000)`
3. **全局弹窗**: `<Modal>` 及其遮罩层 `(z-index: 9999)`
4. **致命/加载层**: 全局处理动画与 Toast `(z-index: 10000)`

### 响应式 (Responsive)
必须处理 `max-width: 768px` 和 `max-width: 1024px` 两个关键断点。移动端下，主网格必须平滑切换为 `grid-template-columns: 1fr` 避免横向溢出。

---

## 5. 页面特定布局规范 (Page-Specific Layout Patterns)

针对类似 `GearView` (器材库) 和 `RollsView` (拍摄卷) 这样拥有大量顶部操作区（Tab + 搜索 + 排序）的页面，统一遵循以下流式响应布局标准：

### A. 侧边栏“抢跑”折叠 (Sidebar Preemptive Collapse)
- **核心逻辑**：在页面宽度缩小到迫使主内容（如顶部 Toolbar）换行之前，**优先折叠侧边栏**。
- **触发点**：当前项目设定在 `1250px`。当 `window.innerWidth < 1250` 时，侧边栏自动进入 `collapsed` (72px) 状态，为右侧主区域释放近 200px 空间，从而最大程度延长单行工具栏的展示寿命。

### B. 顶部操作区 (Toolbar) 自动换行与流式拉伸
- **结构规范**：
  - 外层容器使用 `.rolls-toolbar`（`flex-wrap: wrap`）。
  - 左侧 Tab 组（如 `.tab-navigation`）设定为 `flexShrink: 0`。
  - 右侧操作组（如 `.rolls-toolbar-actions` 包含搜索、排序）设定为 `flex: 1 1 auto` 且 `maxWidth: 100%`，并在内部 `justify-content: flex-end`。
- **视觉效果**：
  - **宽屏（同行）**：右侧操作组占据剩余空间并靠右对齐，与左侧 Tab 形成两端对齐感。
  - **窄屏（换行）**：当空间不足时，右侧操作组整块掉落至第二行，并利用 `maxWidth: 100%` 自动舒展占满当前行的全部宽度。内部的搜索和排序按钮继续保持完美靠右对齐，严禁出现右侧大块突兀留白。
- **极端窄屏**：当屏幕宽度小于 `950px` 时，通过 CSS 媒体查询触发 `.rolls-toolbar` 的 `justify-content: center !important`，确保移动端小屏下的多行布局绝对居中。

### C. 规避响应式动画“闪现” Bug (Transition Glitch Prevention)
- **问题定义**：CSS `transition` 会在屏幕跨越关键媒体查询断点（如 `1024px` 转为移动端隐藏 Drawer）时，错误地对宽度/位移进行过渡，引发瞬间的“弹出 (Pop-out)”或重绘闪烁。
- **解决标准**：在负责响应式的父组件（如 `Sidebar.tsx`）中，不仅要判断状态，还必须判断**“是否正处于移动端临界值之下且非开关操作”**。如果是，利用内联样式动态注入 `transition: none`。这能确保窗口尺寸跨越断点时的“瞬间切换（无痕）”，同时完美保留用户手动点击汉堡菜单时的丝滑滑出动画。
