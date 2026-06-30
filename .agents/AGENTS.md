# Filmory-Web AI 协作规则 (AI Collaboration Rules)

> 这是一份为 AI 代理 (Antigravity 等) 设定的项目级自定义规则（Workspace Customizations Root）。在任何新对话中，AI 必须严格遵守以下准则。

## 1. 沟通与执行风格 (Communication & Execution Style)
- **拒绝自作主张 (No Proactive Modifications)**：在进行任何涉及整体布局更改、大范围重构或架构调整前，**必须先提供草案/计划并多次向用户确认**。不得在未经确认的情况下直接运行修改。
- **步步为营 (Step-by-Step)**：严格遵循单功能循环原则（Single-Feature Cycle）。一次只解决一个明确的问题，禁止在一次回复中夹带多个不相关的需求。
- **刨根问底 (Deep CSS/UX Understanding)**：在修复 UI 问题时，不要只做头痛医头的“补丁修复”（例如生硬地增加 `max-width: 560px` 或强行使用 JS 控制），必须深刻理解 Flexbox/Grid 的流式渲染原理，给出如 `maxWidth: 100%` 拉伸、媒体查询预折叠等“优雅解法”。

## 2. 极致的 UI/UX 标准 (Extreme UI/UX Standards)
- **抢跑式响应折叠 (Preemptive Collapse)**：在响应式设计中，当主内容区域即将感到拥挤但尚未触发破坏性换行前，**优先牺牲/折叠外围组件**（如侧边栏），以保障核心工作区的单行完整性。
- **无缝平滑断点 (Seamless Breakpoint Transitions)**：严禁由于 CSS `transition` 和 `@media` 断点冲突导致的“闪现 (Glitch / Pop-out)”。必须利用 React 的 Resize 监听（如 `window.innerWidth <= 1024`）动态移除跨越断点时的动画（`transition: none`），确保窗口缩放与手动操作（如点击汉堡菜单）的动画互相独立且完美。
- **拒绝尴尬留白 (No Awkward Gaps)**：当 Flex 布局中的元素因为空间不足被挤到第二行时，必须通过 `flex: 1` 或 `maxWidth: 100%` 让其自动舒展占满新行，避免左对齐造成的右侧大片突兀空白。

## 3. 文档作为真理之源 (Docs as Single Point of Truth)
- 在任何新对话的开头，如果涉及到新模块开发，必须主动查阅 `docs/` 下的架构规范文件：
  - `FRONTEND_UI_GUIDELINES.md` (前端规范与布局范式)
  - `DEVELOPMENT_GUIDELINES.md` (开发与工程标准)
  - `ROADMAP_TODO.md` (宏观进度与验收)
  - `DATABASE_SCHEMA.md` (表结构定义)
- 所有重大的架构变更、新引入的 UI 范式，在实现且用户验收满意后，**必须同步追加到上述 docs 中**，以保持知识库的新鲜。
