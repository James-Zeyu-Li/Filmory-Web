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

- 已完成：Settings 在存在待补上传图片或待清理旧对象时显示修复入口，并提供成功、部分成功和失败反馈；本地保留、重试、用户隔离、同用户 in-flight 去重与旧对象清理测试均通过。
- 已完成：拍摄记录封面在压缩、元数据构建或 Dexie 写入失败时进入统一双语错误反馈；组件测试覆盖压缩失败及上传后本地提交失败的 Storage 回滚。
- 未完成：真实 Cloud 双设备、object/metadata 对照和响应丢失重试尚未验收，因此 Cloud 最终验证仍不能打勾。

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

<a id="ui-settings-responsive-density"></a>
### UI-12 Settings 设置项密度与窄屏布局收口

**当前状态（2026-08-22，已完成）**

- 已完成：语言选择依据容器空间渐进响应，在 `>360px` 时保持标题与选择器同排，极窄容器才使用全宽下一行；货币、导出、图片修复和危险操作继续按控件需求换行。胶片模式 toggle 使用明确的 `40px` flex basis，不再被高优先级 `width: auto` 压缩并裁切；主题 segmented control 继续整组适配窄屏。
- 已完成：响应式由 `settings-group` 的实际可用宽度驱动，不再只依赖 viewport；纵向布局会显式解除 `.settings-item-content` 的 `200px` 横向 flex 基准，行高回归内容驱动。中窄容器中的复合操作保持完整宽度，极窄容器再切为单列。
- 已完成：语言与外观移除重复说明，`Pro film mode` 收口为“胶片工作流”，拍摄记录布局和货币提示改为更直接的双语摄影师文案；货币选择器保留双语可访问名称。
- 已验证：Settings focused component test `7 passed`；Settings responsive E2E 覆盖 `320 / 375 / 390 / 430 / 540 / 568 / 600 / 620 / 768 / 1024px`，按真实分组宽度断言布局方向，并确认展开侧栏后无横向溢出；lint 与 production build 通过。

**已解决的根因（2026-08-22 审计）**

- Settings Modal 当前使用 `max-width: 620px`、`width: 92%`，该外层宽度本身不是截图中大块留白的直接原因。
- 桌面横向设置行的 `.settings-item-content` 使用 `flex: 1 1 200px`。横向主轴下，`200px` 是合理的内容宽度基准；最初切换为纵向布局时，同一个 `flex-basis: 200px` 随主轴改变成为约 `200px` 的高度基准，因此说明文字与下方控件之间被撑出大块空白。
- 最初的断点把语言选择、主题 segmented control、胶片模式开关等不同类型的设置全部采用同一种纵向策略。现已按控件类型区分：语言/货币及复合操作在窄容器进入下一行，开关类设置继续保持“说明在左、控制在右”。
- `.settings-list-group` 已声明 container，但最初的响应式行为仍主要由 viewport `@media` 决定。Modal 内容宽度与浏览器宽度并不始终相同，现已由 `settings-group` container query 按实际可用宽度处理行布局。

**实施边界**

- 本项只调整 Settings/Preferences 的布局、间距、控件排列与相邻测试；不改变语言、主题、胶片模式、拍摄记录 tab、货币、导出、图片恢复或账号相关业务逻辑。
- 不通过增加固定 `height` / `min-height`、隐藏说明文字、缩小到低于可读字号，或再叠加单页随机断点解决问题。
- 不改变共享 `Modal` 的全局尺寸规则，除非复核证明问题也影响其他 Modal；Settings 专属问题优先在 Settings 的行级布局契约中解决。

**推荐实现方式**

