# Grainfolio UI/UX TODO

本文件保存 Grainfolio 前端体验工作的详细设计、交互、响应式、无障碍、i18n 与视觉验收要求。

## 文档职责

- [`ROADMAP_TODO.md`](./ROADMAP_TODO.md) 是唯一的优先级、实施顺序和顶层完成状态来源。
- 本文件只维护 UI/UX 任务的详细范围与子项，不重复维护第二套顶层状态。
- 涉及 Auth 安全、Dexie/Supabase 数据口径、同步、Storage、支付或部署时，顶层顺序以 Roadmap 为准，Cloud/backend 实施与验收细节见 [`CLOUD_TODO.md`](./CLOUD_TODO.md)。
- 完成一个 UI/UX 任务时，先完成本文件的验收项，再回到 Roadmap 更新对应顶层 checkbox。

## 全局验收基线

所有未完成 UI/UX 任务默认同时满足以下要求，不在每个任务中重复展开：

- 复用现有 `Modal`、`Drawer`、`EmptyState`、`PageTabs`、`ConfirmContext` 和全局反馈，不在页面内另造近义组件。
- 桌面、tablet 与手机至少覆盖 `320 / 375 / 390 / 430 / 768 / 1024px`；不能通过修改移动样式破坏桌面交互。
- 所有图标按钮具有可访问名称；移动端主要触控目标至少 `44px`；键盘 focus 清晰可见。
- 状态不能只靠颜色表达；错误与异步结果使用适当的 `role="alert"` 或 `aria-live`。
- 所有用户可见界面文案同时提供中文和英文；用户数据、品牌型号、EXIF 与历史内容不自动翻译。
- 使用主题 token 支持明暗主题；禁止新增散落 raw hex、重复 inline layout style 或与断点冲突的硬编码宽度。
- 视觉以克制、现代的实色表面、边框和状态色建立层级；禁止新增渐变背景、渐变按钮或渐变装饰。明暗主题均须使用 token 保证文字、图标、边界和 focus 状态具有清晰对比度。
- 动效保持 `150-200ms`，只用于状态连续性，并支持 `prefers-reduced-motion`。
- 空列表与空工作区使用共享 `EmptyState`；危险操作使用全局确认，不使用原生 `window.confirm`。
- 验证至少包含相邻组件测试、相关回归、`npm run lint`；高风险旅程再补 Playwright 和真实设备 smoke。

## 已完成基线

这些项目作为后续页面必须保持的视觉与交互基线；顶层状态以 Roadmap 为准。

<a id="ui-baseline-mobile-workspace"></a>
### 移动端工作区与工具栏

- `<=1024px` 已为 Sync Badge 和 safe area 预留滚动空间。
- Photos 筛选、Gear 与拍摄记录工具栏已覆盖 tablet 和手机布局，桌面行为保持不变。
- 拍摄记录搜索使用完整双语 `aria-label` 与紧凑 placeholder，`320px` 不产生横向溢出。

<a id="ui-baseline-headers-tabs"></a>
### 页头与 PageTabs

- Gear、拍摄记录和 Compare 复用 `ResponsiveHeaderSubtitle`，桌面/移动使用独立双语文案。
- Gear、拍摄记录与 Insights 复用 segmented `PageTabs`；三项三等分、四项 `2 x 2`。
- Tabs 保留方向键、Home/End、roving tabindex、完整 ARIA 名称、主题 token 与 reduced-motion。

<a id="ui-baseline-insights-cleanup"></a>
### Insights 降噪

- 已移除年度高分胶卷、胶卷投入与库存估值、相机使用效率及对应聚合、文案和 CSS。
- 统计页当前优先呈现总览、常用机身/感光度、评分分布和月度趋势。
- 2026-08-20 再次核验 `StatsView`、双语词条和样式引用，未发现上述三个已移除模块重新进入渲染路径。

## 任务明细

本节同时保留已完成任务的最终契约和未完成任务的实施要求，避免完成后丢失回归基线；唯一顶层完成状态仍以 Roadmap checkbox 为准。

<a id="ui-fixed-bottom-layers"></a>
### UI-01 固定底部 context action 与 Sync Badge

**触发条件**

- 当前 Photos/Albums 未挂入主路由，也没有真实 `.batch-action-bar`；暂不为了测试渲染无功能浮条。
- 只有可见页面引入真实 context action 后才开始最终实现。

**实现要求**