1. 在设置行转为纵向主轴时显式重置内容区的 flex 高度语义，例如让 `.settings-item-content` 使用内容驱动的 `flex-basis: auto` / `flex: 0 1 auto`，防止桌面宽度基准变成手机高度基准。
2. 按控件类型定义响应式模式：语言、货币和较长复合操作在空间不足时移动到下一行并占满；主题选择保持整组可读；胶片模式及其他 compact toggle 优先保持同一行右对齐，只有在真实碰撞时才降级。
3. 使用现有 spacing token 统一行内 `padding`、内容与控件间 `gap`、section 间距；不能用大固定高度制造表面整齐。说明换成两行时，行高应由内容自然增长。
4. 如采用 container query，复用现有 `settings-group` 容器并建立一个明确阈值；删除与其竞争的重复 viewport override，避免相同宽度在全屏页面和 Modal 中得到不同结果。
5. 保持 header 固定、body 单一滚动容器和底部 safe-area 行为；不能形成 Modal 外层与 Settings body 的双层滚动。

**无障碍与视觉要求**

- select、segmented control、toggle 和 disclosure button 保持可见 focus；手机触控目标至少 `44px`。
- 说明文字不能因压缩而覆盖控件，也不能只靠 placeholder 解释设置含义。
- 明暗主题均使用现有 token；分组边界、分隔线和 focus 对比清晰，不新增渐变、玻璃拟态或装饰性阴影。
- 中英文切换后布局应自然增高而不是产生裁切；用户无需横向滚动才能操作任何设置。

**自动与手工验收**

- 组件测试覆盖语言、主题和胶片模式三种代表行，验证窄屏 class/结构下控件仍可操作且业务 handler 不变。
- 响应式 E2E 覆盖 `320 / 375 / 390 / 430 / 540 / 768 / 1024px`、中英文、明暗主题与 `200%` zoom；断言无横向溢出、无异常大空白、无双层滚动。
- 手工检查短窗口和 iPhone safe-area：header/关闭按钮始终可操作，滚动到底可访问所有设置，toggle 不被说明文字挤出可视区域。
- 关闭条件：focused tests、响应式 E2E、`npm run lint` 和 production build 全部通过；上述条件已满足，Roadmap 已标记完成。

<a id="ui-landing-brand-navigation"></a>
### UI-13 Landing 品牌 Logo 与导航响应式防重叠

**当前状态（2026-08-22，已完成）**

- 已完成：`<=768px` 隐藏与 Hero 重复的顶栏试用入口，`<=560px` 隐藏 wordmark，仅保留 compact mark；语言、登录和注册入口保持可用。
- 已完成：品牌容器增加可预测的 flex 收缩边界，Logo 外框改为 solid surface，移除新增渐变和强光晕；compact mark 作为装饰性图片处理，避免屏幕阅读器重复朗读品牌名称。
- 已验证：Landing E2E 覆盖 `320 / 375 / 390 / 430 / 480 / 540 / 640 / 768 / 1024 / 1280 / 1440px`，断言品牌区与操作区 bounding boxes 不相交、页面无横向溢出，并确认窄屏隐藏重复试用入口；lint 与 production build 通过。

**当前问题与根因（2026-08-22 审计）**

- Landing 顶栏是两个 flex item：左侧品牌由 compact mark + wordmark 组成，右侧同时放置语言切换、试用、登录和注册。右侧 `.landing-nav-actions` 使用 `flex-shrink: 0`，在空间不足时不会缩小；左侧品牌虽然允许收缩，但其图片内容没有与操作区建立明确的最小安全间距，因此右侧会绘制到品牌区域上方。
- 当前只有 `<=420px` 才隐藏 wordmark，而实际碰撞会在更宽的中窄屏提前发生，具体阈值还受中文/英文按钮长度、浏览器缩放和系统字体影响。`421-768px` 缺少 tablet/小窗口专用的渐进降级规则，是截图中 Logo 与语言按钮重叠的主要原因。
- 新品牌结构同时渲染 `compact-logo.webp` 和 `word-logo.webp`，资产本身可以保留；问题不在图片尺寸文件，而在导航的总宽度预算和收缩优先级。
- 新 Logo 外框使用 `linear-gradient`、inset glow 和额外 drop shadow，与项目“实色、克制、现代、禁止新增渐变装饰”的全局视觉基线不一致，也会在深色顶栏中过度突出。

**实施边界**

- 本项只处理 Landing 顶栏和 footer 的品牌展示、导航空间分配及响应式状态；不改变 Auth 路由、试用流程、语言状态、CTA 文案或登录注册行为。
- 不通过绝对定位、负 margin、提高 z-index 相互覆盖，或仅针对截图宽度添加单点 media query 修补。
- 不把完整导航改成新的汉堡菜单，除非现有操作经过产品确认需要重构；首轮优先使用渐进式压缩和隐藏低优先级重复入口。

**推荐实现方式**

1. 明确导航空间优先级：品牌 mark 与核心注册操作不可被裁切；wordmark、重复的顶栏试用入口和次级登录入口按产品优先级逐步降级。不要让任意 flex item 在未知空间下覆盖相邻区域。
2. 为品牌容器设置可预测的收缩边界和 `overflow` 行为，并为 actions 保留安全 gap。wordmark 应在“即将碰撞”之前隐藏，而不是等到 `420px` 后才处理。
3. 建立连续的桌面、tablet、中窄屏和手机状态。阈值应由真实中英文内容的总宽度验证得出；`421-768px` 至少需要一个明确状态，避免从完整桌面导航直接跳到极窄手机规则。
4. 将 Logo 外框改为 solid surface + 单层边框，使用主题/landing token 保证深色背景中的可见度；移除新增渐变和强光晕。wordmark 继续保持正确宽高比，不用 CSS 拉伸或永久裁切资产。
5. footer 可复用相同品牌资产与实色视觉语言，但尺寸独立；不要让 header 的收缩规则意外隐藏 footer wordmark。

**响应式与无障碍要求**

- 品牌链接应具有单一、准确的可访问名称；装饰性重复图片应避免让屏幕阅读器重复朗读“Grainfolio”。
- 语言切换、试用、登录和注册的可见状态变化不能改变对应路由或操作语义；保留的触控目标至少 `44px`。
- 中英文、系统字体放大和 `200%` zoom 下不得发生覆盖、裁切或页面横向滚动。
- 顶栏固定时必须保持明确背景和边界，页面滚动内容不能穿透影响 Logo/操作可读性；不新增渐变背景。

**自动与手工验收**

- 组件测试确认品牌资产、语言切换与可见 CTA 保持正确语义；响应式隐藏只影响视觉重复项，不移除必要的可访问入口。
- Playwright 覆盖 `320 / 375 / 390 / 430 / 480 / 540 / 640 / 768 / 1024 / 1280px`，中文和英文分别断言 Logo、语言和 CTA bounding boxes 不相交，页面无横向溢出。
- 补 `200%` zoom、长本地化文案、键盘 focus、reduced-motion 和深色 Landing 的视觉 smoke；确认 Logo 在固定顶栏和 footer 中均清晰。
- 关闭条件：focused tests、响应式 E2E、`npm run lint` 和 production build 全部通过；上述条件已满足，Roadmap 已标记完成。

<a id="ui-auth-theme-branding"></a>
### UI-14 公开认证页主题与品牌层级收口

**当前状态（2026-08-22，已完成）**

- 已完成：新增不持久化的 Auth 首次访问主题解析；没有已保存主题时 `/auth/*` 与旧 `/login` 使用深色，已有 Light/Dark/System 继续优先。
- 已完成：共享 `AuthShell` 只保留一个具有可访问名称的 wordmark，移除 compact mark、渐变灯箱、径向光晕和多层品牌阴影；登录、注册、忘记密码、重设密码和 callback 自动复用。
- 已验证：Auth/主题组件测试 `27 passed`；Auth E2E `7 passed`，覆盖首次深色、明确主题、单一 Logo、320-768px、键盘顺序和 44px 控件；lint 与 production build 通过。

**审计结论（2026-08-22）**