- 提取共享 `FixedBottomActionBar`，统一使用 `.app-container` 的 fixed-bottom inset、layer gap 和 safe-area 变量。
- Sync Badge 属于 utility layer，context action 属于更高的当前任务层；两者都必须低于导航、Drawer 与 Modal。
- 两层同时出现时，操作条自动避开 Badge，主滚动区为两层和安全区预留空间。

**验收**

- 覆盖只有 Badge、只有 context action、两者同时出现和 iPhone safe-area 四种状态。
- 在 iPhone SE、标准 iPhone 与 tablet 做真实组合 smoke 后才能关闭 Roadmap 顶层任务。

<a id="ui-cloud-photo-recovery"></a>
### UI-02 Cloud 图片完整性恢复入口

**当前状态（2026-08-22）**

- 已完成：Settings 只在存在待补上传图片时显示修复入口，并提供成功、部分成功和失败反馈；`photoUploadRecoveryService` 的本地保留、重试、用户隔离及同用户 in-flight 去重测试均通过。
- 未完成：拍摄记录封面在压缩或 Dexie 写入失败时仍只进入 `console.error`，尚未提供用户可见反馈，也缺少覆盖这些失败路径的组件测试；因此本 UI 任务和真实 Cloud 最终验证均不能打勾。

**实现要求**

- 拍摄记录卡片的快速封面入口补完整文件选择反馈；图片压缩、Dexie 写入或上传准备失败必须用户可见。
- Settings 修复入口只在存在待补上传图片时显示，并区分成功、部分成功、失败和可重试状态。
- 移动端封面与修复操作保持至少 `44px` 触控目标，不遮挡同步状态或页面底部内容。

**验收**

- 组件测试覆盖选择文件、压缩失败、Dexie 写入失败、修复成功、部分成功和重试。
- Cloud 跨设备、object/metadata 对照和失败重试仍按 Roadmap 的 Storage 验收执行。

<a id="ui-auth-layout"></a>
### UI-03 Auth 独立路由与认证卡片

**目标**

- 使用“独立 URL + 居中认证卡片”，视觉轻量但技术上不是覆盖 Landing 的 Modal。
- 登录、注册、忘记密码和重设密码使用清晰独立页面，共享同一 `AuthShell`。

**目标路由**

- `/auth/login`
- `/auth/signup`
- `/auth/forgot-password`
- `/auth/reset-password`

**视觉结构**

- 桌面卡片使用 `width: min(420px, calc(100vw - 32px))`，使用主题实色背景和边框，不使用渐变或会压过表单的照片氛围层。
- `<=640px` 接近全屏，允许 `width: 100%`、`min-height: 100dvh` 和无圆角，不产生双层滚动。
- 共享品牌区、返回首页、消息容器、OAuth 区和底部辅助链接；各表单主体保持独立。

**页面内容与操作层级**

- 登录页：OAuth、邮箱、密码、忘记密码、登录、去注册。
- 注册页：显示名称、邮箱、密码、确认密码、密码规则、邮箱验证说明、注册、去登录。
- 每页只有一个实心主提交按钮；忘记密码紧贴密码字段，注册/登录互跳使用明确次级文字操作。
- 只渲染公开构建配置中真实启用的 OAuth provider；登录和注册页保持一致顺序、分隔线和按钮宽度。
- 移动端密码显示控件保留在输入尾部并具有 `44px` 触控区，不折成单独整行。

**无障碍与反馈**

- 提交失败聚焦第一个无效字段，并用 `aria-invalid`、`aria-describedby` 关联具体错误。
- 成功/失败消息可被屏幕阅读器及时感知；密码显示开关使用 `aria-pressed`。
- 密码规则使用图标加文字表达满足状态，不只依赖颜色。

**验收**

- 覆盖桌面/手机视觉、键盘 Tab 顺序、可见 focus、错误聚焦、消息播报和密码控件触控范围。
- 已完成：独立认证路由、旧 `/login` 兼容跳转、共享 `AuthShell`、主题 token、移动端全高卡片、状态播报和 reduced-motion；字段级错误会关联并聚焦对应输入，密码显示按钮具有 `aria-pressed` 且在移动端保持同排 `44px` 触控区，密码规则使用图标和状态文字，OAuth 仅按 `VITE_ENABLE_GOOGLE_OAUTH` / `VITE_ENABLE_GITHUB_OAUTH` 渲染。
- 前端验证：33 个认证/CTA 组件测试通过；6 个 Auth E2E 覆盖 canonical/legacy route、错误聚焦、键盘顺序、`320 / 375 / 430 / 667x375 landscape / 768px`、明暗主题、16px 移动输入、44px 触控区和无横向溢出。
- 未完成：真实 Cloud recovery session 的 user mismatch、过期/重复使用，真实 OAuth callback、精确 Redirect URL 与恶意 `next` 安全测试继续以 Roadmap 为准；本地 recovery guard 与页面 fallback 已存在，不应误写为尚未实现。