- Landing 使用固定深色视觉；`ThemeProvider` 在没有本地偏好时使用 `system`，因此浅色系统中的 `/auth/login`、`/auth/signup`、忘记密码和重设密码会显示浅色，形成明显硬切。`ensureTrialDefaultTheme()` 只在进入试用后设置深色，不能解决 Landing -> Auth 的入口连续性。
- Auth 页面并非通常“不需要 Logo”。独立认证路由需要最低限度的品牌确认和返回上下文；真正的问题是当前 `AuthShell` 同时展示 compact mark、wordmark、渐变灯箱、光晕和阴影，视觉重量高于表单标题，并违反项目禁止新增渐变装饰的基线。
- 已完成的 Auth 路由、安全 guard、OAuth 条件渲染和表单结构不需要重做；本项只处理公开入口的默认主题与品牌层级。

**推荐实现**

1. 用户已有明确主题偏好时始终尊重该偏好；只有没有明确偏好的首次公开访问才使用深色 Auth 外观，与 Landing 连续。登录和注册不得覆盖返回用户保存的主题，也不得把页面展示默认值错误写成用户偏好。
2. Auth 卡片保留一个克制品牌入口：优先使用单一 wordmark，或小尺寸 compact mark + 文本二选一；不要完全移除品牌，也不要同时展示两个等权 Logo。
3. 移除 Auth Logo 的渐变、径向光晕和多层发光阴影，改为主题 token 驱动的实色表面、单层边框和正确留白。品牌区不得挤压登录/注册标题。
4. Landing -> 登录、Landing -> 注册、登录 <-> 注册、退出登录 -> 登录保持 `150-200ms` 颜色过渡并支持 reduced-motion；禁止通过整页 opacity 动画延迟表单可用性。

**验收**

- 覆盖无主题偏好、明确浅色、明确深色、System 浅色和 System 深色；明确偏好永远优先，首次入口没有黑白硬切。
- 覆盖登录、注册、忘记密码、重设密码和 Auth callback；Logo 只有一个可访问品牌名称，返回首页和表单焦点顺序不变。
- 覆盖 `320 / 375 / 430 / 768 / 1024px`、中英文、200% zoom、明暗主题和 reduced-motion；无渐变装饰、无 Logo/标题重叠、无横向溢出。

<a id="ui-sidebar-density-alignment"></a>
### UI-15 桌面 Sidebar 密度与折叠控制对齐

**状态：已完成（2026-08-22）**

- 桌面展开宽度采用 `240px`；折叠栏继续使用 `72px`，`<=1024px` Drawer 显式固定为 `280px`，不再意外继承桌面宽度。
- 品牌与所有 `.nav-item` 使用统一水平节奏；Footer 控制保留共享透明边框，消除 Account、Preferences、Collapse 与主导航之间的 1px 轴线偏移。
- Collapse control 的可见文字、`aria-label` 和 title 均随展开状态切换，隐藏的旧文字不再表达错误动作。
- 自动化验证包含 `1025 / 1100 / 1249 / 1250 / 1440px` 桌面边界、390px 移动 Drawer、真实几何轴线、折叠语义与 44px 控件契约；Sidebar 单元测试 `2 passed`、E2E `3 passed`、lint 和 build 已通过。中英文、明暗主题、200% zoom 与 reduced-motion 仍属于发布前人工检查矩阵。

**审计结论（2026-08-22）**

- 展开 Sidebar 原固定 `260px`，属于常见的 `240-280px` 范围，并非功能错误；但 Grainfolio 导航标签较短、层级较少，260px 留白偏多，因此在不压缩文字的前提下收敛为 `240px`。
- 折叠态 `72px` 与移动 Drawer `280px` 分别承担图标轨和触控抽屉职责，不应跟随桌面展开宽度一起缩小。
- 导航和折叠按钮复用 `.nav-item`，ARIA/title 已按展开状态切换；剩余问题是品牌、导航、Footer 与 collapse control 的视觉轴线和文字起点没有形成一个显式契约，折叠动画期间还会同时改变宽度、padding、文字 max-width 和 Logo 状态。

**推荐实现**

1. 先以中英文最长导航文案、125%/200% zoom 测量最小安全宽度，再在 `232-240px` 中选择一个 token；不要仅凭截图设任意像素值。
2. 为展开栏定义统一 icon column 和 label start：品牌、主导航、Account、Preferences、Collapse sidebar 使用同一水平节奏。Logo 可有独立尺寸，但可见内容起点必须与导航层级一致。
3. Collapse control 保留动态 `aria-label` / title；展开态显示“收起侧边栏”，折叠态只显示向右图标和“展开侧边栏”tooltip，不让隐藏的旧文字参与宽度计算。
4. 保持 `1250px` 抢跑折叠、`1024px` 移动 Drawer、手动展开/收起和 resize 时禁用过渡的现有行为，不改导航路由或权限。

**验收**

- 覆盖 1025、1100、1249、1250、1440px，中英文、明暗主题、200% zoom；主内容宽度增加但导航不截断。
- 展开、折叠及移动 Drawer 中所有图标轴线稳定，Account/Preferences/Collapse 不跳位；键盘 focus、tooltip 和可访问名称与当前动作一致。
- Sidebar 动画不引起主内容水平抖动或断点闪现；reduced-motion 下立即稳定到最终状态。

<a id="ui-settings-disclosure-alignment"></a>
### UI-16 Settings 拍摄记录布局行视觉对齐

**状态：已完成（2026-08-22）**

- 标题与“当前顺序”已合并为一个信息列，并与 32px 图标整体居中；移除了独立 summary 行和固定 `62px` 缩进。
- 容器宽度不足时仅 disclosure button 进入下一行并占满可用宽度，图标与标题不会拆成纵向；按钮保留 `44px` 最小触控高度。
- 展开内容使用语义化 icon-size/gap 变量计算缩进，窄容器自动取消缩进；默认折叠、Collections 开关、排序与 localStorage 行为均未改变。
- Settings 组件测试 `7 passed`；`320 / 375 / 390 / 430 / 540 / 568 / 600 / 620 / 768 / 1024px` 响应式 E2E `10 passed`；lint 和 build 已通过。200% zoom、双主题视觉对比继续保留在发布前人工检查矩阵。

**审计结论（2026-08-22）**

- 普通设置行使用居中对齐；拍摄记录布局使用 `.settings-sub-card-header { align-items: flex-start; }`，内部 copy 也为顶部对齐，并把“当前顺序”作为 `padding-left: 62px` 的独立行。移除标题说明后，这种结构不再有足够内容支撑，图标和标题看起来明显上浮。
- 当前窄容器规则还会让 `.settings-sub-card-copy` 切成纵向，可能把图标与标题拆成上下排列；这与其余设置项的“图标 + 标题”结构不一致。
- 本项只调整视觉结构，不改变默认折叠、Collections 开关、tab 排序、锁定规则或 localStorage 偏好。

**推荐实现**

1. 折叠状态使用与普通设置行相同的中心轴：左侧图标 + 标题，中间/下方显示紧凑的当前顺序，右侧为至少 `44px` 的 disclosure button。
2. “当前顺序”保持次级信息，可放在标题下方并与标题文字起点对齐；不要依赖固定 `62px` magic number，也不要把图标推到顶部。
3. 中窄容器允许 summary 自然换行，操作按钮进入下一行时占满可用宽度；图标与标题始终保持同一行，不在 container query 中拆开。
4. 展开后的排序列表继续使用现有边框、主题 token 和上下移动按钮；折叠/展开过渡只表达状态，不动画高度到不可预测值。

**验收**

- 与语言、外观、胶片工作流和货币行逐项比较图标中心、标题基线、左右 padding 与 divider；明暗主题边界清晰一致。
- 覆盖折叠/展开、Collections 开关、胶片模式锁定、长中英文顺序、`320 / 375 / 430 / 568 / 620 / 768px` 和 200% zoom。
- 键盘可展开、`aria-expanded`/`aria-controls` 保持正确；排序操作和持久化测试不得回归。