<a id="ui-dashboard-insights-finance"></a>
### UI-04 控制中心、拍摄报告与花费职责

**已完成结构**

- 控制中心只呈现当前拍摄、库存、使用中器材、快捷入口和继续拍摄，不嵌入完整统计图表。
- 拍摄报告与花费位于 Insights 独立 tabs；照片对照保持独立工具入口。

**剩余决策与要求**

- 确认是否需要最多三项“本月拍摄摘要”；不需要时保持当前聚焦工作流，不为了填充首页增加低价值 KPI。
- 如果增加摘要，推荐完成拍摄记录、本月胶卷与冲洗净支出、最常用相机，并提供“查看完整拍摄报告”。
- 每个统计块明确标注当前、本月、近 12 个月或全部时间；包含退款、售出或转卖抵扣时使用“净投入/净支出”。
- 待补价格默认只显示总数和前 3 项，提供查看全部和直达补录。

**验收**

- 控制中心首屏不滚动图表即可继续或新建拍摄。
- 空数据、长器材名称、手机和 tablet 不挤压主操作。
- 相同范围的财务数字必须和账本一致；去重与聚合规则由 Roadmap/数据层任务负责。

<a id="ui-film-insights"></a>
### UI-05 胶卷库存与胶卷洞察职责

**已完成结构**

- 独立胶卷报告已从侧栏移除；Insights 使用 `拍摄 / 花费 / 胶卷` tabs。
- 旧 `/film-insights` 兼容跳转到 `/insights?tab=film`，共享 PageTabs 保留 URL 和键盘语义。

**剩余体验收口**

- 器材库胶卷页只回答“手上还有什么”：新增/编辑、封面、库存数量和 `+/-`。
- 胶卷洞察以实际拍摄使用为主：顶部显示完成、彩色完成、黑白完成和正在拍摄；库存只作次级上下文。
- 默认列表只展示至少关联一条 active/archived 拍摄记录的非系统胶卷，并提供“显示全部已登记胶卷”。
- 每行呈现完成次数、最近完成日期和进行中数量；排序仅保留最近完成和完成使用次数。
- Drawer 保留正在使用和完成历史，剩余库存不抢占视觉主层级。
- 全局彩色/黑白占比从拍摄 tab 移到胶卷 tab，避免重复展示。

**验收**

- 覆盖空数据、只有库存未使用、只有 active、历史关联缺失、长名称和移动端单列。
- 筛选、排序与 Tabs 提供完整双语、键盘操作和无横向滚动。
- 统计数据规则与 `Map<filmStockId, Roll[]>` 聚合优化由 Roadmap/业务实现约束负责。

<a id="ui-insights-range"></a>
### UI-06 Insights 趋势时间范围

**实现要求**

- 摄影支出和完成拍摄趋势共用一个时间窗口：`12 个月 / 6 个月 / 3 个月 / 1 个月 / 近 7 天`。
- 默认 `12 个月`；使用清晰 segmented control，不使用下拉框。
- 近 7 天按天聚合，其余按月聚合；两个图表不能要求用户分别切换。

**验收**

- 范围切换后 X 轴、聚合粒度、标题和空态一致更新。
- 中英文和移动端不出现标签拥挤、横向滚动或控制器断裂。

<a id="ui-compare-workspace"></a>
### UI-07 Compare A/B 工作台

**当前边界**

- Compare 是两张本地照片的 A/B 对照工具，不依赖照片仓库，不包含行堆叠或代表照片管理。
- 默认使用 split 滑尺；模式按钮已有 `aria-pressed`，滑杆支持键盘，可切换左右双列。

**已完成实现**