<a id="ui-roll-cover-rendition"></a>
### UI-17 拍摄记录封面清晰度与竖图显示源收口

**状态：已完成（2026-08-22）**

- 拍摄记录列表不再把全部照片交给 thumbnail-only URL map；卡片通过 IntersectionObserver 在接近视口时登记封面，仅为已见封面与当前打开详情解析高质量源。
- 高质量源优先级为本地 1920px Blob、Cloud signed URL、thumbnail/旧 preview fallback；signed URL 或图片解码失败时保留本地缩略图，不产生空白封面。
- Grid/List 卡片已由 CSS background 改为 `loading="lazy" decoding="async"` 的语义 `<img>`，卡片保持 `object-fit: cover`；详情封面与完整预览复用高质量 URL，完整预览保持 `contain`。
- Blob URL 在 effect 取消、照片集合变化和卸载时统一 revoke；异步解析晚于卸载完成时也会立即清理，避免 URL 泄漏。
- URL 优先级、可见请求、失败 fallback、lazy 属性和清理均有组件/Hook 测试；2:3 竖图 E2E 覆盖 IndexedDB Blob、刷新、卡片与完整预览。完整测试 `271 passed / 5 skipped`，lint 和 build 已通过。12MP 实拍图在 1x/2x/3x DPR 的主观锐度仍属于发布前真机检查，不影响本项代码完成状态。

**审计结论（2026-08-22）**

- 上传主文件会等比压缩为最长边 `1920px`、WebP quality `0.8`，不会永久裁切，通常足以支持当前卡片和完整预览。
- Cloud 上传同时生成最长边 `400px`、quality `0.6` 的 Base64 thumbnail；`usePhotoUrlMap()` 默认优先返回该 thumbnail。横图尚可覆盖小卡片，但常见 2:3 竖图只有约 `267px` 宽，在 280px 以上卡片和 2x/3x DPR 屏幕会被放大，因此模糊主要来自错误的显示 rendition，而不是 1920px 主压缩。
- 卡片使用 `background-size: cover; background-position: center`。竖图主体还可能被大幅裁切；清晰度属于本项，主体位置由后续 [`UI-11`](#ui-cover-focal-point) 处理，不能混为一次永久裁切。

**推荐实现**

1. 保留 400px thumbnail 作为快速占位和离线 fallback，不通过继续增大 Base64 数据把数据库变成图片仓库。
2. 拍摄记录可见封面优先使用本地 1920px blob 或 Cloud signed preview；thumbnail 只在完整显示源尚未可用或请求失败时显示。长列表必须按可见封面请求并复用 URL，不能打开页面就为全部记录请求完整图。
3. 优先把卡片封面从 CSS background 收口为语义化 `<img loading="lazy" decoding="async">` 或等价的可观察加载组件，以支持 progressive source、错误 fallback 和后续 `object-position`；不得破坏卡片主打开按钮和封面更换按钮的独立语义。
4. 完整预览继续使用 `contain` 和高质量显示源；卡片保持 `cover`，随后由 UI-11 增加非破坏焦点位置。不得重新上传原图、永久裁切或引入全局照片库。

**验收**

- 使用至少 12MP 的横图、2:3 竖图、方图和高颗粒扫描图，对比 1x/2x/3x DPR；卡片在 280-600px 宽度不明显像素化，完整预览不使用 400px thumbnail。
- 覆盖本地 blob、Cloud signed URL、thumbnail-only 历史数据、离线、signed URL 失败、账号切换和 URL revoke；渐进加载不得闪白或造成 CLS。
- 组件/Hook 测试验证显示源优先级、失败 fallback、lazy 行为和 Blob URL 清理；E2E 覆盖竖图上传后卡片、刷新、离线 fallback 与完整预览。