- 上传区使用覆盖完整操作面的原生 file input，可通过键盘聚焦和触发，并提供共享 focus 状态。
- 非图片、对象 URL 创建失败和图片解码失败均提供双语可见 `role="alert"`；失败的单侧照片安全回退到可重新选择状态。
- 空工作区复用共享 `EmptyState`，并补齐共享空态与上传区的 reduced-motion 行为。
- 已删除旧 side-by-side/rows/photo-tile 与旧 split workspace 零引用 CSS；静态 inline layout 和 raw white/red 已迁移为命名样式及主题媒体 token，仅保留滑尺位置动态 CSS 变量。
- 默认 split 滑尺、左右双列、拖动、触控和方向键/Home/End 行为保持不变；滑尺百分比的可访问文本已双语化。

**验证记录（Compare 2026-08-20；全量回归 2026-08-22）**

- Compare Vitest：空态、原生文件控件、键盘焦点、无效文件、读取失败、双图、移除、模式切换和滑尺键盘控制共 `7 passed`。
- Compare Playwright：`320 / 375 / 430 / 768 / 1024px` 无横向溢出；英文双图与两种模式、无效文件、44px 清除按钮、暗色主题和 reduced-motion 共 `3 passed`。
- 最新全量 Vitest：`58 passed / 3 skipped` test files，`255 passed / 5 skipped` tests；lint 与 production build 已在相邻实现轮次通过，build 仅保留既有 chunk-size warning。
- 2026-08-22 复核 `i18n.spec.ts` 为 `4 failed / 1 passed`：3 条仍依赖未启用的 Dev Bypass，1 条仍查找已迁移的 Dashboard Batch import。它们属于 [`UI-09`](#ui-i18n-tail)，不代表 Compare 回归；Compare 自身的中英文覆盖已由上述 Vitest 与独立 E2E 验证。

<a id="ui-share-card"></a>
### UI-08 胶卷分享卡片生成器

**目标与内容**

- 生成可下载的复古胶片/拍立得风格卡片，用于小红书、Instagram 和朋友圈。
- 支持临时上传一张图片，也允许只生成器材/胶卷信息卡。
- 可选字段包括相机、镜头、胶卷品牌/型号、ISO、光圈、快门、焦段、日期、地点、评分和短备注；缺失字段自动隐藏。

**交互**

- 优先从拍摄记录详情或器材库进入。
- 提供 2-3 个视觉明确但结构一致的模板、实时预览、PNG/JPEG 导出和复制/下载动作。
- 手机预览不能要求横向滚动，导出尺寸和屏幕预览比例应保持一致。

**验收**

- 数据映射单测覆盖缺失字段和长文本。
- Playwright smoke 覆盖打开、选择模板、生成预览和下载操作可用。

<a id="ui-i18n-tail"></a>
### UI-09 i18n 长尾清理

**当前状态（2026-08-22）**

- Playwright `i18n.spec.ts` 当前 `4 failed / 1 passed`：工作区用例仍通过 `resetAndLogin()` 查找未启用的 Dev Bypass，试用转换用例仍查找已迁移的 Dashboard Batch import。
- Auth helper pages 的英文用例已通过；本项只需更新测试环境和真实入口假设，不应回退生产环境中的 Dev Bypass 隔离或恢复已移除的旧入口。

**范围**

- 复核隐藏/legacy Photos 子页面、Tags 管理和少量非主路径 service fallback。
- 日期、数字和货币继续通过 `Intl` 或统一 formatter，语言切换不触发货币换算。
- 用户输入、品牌型号、EXIF 和历史记录保持原文。
- 更新 `i18n.spec.ts` 的环境与入口假设：认证 bootstrap 不应要求 Dev Bypass 永远启用，Batch import 应从当前真实入口验证，而不是继续查找旧 Dashboard 按钮。

**验收**

- 新增或修改的 UI 文案必须同时有中英文 key，不在 JSX/CSS 中硬编码用户可见文本。
- 中文和英文在手机、tablet 和桌面均不因长度差异破坏页头、Tabs、按钮或表单布局。

<a id="ui-responsive-copy-actions"></a>
### UI-10 跨页面长文案、页头操作与工具栏窄屏收口

**完成实现**

- [x] 全局移动页头说明已改为最多两行，并移除拍摄记录页冲突的单行 `ellipsis`；标题仍保持单行，避免挤压主操作。
- [x] Gear 与拍摄记录页已加入 `<=360px` 的共享结构降级：主操作移动到第二行并占满宽度，桌面和平板布局不变。
- [x] Gear 工具栏已移除内联布局与 `minWidth: 240px`；Gear 和拍摄记录共用 `.rolls-toolbar-actions` 的弹性搜索/固定排序契约，不再由页面级规则竞争宽度。
- [x] `PageTabs` 在 tablet/手机以可预测网格展示移动短标签，完整名称仍由 `aria-label` 暴露；搜索框也补齐双语可访问名称。

已通过 Gear/Rolls 相关组件测试、lint、production build，以及 `responsive-toolbar.spec.ts` 的 `320 / 375 / 390 / 430 / 768 / 1024 / 1280px` 中英文矩阵。测试同时验证所有 Tabs、搜索和排序控件均在视口内，且页面无横向溢出；UI-10 已完成。

**文案规则**

- 固定产品文案优先提供人工编写的移动短版本，不使用字符数截断生成短文案；短版本必须仍能独立说明当前页面用途。
- 页头说明在手机允许最多两行，不默认强制单行省略；确实需要截断的用户生成内容使用两行 clamp，并提供可访问的完整名称或明确查看入口。
- 主操作使用摄影师能立即理解的短动词，例如 `New shoot / 新建拍摄`、`New collection / 新建项目集`、`Add camera / 添加相机`；不要通过缩小字号容纳 developer-centric 长句。
- 按钮的可见短文案与完整 `aria-label` 分离；图标不能替代动作名称，中文和英文必须分别审阅，不能假设英文长度更短。

**页头布局契约**

- 标准页头保持 `minmax(0, 1fr) auto`：标题区允许收缩，主操作区 `flex: 0 0 auto`，按钮内部不得逐词换行或被压成过窄胶囊。
- 标题、描述和按钮切换页面时保持稳定的垂直节奏，但不使用过大的固定高度制造空白；一行标题与两行标题通过统一 padding/min-height 自然过渡。
- 当标题、两行移动说明和主操作在同一行仍无法安全容纳时，整个操作区移动到第二行并占满可用宽度；禁止裁切按钮、缩小到不可读字号或只让半个按钮露出。
- 多个页头操作按重要性降级：保留一个主要动作；视图切换移入下方工具栏或已有 segmented control，不在极窄页头并排堆叠多个按钮。
- 动态切换 tab 导致标题和按钮变化时，保留现有 `150-200ms` 轻量淡入/位移和 reduced-motion，不对页头高度做导致跳动的长动画。

**Tabs、搜索与排序契约**

- `PageTabs` 在 tablet/手机继续占满容器；三项可三等分，四项使用 `2 x 2`。可见移动短标签保持单行，完整名称继续通过 `aria-label` 暴露。
- 不允许为了容纳标签把字号降到难读范围；若人工短标签仍无法容纳，应调整网格列数，而不是增加横向滚动。
- 搜索框容器统一 `min-width: 0; flex: 1 1 auto`，排序/筛选按钮 `flex: 0 0 auto` 且文字不换行；移除 Gear 与拍摄记录中互相竞争的内联 `minWidth`。
- `769-1024px` 优先让 Tabs 独占一行、搜索与排序占下一行；手机保持搜索为主要剩余宽度，排序为紧凑固定宽度。
- 搜索 placeholder 只作示例提示，完整用途必须由双语 `aria-label` 提供；placeholder 被浏览器视觉截断时不能损失操作语义。

**卡片与详情中的长内容**

- 用户生成的项目集、拍摄记录、相机、镜头和胶卷名称不得挤压删除、完成、库存调整或封面操作。
- 列表卡片名称可一至两行 clamp；详情标题应尽量完整显示并允许正常换行。操作按钮保持独立区域，不覆盖标题。
- 金额、日期、ISO、格式和数量等关键摄影元数据不和说明性长句竞争同一不可换行行；空间不足时按信息组整体换行。

**实施顺序**

1. 盘点 Dashboard、拍摄记录、项目集详情、Gear、Insights、Compare、Account 和 Preferences 的页头结构、主操作和移动文案。
2. 把共享页头的收缩/换行规则集中到全局样式或小型共享组件，删除页面中与统一规则冲突的 override；不为单页添加新的随机断点。
3. 清理 Gear 与拍摄记录工具栏的内联宽度，统一 Tabs、搜索、排序的 flex/grid 契约。
4. 为用户生成长名称补卡片和详情层级规则，不改变数据、路由、Dexie 或 SyncService。
5. 补中英文、不同页签和动态标题切换的组件/响应式回归。

**验收矩阵**

- 尺寸：`320 / 375 / 390 / 430 / 768 / 1024 / 1280px`，并额外检查浏览器 `200%` zoom。
- 内容：中文和英文最长内置文案、30-60 字符用户名称、零数据和最大计数。
- 状态：每个主 tab、无侧栏/折叠侧栏、明暗主题、reduced-motion。
- 结果：无页面级横向滚动；按钮不裁切、不逐词换行、不覆盖文字；说明可理解；Tabs、搜索和排序保持可操作；桌面布局与现有行为不回归。

<a id="ui-cover-focal-point"></a>
### UI-11 封面图非破坏焦点调整

**时机与边界**

- 排在 Cloud 图片完整性真实跨设备验证之后。只有 [`CLD-01`](./CLOUD_TODO.md#cld-01-photo-integrity) 的跨设备 signed URL、object/metadata 对照、失败重试和重复对象保护全部验收通过后才能开始；焦点位置是需要 Dexie、SyncService、Supabase migration/RLS 映射的可同步元数据，不能只在某个组件的 local state 中保存。
- 本项只覆盖拍摄记录封面和相机、镜头、胶卷库存、其他器材的封面。Compare、Lightbox、未来原图相册、批量导入与分享卡片不在范围内。
- 当前上传处理保持不变：图片等比缩小并转为 WebP；本项不重新编码、不生成固定比例副本、不永久裁切，也不承诺保留摄影扫描原图。若未来需要原图归档，应在 Storage/配额任务中独立设计主文件与派生图策略。
- `cover` 卡片仍可填满固定版式，完整预览继续用 `contain` 显示整张照片。缺失焦点元数据的历史资料以中心点 `50% 50%` 渲染，保证向后兼容。

**产品交互**

- 上传后不强迫摄影师裁切。只有封面已存在时，提供次级操作“调整封面位置 / Adjust framing”；保留“查看封面”和“更换封面”。
- 调整面板使用当前卡片的实际比例预览，而不是误导性的自由比例裁切框。用户拖动照片决定主体位置，保存的是 `x/y` 焦点百分比，不改变图片像素。
- 预览需即时反映卡片中的 `object-fit: cover` + `object-position` 结果；取消不改数据，保存后各卡片和详情抽屉一致更新。
- 交互不能只依赖拖动：焦点控制必须能聚焦，提供方向键微调、Home/End 回到边界、清晰的可访问百分比文本和“居中”重置动作；所有操作按钮至少 `44px`。
- 不新增每张图片的裁切历史、滤镜或编辑器。摄影师只调整封面在固定卡片中“看哪里”，不是编辑照片本身。

**数据与同步契约**

- 为封面所属实体增加兼容、可选的焦点字段，例如 `coverFocalX` / `coverFocalY`（拍摄记录）与 `avatarFocalX` / `avatarFocalY`（四类器材）；值限制为 `0-100`，默认/缺失时视为 `50`。
- 同轮完成 TypeScript model、Dexie version、Supabase migration、snake/camel mapper、RLS/GRANT 回归和同步队列验证。字段不建立索引，不影响库存 RPC 或照片 blob/storageKey 的恢复逻辑。
- 焦点位置归属“封面与实体的展示关系”，不是 `PhotoAsset` 的全局属性；同一图片日后如果用于不同实体，可拥有不同焦点。
- 需要保证试用资料迁移、Excel/备份兼容及旧记录 pull 不会因缺失字段失败；导出可在后续 schema 版本中追加列，不破坏旧模板导入。

**实现顺序**

1. 先完成 Cloud 图片完整性真实验证，并为焦点字段设计最小 migration/mapper/test matrix。
2. 抽一个共享的 `CoverFocalPointEditor`，供 Roll 封面和 `GearAvatarEditor` 使用；不要分别复制拖动与键盘逻辑。
3. 统一所有 `cover` 位置使用焦点 CSS variable；保留 `contain` 预览，不把焦点错误应用到完整照片查看。
4. 补中英文文案、键盘/触控、同步/迁移与历史无字段回归测试。

**验收**

- 上传横图、竖图、方图均保持原始宽高比例；保存焦点后卡片主体正确，查看完整封面时不裁切。
- 覆盖拍摄记录、相机、镜头、胶卷库存、其他器材、无封面、旧数据、取消/重置、同步 pull/push、试用迁移和账号切换。
- 覆盖 `320 / 375 / 430 / 768 / 1024px`、中英文、明暗主题、reduced-motion、键盘和触控；无横向溢出、无被遮挡的控制项。
- 单测覆盖范围约束、默认中心、键盘调整、取消/保存与 mapper；E2E 覆盖上传后调整、刷新恢复和跨设备/Cloud 条件 smoke。
