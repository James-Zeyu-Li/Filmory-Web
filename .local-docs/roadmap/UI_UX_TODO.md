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
- Archive-oriented feature 可在局部工作区使用 `archival label / museum catalog / negative sleeve / light table` 的档案视觉语言，但它必须服务于资料检查或回顾，不能扩散为全站主题或装饰性怀旧滤镜；照片原色、比例和用户内容始终优先。
- 动效保持 `150-200ms`，只用于状态连续性，并支持 `prefers-reduced-motion`。
- 空列表与空工作区使用共享 `EmptyState`；危险操作使用全局确认，不使用原生 `window.confirm`。
- 所有工作区首先让用户看懂：当前状态、一个明确的下一步、以及已经完成的事实。默认界面保持简单，深度信息按需展开；完成感应被表达为可选的档案进度或回顾，不应成为评判、连续签到或付费压力。
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

<a id="ui-gear-shoot-history"></a>
### UI-18 器材与胶卷拍摄履历

**状态：未实现；作为 Roadmap 当前第一项，在真实 Cloud 验收前完成。**

**用户问题与术语**

- 相机详情应直接回答“这台相机参与过哪些拍摄记录和项目”；胶卷详情应回答“这条胶卷库存实际用于哪些拍摄记录和项目”。
- `Shooting record / 拍摄记录` 对应 Roll；`Project / 项目` 在当前产品中对应 Collection。没有加入 Collection 的 Roll 显示为“未归入项目”，不能被隐藏或伪装成项目。
- 同名 FilmStock 默认仍是不同库存实体；界面可显示品牌/型号，但不得把两条同名库存的履历自动合并。

**相机详情体验**

- 相机卡片默认进入详情/履历，而不是依靠不可见整卡按钮直接打开编辑表单；“编辑相机”保持为带文字或明确可访问名称的次级操作。
- 详情顶部保留封面、名称、类型、画幅和当前系统/后背上下文；履历区显示总记录、进行中、已完成、项目数和最近使用时间。
- 项目列表每项至少展示项目名、该相机参与的记录数、最近拍摄日期和当前状态摘要；展开或点击后只显示该项目中命中此相机的记录，并提供进入完整项目的动作。
- 未归入项目记录独立成组，顺序与拍摄记录页保持一致；点击记录复用既有 Roll Drawer，不复制编辑表单。

**胶卷详情体验**

- 胶卷卡片的查看履历入口与库存 `+/-`、编辑、删除和封面操作视觉分离，最小触控区域 `44px`；事件不能冒泡导致误开详情或误改库存。
- 复用 Film Insights 的使用次数、进行中/已完成分组与 Drawer，并增加“涉及项目”区；不在 Gear 内再复制一套胶卷报告页面。
- 胶卷详情默认强调实际拍摄使用；剩余库存、ISO、画幅、彩色/黑白和价格作为辅助信息。零使用时显示清晰空状态及“新建拍摄记录”入口，不显示库存不足预警。

**交互与响应式**

- 项目和拍摄记录列表在桌面可使用紧凑两列或主从布局，移动端必须退化为单列；标题、用户自定义长名称和双语文案不得挤压状态或操作。
- 当前选择必须有可见 focus，所有整行可点击项同时支持键盘 Enter/Space；只靠 hover 或颜色不得成为唯一反馈。
- Loading、空状态、记录已删除/尚未同步到本机、非法 ID 必须有稳定占位，不产生布局跳动或空白 Drawer。
- 若本阶段写入 URL，必须复用 Roadmap P1.5 的 canonical query、当前用户校验和 History 规则；不得维护 URL 与 selected state 两份互相同步的真源。

**数据与验收边界**

- 相机历史以 `cameraIds` 为准，不因 `currentCameraId` 改变而丢失此前参与关系；胶卷只按精确 `filmStockId` 关联。
- 聚合只读取当前用户且未删除的 Camera、FilmStock、Roll、Collection；跨用户、软删除和不存在的关联都不能显示。
- 服务层测试覆盖多相机、多项目、未归项目、同名胶卷不合并及跨用户；组件测试覆盖入口、分组、空状态、键盘和事件冒泡。
- E2E 覆盖“相机 -> 项目 -> 拍摄记录”和“胶卷 -> Film Insights -> 项目/记录”两条主路径，并在 `320 / 375 / 768 / 1024 / 1280px` 检查中英文无横向溢出。
- 该任务不修改库存 RPC、Cloud sync、Storage、封面事务、120 后背或相机转移模型；相关回归测试必须继续通过。

<a id="ui-collection-workspace"></a>
### UI-20 项目集摘要卡片与详情工作台

**状态与实施时机**

- 未实现；必须在 Roadmap P1.5 阶段 2 的项目集 canonical URL、刷新恢复和浏览器 Back 完成后实施。导航参数是详情唯一真源，本任务不得继续扩展当前仅由 `activeCollectionId` 控制的临时状态。
- 当前列表已经展示日期、相机、胶卷和卷数，但 Grid 仍以大封面为主；当前详情只有标题、描述/单日日期、操作和普通 Roll 卡片，无法形成系列项目的整体认识。
- 目标是摄影项目摘要和浏览工作台，不是团队项目管理：不增加任务、负责人、进度条、看板、权限或协作概念。

**项目集列表卡片**

- Grid 与 List 使用同一个类型化 summary view model，保证信息语义一致；Grid 不能退化为只有大图的海报，List 也不能把所有字段压成一行。两种模式只改变缩略图位置、列数和信息换行方式。
- 封面采用紧凑单图或最多四张关联 Roll 封面的拼贴，作为项目识别而不是主要内容；无图时继续使用项目首字母/共享占位，不自动生成装饰图片。
- 主信息顺序：项目名称 -> 最多两行描述摘要 -> 日期范围 -> `总记录 / 进行中 / 已完成` -> 主要相机、胶卷、地点。缺失项直接隐藏，不能显示无意义的 `0 台 / 未知 / N/A` 堆叠。
- 主要器材/胶卷按参与 Roll 数量降序，稳定 tie-break 使用名称或首次出现顺序；卡片最多显示 2-3 项，其余显示 `+N`。地点使用用户原文精确去重，不做地址猜测或自动地理归并。
- 最近活动表达为“最近拍摄”，取明确的 Roll `endDate`、`startDate` 或 Collection fallback date；在没有可靠 `updatedAt` 合同时不得显示“最近更新”。
- 整卡打开项目详情；编辑、删除和其他次级按钮保持独立 44px 操作，不允许事件冒泡误开详情。整卡可点击语义同时支持 Enter/Space，并提供包含项目名与记录数的可访问名称。

**Project Workspace 信息结构**

- 第一屏使用紧凑项目头部：返回、项目名称、描述/拍摄意图、推导日期范围和“编辑项目”。封面/拼贴最多作为窄幅辅助视觉或侧栏，不使用占满视口的大 Hero 图，不把文字覆盖在复杂照片上。
- 摘要区最多保留五类真实信息：拍摄记录总数、进行中、已完成、使用相机数、胶卷数；地点数可在有地点时替换低价值项或进入下方上下文。数字必须标明范围为当前项目，不与全局 Dashboard KPI 混淆。
- “主要器材与胶卷”使用可换行 chips 或紧凑列表，包含相机、可选镜头和胶卷；视觉上区分类别且不能只靠颜色。点击器材/胶卷时，未来复用 UI-18 履历入口，不在 Workspace 复制新的编辑表单。
- 拍摄记录区优先分为“进行中”和“已完成”，组内按最近拍摄日期排序；记录仍复用现有 Roll 卡片/Drawer、封面按需加载、添加已有记录、创建新记录和移出项目能力。空项目继续使用共享 `EmptyState` 和两个现有入口。
- Collection 自身的编辑/删除保持原合同；删除 Collection 只解除 Roll 关联，不删除拍摄记录或照片。Workspace 不能因为视觉改版改变该 transaction。

**无 schema 第一阶段的数据合同**

- 只聚合当前用户且未删除的 Collection、Roll、Camera、Lens、FilmStock 和对应封面 PhotoAsset；URL 指向其他用户、已删除或不存在的 Collection 时按 P1.5 规则清理参数，不渲染残留摘要。
- 日期范围：开始取有效 `startDate` 最小值，结束优先取有效 `endDate` 最大值；active Roll 没有 `endDate` 时不能用当前时间伪造结束日期。没有 Roll 日期时回退单一 `collection.date`。
- 相机参与关系使用 Roll 的历史 `cameraIds`，并包含明确的 `currentCameraId`；不得因为更换当前机身丢失此前参与项目的相机。镜头使用 `lensIds`，胶卷只用精确 `filmStockId`，忽略 `digital-placeholder` 与未登记库存。
- 地点仅从非空 `roll.location` trim 后精确去重；描述直接使用 `collection.description`。第一阶段不引入 project status、tags、chapters、goals 或新的 collection cover metadata。
- 聚合放入纯 service/selector，一次遍历关联 Roll 构建 counts、date range、ranked entities、locations 和状态分组；返回只读、明确类型的 view model。不得在每张卡片 render 中为同一 Collection 反复扫描全部 Roll/Camera/FilmStock。

**响应式与视觉层级**

- Desktop Grid 使用内容优先的摘要卡，封面约占卡片上方或左侧较小区域；Desktop List 使用紧凑横向布局。Tablet 在元数据即将拥挤前降低可见 chips 数量；手机统一单列，缩略图与标题保持横排或使用紧凑顶部拼贴，操作区另起一行。
- Workspace 桌面可使用“摘要 + 主要器材”双栏后进入全宽记录列表；`<=768px` 退化为单列，摘要 KPI 使用 2 列网格。`320px` 下不横向滚动，不通过小于可读字号容纳所有 chips。
- 描述、地点和用户命名允许换行/两行截断，并提供完整详情；照片使用现有 lazy/async 与 URL 清理路径。项目列表只解析卡片真正需要的最多四张封面，不为全部 Roll 申请高质量 signed URL。
- 列表进入 Workspace 使用 P1.5 的空间连续动效；只对 opacity/transform 做 `150-200ms` 过渡，保持 PageTabs 和页面上下文可见，支持 reduced-motion。

**验收与回归**

- Service 单测覆盖空项目、单条/多条记录、active/archived、缺失日期、跨年范围、相机转移、多镜头、多胶卷、重复地点、数字占位、未登记库存、软删除、缺失关联和跨用户隔离。
- 组件测试覆盖 Grid/List 信息等价、封面拼贴 0/1/2/4 张、`+N`、描述截断、缺失字段隐藏、最近拍摄、卡片键盘打开、编辑/删除不冒泡、空 Workspace 和中英文长名称。
- URL/E2E 复用 P1.5：`/rolls?tab=collections&collectionId=<id>` 可直接打开、刷新恢复、Back 返回项目列表、详情中 PageTabs 仍可见；非法/跨用户 ID 不显示内容。再覆盖从 Workspace 打开指定 Roll Drawer 后 Back 返回同一项目。
- 回归确保添加已有 Roll、新建 Roll、移出项目、删除 Collection 后解除关联、Roll 封面按需加载、UI-18 器材/胶卷履历和未来 UI-19 Contact Sheet 入口不被破坏。
- 在 `320 / 375 / 390 / 430 / 768 / 1024 / 1280px`、中英文、明暗主题、200% zoom、键盘和 reduced-motion 下检查无横向溢出、信息不过载、封面不压过项目内容；focused tests 后运行相关全量 Vitest、lint 和 build。

<a id="ui-history-import-onboarding"></a>
### UI-23 Existing History Import 激活流程

**目标与入口**

- 状态：未实现。现有 Excel import 是可用 utility，本任务把它升级为新摄影师首次进入 Grainfolio 时的明确路径，不重写已经验证的 parser、行级验证或 Dexie transaction。
- Landing/首次空状态提供两个同级选择：`从现在开始 / I'm starting fresh` 与 `导入已有拍摄历史 / Bring my history`。已进入应用的用户仍可从 Settings/批量导入进入同一流程，不维护 onboarding 专用导入器。
- 激活完成后立即展示由导入结果确定性生成的摘要，并提供进入 Camera Passport 或拍摄记录列表的下一步；没有足够数据时只显示实际导入数量和缺失项，不制造“最常用”结论。
- 成功页是“Instant Archive”时刻，而不是冷冰冰的技术日志：以档案语言呈现可验证的事实，例如“已导入 47 条拍摄记录”“最早记录于 2019 年”“Nikon F3 出现于 12 条记录”。每个数字和名称都必须可追溯到本次提交后的当前用户数据；若相机/胶卷并列、缺日期或样本不足，回退为中性数量摘要。

**分步流程**

1. 下载官方模板或选择 `.xlsx/.xls`；首版不连接 Notion、Google Sheets、云盘、Exif 批量识别或 AI mapping。
2. 显示 Sheet/字段映射。精确表头可自动匹配；不确定字段必须要求用户选择或跳过，禁止把未知枚举静默转成默认类型。
3. Preview 同时展示有效行、警告行和拒绝行，包含 sheet、行号、字段及原因；用户可修正映射后重新验证，提交前不写 Dexie。
4. 重复处理必须由稳定 ID 或用户确认的精确字段组合决定，提供 `跳过 / 更新明确匹配项 / 作为新记录导入`；默认跳过疑似重复，不用名称模糊相似度自动覆盖。
5. 提交后展示创建/更新/跳过/失败数量和可进入的相机、胶卷、拍摄记录；fatal transaction 失败保持零写入。首版不承诺提交后“一键撤销”，除非后续建立 import batch 数据合同。

**交互和验收**

- 使用现有 Modal/Drawer、Button、反馈和 Progress 组件；只有“确认导入”是当前步骤的实心主按钮。长错误表在移动端纵向滚动，不让整页横向滚动。
- 文件解析、预览和提交都允许取消；离开前仅在已经选择文件或修改映射时提示。错误消息使用 `role="alert"`/`aria-live`，焦点移动到当前步骤标题或第一个无效映射。
- 导入写入仍由服务层在当前用户 Dexie transaction 中执行，完成后只调用既有 immediate sync；组件不得直接访问 Supabase，不得把其他用户 ID 写入 payload。
- 成功页只保留一个面向档案价值的主动作：有明确代表相机时进入其 Camera Passport，否则进入已导入的拍摄记录；保留“稍后查看”次级退出。不得在成功页弹 Upgrade、Cloud Sync 或付费限制。
- 单测覆盖正确映射、未知字段、非法枚举、负库存、无效日期、缺必填、部分有效、重复三种选择、跨用户拒绝和 fatal rollback。组件/E2E 覆盖模板 -> mapping -> preview -> import report -> Camera Passport 入口，以及中英文、键盘、移动端和大文件 loading。
- Instant Archive 测试额外覆盖数据丰富、样本不足、并列、缺日期、软删除和跨用户隔离；断言所有可见计数与名称来自实际 import result/selector，不拼接猜测文案。

<a id="ui-camera-passport"></a>
### UI-24 Camera Passport Hero Experience

**产品范围**

- 状态：未实现；依赖 UI-18 相机履历聚合和 P1.5 Gear canonical URL。Passport 是相机的默认只读档案视图，编辑相机是明确次级操作，不把统计塞回编辑表单。
- 第一阶段保持 private；本地图片导出晚于 UI-08，共享 URL 晚于 CLD-10。不得为了 Hero 页面放宽 RLS、公开 bucket 或自动上传更多照片。
- 页面回答“这台相机和我一起拍过什么”：拥有/首次记录时间、参与拍摄记录、进行中/完成、项目、常用胶卷、镜头、120 后背、地点、第一卷、最近一卷和可解释成本。

**统计合同**

- 参与关系沿用 UI-18：`cameraIds`/明确换机历史包含该相机；`currentCameraId` 只能表示当前机身。所有实体必须属于当前用户且未删除。
- “Together since” 优先使用相机明确 `addedAt`/购买日期；没有可靠日期时显示“最早记录于”，取最早有效拍摄日期，禁止用当前日期补齐。
- 常用胶卷/镜头/后背按参与 Roll 数量计数，稳定 tie-break；胶卷只按精确 `filmStockId`，不合并同名库存。地点使用非空原文精确去重。
- 成本只汇总能明确归属于该相机参与记录的金额，并标注口径；一卷有多台历史机身时不得把整卷费用重复计入每台相机。首版可隐藏相机成本，而不是猜测分摊。
- 当前无逐帧模型，禁止展示 Frames、按帧占比或 cost per frame。无数据项直接隐藏，并用空状态引导创建/导入历史。

**呈现与验收**

- 桌面使用紧凑档案头 + 2-4 个高价值摘要 + 历史列表，视觉参考档案卡、相机护照和 museum catalog，不做 SaaS KPI 墙。移动端摘要两列或单列，照片不压过相机身份和历史。
- 最近/首次 Roll、项目和常用组合均可进入现有 Roll/Collection/Film 履历；Back、刷新和非法 ID 遵守 P1.5，URL 是唯一详情真源。
- Service 测试覆盖无历史、多机身换机、多个项目、同名 FilmStock、缺失日期、120 后背、软删除和跨用户；组件/E2E 覆盖空态、完整 Passport、编辑返回、深链接、长名称、双语、键盘、主题与 `320-1280px`。

<a id="ui-roll-passport"></a>
### UI-25 Roll Passport / Roll History

**信息架构**

- 状态：未实现；复用已完成的 `/rolls?tab=all&openRoll=<id>`、Roll Drawer、封面链路和编辑 transaction。Passport 是只读回顾层，编辑状态不与其维护两份实体副本。
- 头部展示记录名、active/archived 和当前封面；核心事实按 `Capture / Gear & Film / Project & Place / Cost / Development / Notes` 分组，缺失分组折叠或隐藏。
- 相机部分区分当前机身与换机历史；镜头允许多支；120 后背显示明确 `filmBackId`。未登记库存要用中性标签，不伪造胶卷品牌或自动匹配后续新库存。
- 时间线第一阶段只显示 schema 中真实存在的开始/结束与换机事件；UI-22 完成后再加入送洗、冲洗、扫描和底片归档事件。
- Contact Sheet 未完成前，只展示封面/现有样片数量和后续入口；不得把 thumbnail 数量称作完整帧数。

**操作与验收**

- 一个主要上下文动作即可，例如 active 状态“继续记录”、archived 状态“查看底片索引”；编辑、完成、归档、删除为明确次级或危险操作，并继续使用 Confirm/Feedback。
- URL、刷新、浏览器 Back、X/Esc/遮罩、Dashboard 深链接和非法/其他用户 ID 完全复用 P1.5 合同。异步同步到达记录时可从 loading 转为 Passport，不伪造临时内容。
- 聚合/格式化放在纯 selector/service，不在 Drawer render 中反复扫描所有实体。测试覆盖无胶卷、数码、120 后背、换机、多镜头、项目、费用缺失、封面失败、软删除、跨用户和中英文移动端。

<a id="ui-quick-capture"></a>
### UI-26 Quick Capture — Start / Finish Roll

**最小完成路径**

- 状态：未实现；在 Roll Passport 之后实施。目标是在手机现场以最少步骤开始或完成一卷，不创建与完整 RollForm 不同的数据模型或保存服务。
- Start Roll 默认只展示相机、胶卷和主按钮。相机选择后继续应用现有 135/120、固定/可换后背和 active 装载冲突规则；只有物理上必须选择后背时才展开该字段。
- `More details` 才展示镜头、项目、地点、EI、费用和备注；字段值写回同一个类型化 form model，展开/折叠不清空用户输入。
- Finish Roll 默认展示当前组合、开始日期和完成动作；完成后询问是否现在补充冲扫/费用/扫描资料，但允许“稍后再说”，不阻止归档流程。
- 当前没有逐帧记录，本阶段不实现 Add Frame、36/36 计数、帧级参数或快门日志；相关入口只有 Contact Sheet/帧合同建立后才可增加。

**交互体验合同**

- 这不是把完整 RollForm 隐藏成“12-field form”。Start 是一个独立、移动优先的两段选择：`Camera` -> `Film` -> `Start roll`；默认视图一次只保留当前一步的选择、已选摘要和一个实心主动作。用户已拥有且有效的最近选择可以预填，但不得静默提交或遮蔽变更入口。
- 首次进入若没有相机或胶卷，空状态分别引导到现有快速添加流程；返回 Quick Capture 后恢复已选项。选择 120 可换后背系统时只追加必要的 Back 选择，不把所有高级资料推到首屏。
- 完成入口从 active Roll 的 Passport、Dashboard/Inbox 或记录卡片进入；默认先确认“完成此卷”，随后用一个非阻塞的“补充资料”步骤提供 Development、Cost、Scan/cover 与 Notes。没有帧模型时绝不显示或暗示 `36 / 36`；如果未来有可验证 frame model，帧进度必须是可选信息而非完成门槛。
- `More details` 使用明确的展开状态和摘要，已填写字段折叠后仍应让用户看见“已补充 3 项”或字段 chips；取消只丢弃本次未保存编辑，不能影响已开始的 Roll。开始与完成的主路径在已有有效选择时分别不超过三次和两次明确操作。

**保存与体验合同**

- 创建并扣库存必须继续调用现有 `create_roll_with_inventory` operation；未登记库存走现有明确路径。表单不得先写普通 Roll 再单独 `-1`，也不得直接调用 Supabase。
- 本地 transaction 成功后立即关闭/反馈并异步唤醒 sync；离线显示“已保存本机/待同步”，Cloud 拒绝继续进入现有“需要处理”流程，不阻塞本地界面。
- 相机、胶卷默认建议可以使用最近选择，但必须可见、可更改且按当前用户数据验证；不能在新设备上猜造不存在的默认实体。
- 验收记录实际点击/键盘步骤数，并覆盖 135、有固定后背 120、可换后背 120、无库存、库存为 0、Trial/Free guard、离线、RPC 失败、重复提交保护和快速双击。移动端键盘弹出后主动作不能被遮挡。
- UI/E2E 还要覆盖：初始空资料、从快速添加返回、预填但可更改、展开/收起不丢值、Finish 的“稍后再说”、取消未保存补充，以及中文/英文在 `320px` 宽度下保持主动作可见。不得以“表单字段更少”替代上述体验验收。

<a id="ui-photography-inbox"></a>
### UI-27 Photography Inbox

**派生规则与入口**

- 状态：未实现；它是 Dashboard 的下一步工作区，不是通知中心、任务管理器或库存预警。所有分组由当前用户、未删除的 Roll 确定性派生，不新增一张可漂移的 inbox 表。
- UI-22 前只允许显示 `拍摄中`、`已完成但尚未补充可确认资料` 和 `可归档` 等当前 schema 能证明的状态；`待冲洗/待扫描` 必须等待对应生命周期字段，不能从没有照片或 `archived` 反向猜测。
- “Needs attention”只列出阻止用户完成其明确目标的事项；地点、费用、评分、备注等可选字段默认不产生警告。每条允许忽略/稍后处理，且不影响保存或同步。
- 点击条目直接打开对应 Roll Passport/编辑区，返回后保留 Dashboard 上下文；不存在、跨用户或刚被删除的记录自动移除，不显示 stale action。

**呈现与验收**

- Dashboard 首屏先显示当前 loaded rolls 与装片组合，再显示最多 3-5 个下一步；不恢复商店式库存预警或最近完成列表。更多内容进入独立可筛选列表或展开区。
- 状态图标、文字和数量同时表达语义，不只靠颜色；移动端每条至少 44px，长卷名/项目名不挤压主要动作。
- Selector 测试覆盖 active、archived、缺失生命周期、可选字段缺失、软删除、跨用户和数据同步后重新分类；UI/E2E 覆盖直达 Roll、忽略动作、空状态、Realtime 更新和中英文响应式。

<a id="ui-archive-completeness"></a>
### UI-28 Archive Completeness

**产品语义**

- 状态：未实现；依赖 UI-22 生命周期和 UI-19 Contact Sheet MVP。首版是 per-roll/per-project checklist，不显示账号级百分比，不建立竞争、连续签到或强制任务。
- Roll 可检查：拍摄基础信息、完成状态、冲扫状态、费用、扫描/Contact Sheet、精选；每项只有底层数据能明确证明时才完成。Project 只汇总其 Roll，不复制一套可编辑状态。
- 可选信息不应永久阻止完成。用户可使用“按现有资料归档”，其语义是接受当前缺失，不伪造字段；如需持久保存“用户确认完成”，必须先设计最小 additive 字段，不能拿 `archived` 或 dismiss localStorage 兼任。
- 文案使用“还可补充”“接近归档”“按现有资料完成”，不使用羞辱、恐吓或全局低分表达。

**交互与验收**

- Checklist 出现在 Roll Passport 与 Project Workspace 的次级区域；每项进入对应编辑/Contact Sheet，不在卡片内嵌完整表单。
- 派生函数返回每项 `complete/optional/missing/reason/action`，组件不自行判断。测试覆盖不同 schema 阶段、无照片、未登记库存、数码记录、用户确认完成、数据删除后降级和跨用户隔离。
- UI 测试覆盖键盘、ARIA 状态、不可只靠颜色、忽略/完成确认、中英文和移动端；不得因为任务未完成阻止用户打开、导出或同步档案。

<a id="ui-film-guide-knowledge"></a>
### UI-29 Film Library + Shooting Guide + Personal Knowledge

**编辑指南与身份边界**

- 状态：未实现；在胶卷库存与 Film Insights 职责收口后实施。Guide 是轻量拍摄参考，不是 Wikipedia、曝光保证、医疗/安全建议或商店导购。
- 每个稳定胶卷预设最多四个编辑字段：`Character / Exposure Notes / Best For / Watch For`。表述必须使用“often / many photographers prefer / can”这类有条件语言，并提示显影液、时间、测光、扫描和个人偏好会改变结果。
- 编辑内容与用户资料严格分层，视觉上明确 `Grainfolio Guide` 与 `My Experience`；用户笔记不能覆盖系统指南，系统更新也不能覆盖用户笔记。
- 当前 Catalog 没有可靠持久 `catalogId`。首阶段可用现有类型化预设展示建议，但不能用标准化品牌/型号字符串在 Dexie/Supabase 建永久关系；稳定 identity 与 migration 必须先通过 CLD-11 gate。

**个人经验与推导规则**

- `My Experience` 候选信息为实际拍摄卷数、典型 EI、收藏/高评分卷、常用相机、显影方式、个人笔记和代表卷。只有当前 schema 明确存在的数据才显示；没有 `exposureIndex` 时不从 ISO 或备注文本猜 EI。
- “你似乎更喜欢 EI 200-250”只有在样本量、评分/精选标准和计算口径预先固定后才可出现，并必须能查看依据；首版优先让用户直接填写个人备注，不做 AI 推荐。
- 同名 FilmStock 是否跨库存批次汇总必须依赖稳定 catalog identity；在此之前，Film Insights 的使用历史仍按精确库存实体，Guide 搜索可以按预设建议但必须可撤销。

**入口、内容与验收**

- Film Insights/胶卷详情提供 `Guide` 与 `My experience` 局部区，不新增全局相册或购买入口。列表中只显示一行 Character/用途摘要，完整内容进入详情，避免长文挤压库存操作。
- 第一批内容优先覆盖常见 Kodak、Fujifilm、Ilford、CineStill、Foma、Kentmere 等已有 Catalog 项；每条内容需记录来源/审阅状态，禁止批量生成未经摄影语义检查的绝对结论。
- 测试覆盖无指南、只有指南、只有个人记录、同名不同库存、未知画幅、长双语内容、样本不足和来源更新不覆盖个人笔记；响应式保持库存 `+/-` 与详情入口清晰分离。

<a id="ui-year-in-film-prototype"></a>
### UI-30 Year in Film 视觉与信息原型

**状态与产物**

- 状态：未实现；这是进入 UI-21 production feature 前的低成本验证，不增加应用路由、Dexie/Supabase 字段、entitlement 或真实分享 endpoint。
- **Decision required（执行时机）：** 本原型只需 mock data 即可运行，对 Camera Passport 没有硬技术依赖；Roadmap 当前把它排在 Camera Passport 之后主要是为了复用已确定的档案视觉语言，不是数据或路由依赖。若产品判断 PMF 信号比视觉一致性更紧急，可由用户决定提前到与 P1.5/Camera Passport 并行甚至更早启动，先在自己的历史数据与少量胶片社区种子用户范围内验证“这个故事会不会被主动截图/分享”，直接服务 Roadmap 的 Closed Beta / PMF 验证 Gate。Agent 不得自行改变 Next Up 顺序，需先由用户在 `ROADMAP_TODO.md` 中确认后再执行。
- **当前代码定位（2026-08-29 核对）：** 仓库内不存在任何 `year-in-film`/`YearInFilm` 相关文件或路由；`frontend/src/App.tsx` 第 183-190 行是当前真实业务路由表，本阶段明确禁止在此新增路由。实现者需要选择独立的非生产预览面（例如临时 dev-only 路由/组件，或完全在应用之外的静态设计文件），不得把原型直接注册进 `App.tsx` 的真实路由表；一旦决定进入 UI-21 production implementation，再按当时的 Gear/Rolls 视图惯例新建 `frontend/src/views/YearInFilm/YearInFilmView.tsx`。
- 产物至少包含：9:16 主 story sequence、1:1/4:5 裁切示例、每页 metric 定义、摄影档案视觉 token、字体/Logo 安全区、轻量 motion storyboard，以及数据充足/稀疏/空状态三套 mock。
- 原型信息顺序优先测试：年度开场 -> 主要相机 -> 常用胶卷/组合 -> 项目/地点 -> 可归属花费 -> 与过去自己的比较 -> 总结/Grainfolio 品牌。每页只回答一个问题，不做 Dashboard screenshot。
- 个人历史比较是核心数据产品要求：以同一用户过去的可比周期为唯一比较对象。原型至少展示“完成卷数”和一种可可靠计算的构成变化（例如胶卷种类或主要相机），并同时展示有上一完整年、当前年度同期、无可比历史三种文案与版式；不出现任何公开排名或他人基准。

**数据可行性 Gate**

- 为每个展示项标记 `available now / needs UI-19 frames / needs UI-22 lifecycle / decision required`；原型可以用明确标记的 mock 展示未来方向，但 production backlog 不得把 mock 数字当现有能力。
- 当前允许的真实指标限于完成拍摄记录、实际关联相机/镜头/胶卷/画幅/项目/地点、明确日期和可归属费用。Frames、按帧占比、cost per frame 和千帧 milestone 必须标为 blocked。
- 所有 surprise/identity 文案需要固定 evidence 和样本不足 fallback；不生成摄影人格、公开排名或没有依据的“最喜欢”。

**验证与交接**

- 至少用 3 套脱敏/合成数据做设计走查：长期重度用户、只记录几卷的新用户、资料大量缺失的历史导入用户；同时检查中文和英文文案长度。
- 在 `375x812 / 390x844 / 1080x1920` 以及 1:1/4:5 裁切中检查内容安全区、文字可读性和品牌一致性；motion 支持 reduced-motion，并且静态截图仍完整表达故事。
- 用户验证重点记录是否愿意保存/分享、最有惊喜的页面、看不懂的指标和隐私担忧。只有 story 与 metric set 获得明确确认后，才按 UI-21/08 拆 production 实现，不直接把 prototype code 复制进产品。

<a id="ui-pro-conversion-moments"></a>
### UI-31 MON-01 Pro Conversion Moments

**实施时机与总则**

- 状态：未实现；P3，依赖 Roadmap 的 Free / Pro 产品合同与 `CLD-07` 的类型化 entitlement。它是功能内的 value explanation，不是新的会员首页、全局弹窗广告或社交增长机制。
- 注册、空档案、首次创建相机/胶卷/拍摄记录和普通本地编辑绝不触发 Upgrade。用户关闭当前解释后，同一 surface 在本次 session 内不自动重复；再次主动点击同一受限功能时才可重新打开。
- 每个入口必须先说明“正在请求什么能力、它解决什么实际问题、Free 当前仍能做什么”，再给出一个明确的 `Upgrade` CTA 和一个同等可见的关闭/继续本地使用入口。禁止使用“VIP”、倒计时、恐惧丢档、虚假限额或不可解释的通用锁。

**固定入口与 Free / Pro 展示合同**

- Cloud Sync / Backup：仅在已有非删除本地档案且用户主动打开第二设备、开启同步或点击备份时出现。Free 继续可离线记录；Pro 文案说明跨设备恢复与备份价值，不能把登录本身做成付费墙。
- Cloud Storage：只在用户主动要求将封面/扫描同步到 Cloud、或明确达到已确认配额时出现。先显示已用额度和当前动作后果；未确认的数字不得硬编码。失败、离线或上传错误必须与付费锁区分。
- Year in Film：Free 可打开真实的年度基础故事和基础分享产出。Pro 只锁定明确列出的扩展，例如更多历史比较、premium templates 或 HD export；锁定内容允许真实预览或清晰 preview card，但不得上传额外私密数据来生成预览，也不得把核心年度回顾整体模糊化。
- Public Project：用户在完成项目后主动选择“创建公开链接”才出现。仍可使用本地项目摘要卡/下载导出；Pro prompt 必须说明公开链接与本地导出的隐私、可撤销与成本差异。
- Archive Protection：只在用户已经积累可识别档案并主动进入备份/同步相关设置时出现；使用“保护这份档案的另一份副本”这类中性说明，不暗示本地资料会立刻消失。

**组件、状态与验收**

- 新建或扩展单一类型化 `UpgradePrompt` 输入：`feature`、`source`、`entitlementState`、可选 `limit`、`preview` 和关闭回调。业务组件不得直接按 `tier === 'vip'` 拼 Modal，也不得在多处复制文案或配额常量；可信拒绝仍由 Cloud 服务端执行。
- `preview`、`available`、`locked`、`loading entitlement` 与 `payment unavailable` 必须有不同的视觉和可访问状态；按钮 loading、失败反馈、Esc/close、焦点返回、键盘操作及中英文都纳入统一 Modal/Drawer 基线。
- 组件测试覆盖五个入口、Free/Pro/未知 entitlement、关闭后 session 内不重复、失败不是 paywall、未确认额度不显示数字和 CTA 传递正确 feature/source。E2E 覆盖一个 Free 用户查看基础 Year in Film、请求锁定扩展并返回，以及 Cloud Sync/Public Project 入口不阻断本地核心流程。

<a id="ui-insights-range"></a>
### UI-06 Insights 趋势时间范围

**实现要求**

- 摄影支出和完成拍摄趋势共用一个时间窗口：`12 个月 / 6 个月 / 3 个月 / 1 个月 / 近 7 天`。
- 默认 `12 个月`；使用清晰 segmented control，不使用下拉框。
- 近 7 天按天聚合，其余按月聚合；两个图表不能要求用户分别切换。

**验收**

- 范围切换后 X 轴、聚合粒度、标题和空态一致更新。
- 中英文和移动端不出现标签拥挤、横向滚动或控制器断裂。

<a id="ui-roll-contact-sheet"></a>
### UI-19 拍摄记录底片索引页（Contact Sheet）

**状态与定位**

- 未实现；属于 P2 拍摄成果展示，排在胶卷库存/洞察职责收口之后、分享卡片之前。当前 P1 Cloud 图片完整性仍按原顺序验收，本任务不得借机改写现有上传和同步服务。
- 它是 Roll/Shooting record 的内部视图，不是照片管理产品：不恢复 Sidebar 的 Photos/Albums，不提供全局相册、图库搜索或自动整理，也不对用户照片做负片转换。
- 用户上传的是已经处理好的成品扫描照片；界面只模拟胶片条、透明底片袋、灯箱、帧号和上下边印。任何视觉装饰都必须与原图分层，不能永久修改、反转、调色或裁切源文件。
- Contact Sheet 是局部暗房检查台：用户进入此局部视图时使用深炭/近黑的 stage，照片下方可有低亮度、暖中性、静态的灯箱透光层；透明袋、边印、齿孔与档案标签位于图片外层。该工作区不改变应用主题，也不让单张预览失去现有的关闭、focus 与返回语义。

**信息结构与入口**

- 在拍摄记录 Drawer 内增加明确的 `Details / 详情` 与 `Contact sheet / 底片索引` 局部视图；入口保持当前 Roll 上下文，不跳到独立全局照片页。
- 空状态说明“上传这一卷的成品扫描图，按胶片顺序查看”，提供一个主要动作“添加扫描图”；不得暗示 Grainfolio 会自动冲扫、反转或修复照片。
- 有照片时，顶栏只保留当前卷名、关联胶卷、画幅、照片数和一个主要添加动作；边印选择、显示风格、排序等次级设置使用渐进披露，不在首屏堆叠所有控件。
- 每张照片继续是独立 frame：支持点击打开高质量预览、选择为封面和后续替换；Contact Sheet 只由缩略图排版，不保存重复的合成大图。分享卡片如未来需要整页导出，应消费此视图数据，而不是反向控制本模块。

**135 / 120 视觉语义**

- 135 使用横向胶片条、上下齿孔、边印和帧号；桌面默认每条约 6 帧，具体列数根据可用宽度自适应，不能用固定像素把长图压扁。齿孔和标记是装饰层，不能改变图片可点击区域或替代真实 frame 顺序。
- 120 不显示 135 齿孔，使用更宽的底片边缘、帧号/方向标记与透明袋分格；布局根据用户照片比例和可用宽度选择每行 2-4 帧，不根据相机型号猜造拍摄张数。6x4.5、6x6、6x7、6x8 等信息只有当前数据明确提供时才用于建议。
- 未登记胶卷、数码占位或未知画幅使用 Generic sheet：保留照片顺序和简洁边框，不伪造某品牌、某型号或不存在的齿孔结构。
- 明暗主题都保持照片本身中性；周围表面可以模拟深色灯箱或透明底片袋，但禁止给图片加统一滤镜。装饰层对比不得盖过照片，文字和 focus 仍满足全局可访问性基线。
- 灯箱透光是功能性层级，不是通用 glow：使用单一低不透明度实色光源/模糊层从底部或背后托起底片袋即可，不使用渐变背景、霓虹色、循环呼吸效果或会污染图片边缘的 blend/filter。`prefers-reduced-motion` 下保持同一静态画面。

**边印预设与搜索**

- 单独定义类型化 `FilmEdgePreset` 展示 catalog；不得向库存 `FilmStock` 实体塞入字体、颜色、齿孔或边印装饰字段。预设可引用现有 `COMMON_FILM_STOCKS` 的品牌、型号、ISO、画幅作为搜索来源，但两者职责保持分离。
- 匹配顺序：用户为当前 Roll 明确选择的 preset -> 精确 film preset identity -> 品牌级 fallback -> Generic 135/120。现阶段缺少稳定 `catalogId` 时，品牌/型号标准化只用于提出可撤销建议，不能建立不可见的永久绑定。
- 搜索同时覆盖品牌、型号、常见别名和 ISO；选择胶卷后应自动收起结果并显示当前边印摘要，保留“更改”和“自定义边印”。不在当前目录时允许继续使用 Generic 或输入自定义文字，不能阻止保存。
- 第一批品牌级 fallback：Kodak、Fujifilm、Ilford、CineStill、Lomography、ORWO、Foma、Rollei、Shanghai、Lucky。第一批型号覆盖沿用 Roadmap 列出的常用 135/120 胶卷；先用排版、文字、色彩 token 和帧标记建立相似语义，不直接捆绑未经确认的商标 Logo 图片。
- 边印内容允许包含品牌、型号、ISO 和克制的 frame marker；不要生成或声称还原真实 DX 条码、乳剂批次、年代、工厂代码。相同型号在不同年代的边印可能不同，特殊版本由用户自行创建、命名和选择。
- 用户自定义至少包含显示名称、上边文字、下边文字和适用画幅；颜色、字体、齿孔尺寸等高级项只在确有需求后增加。自定义值是用户内容，不自动翻译；固定控件和帮助文案必须双语。

**多图导入与状态反馈**

- 一次选择多张图片后，先按文件名做可预览的建议排序，再由用户确认或拖动；禁止把文件名顺序直接当作不可更改的最终 frame number。
- 本地压缩、缩略图、Dexie transaction、deferred Cloud upload 和修复入口必须复用现有图片服务。UI 依次表达“本机已保存 / 正在上传 / 已同步 / 需要处理”，不能因某一张上传失败让整卷照片消失。
- 单张失败可重试或移除；重复选择同一文件不能仅靠文件名静默去重，至少结合 size/lastModified 或已有 checksum 策略并让用户确认。删除、替换和批量移除走现有确认与 Storage 清理边界。
- frame 顺序优先复用 `PhotoAsset.orderIndex`；`coverPhotoId` 继续只表达封面。确需单独保存 frame number 或 Roll 级 preset override 时，先写最小 schema/migration 设计并保持 Dexie/Supabase parity，禁止复用 `note`、`tags` 等近义字段偷存结构化状态。

**响应式、性能与动效**

- 桌面展示完整多行底片袋；tablet 减少每行帧数；手机保持 2-3 列或可读的分段胶片条，不允许整页依赖横向滚动查看。用户放大单帧时使用现有预览/Drawer 层级，不在底片格内塞微型编辑控件。
- Contact Sheet 只请求可见或即将进入视口的缩略图；打开单帧才解析高质量本地 Blob/signed URL。不得为一卷的所有照片预签完整 URL，也不得把原图 Base64 写进数据库。
- 一卷通常为有限帧数，首版不引入虚拟列表；只有实测长卷/多页导致明显主线程或内存压力时才评估。图片容器预留比例，使用 `loading="lazy"`、`decoding="async"` 和现有 URL 清理契约，避免 CLS 与 Blob URL 泄漏。
- 排序、展开设置和切换局部视图使用 `150-200ms` 状态连续动效；齿孔不做无意义循环动画，`prefers-reduced-motion` 下立即稳定。
- 深色检查台必须为元数据、close/back、添加扫描图、键盘 focus 和错误反馈提供可读对比；在手机上缩小灯箱光源范围，不能使底部操作或图片顺序难以辨认。切入/退出检查台仅做 `150-200ms` 的 opacity/surface 过渡，reduced-motion 直接切换。

**分阶段验收**

1. 预设/只读阶段：单测覆盖精确 preset、品牌 fallback、Generic、135/120、未登记库存、同名 FilmStock 不合并和自定义选择优先；组件测试覆盖空态、关联胶卷变化、搜索与键盘选择。
2. 导入/排序阶段：覆盖多选、建议排序、拖动、frame 顺序持久化、选择封面、单张失败/重试、离线本地保留和重复选择；不能回归现有封面替换与 Cloud recovery。
3. 自定义阶段：覆盖每 Roll 覆盖值、恢复默认、特殊字符、超长文字、跨语言与跨设备 schema parity；边印溢出必须截断或分段，不能盖住照片。
4. Cloud 阶段：同账号双设备看到相同照片顺序、封面和 preset；重复补上传不产生第二个 object/metadata，删除与账号清理不留孤立对象。若采用 R2，另验签名、私有读取、跨用户拒绝、配额、失败清理和 Supabase metadata -> object key 一致性。
5. 暗房检查台视觉阶段：桌面、手机、浅色/深色应用主题与 reduced-motion 下确认局部 stage 不泄漏为全站主题；验证照片未被 CSS filter/blend 改色、灯箱层不遮挡点击/焦点、文本和控制对比可读，并对数据丰富与空卷状态分别做视觉 smoke。
- 每阶段覆盖 `320 / 375 / 390 / 430 / 768 / 1024 / 1280px`、中英文、明暗主题、键盘、200% zoom 与 reduced-motion。完成 focused tests 后运行相关全量 Vitest、lint 和 build；关键上传/排序/跨设备路径补 Playwright 与真实 Cloud smoke。

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

**状态与产品边界**

- 未实现；排在 Project Workspace 与 Contact Sheet 基础阶段之后。第一阶段是本地成果导出，不依赖公开账号页、社交 Feed、点赞、评论或 Cloud public policy。
- 产品循环：完成拍摄记录 -> 选择代表照片或纯器材信息 -> 生成卡片/Contact Sheet -> 使用系统分享或下载到外部平台。Grainfolio 不替用户发布，也不自动公开内容。

**目标与内容**

- 生成可下载的复古胶片/拍立得风格卡片，用于小红书、Instagram 和朋友圈。
- 支持从当前拍摄记录选择一张代表照片、临时上传一张只用于本次生成的本地图片，也允许只生成器材/胶卷信息卡；临时图片不得自动写入 `PhotoAsset` 或上传 Cloud。
- 可选字段包括相机、镜头、胶卷品牌/型号、ISO、光圈、快门、焦段、日期、地点、评分和短备注；缺失字段自动隐藏。
- 地点、备注和精确日期默认不公开，必须由用户在导出前明确勾选；预览需始终反映最终会导出的字段。
- 差异化定位：同类应用普遍不做分享或明确宣称 `no social, no feed`，本功能的竞争力来自“可信的真实数据”而非模板美观度——所有卡片字段必须可回溯到当前用户真实记录（例如实际完成卷数、与某台相机共同使用的年限），不得为了传播效果放宽 Roadmap 顶层原则中禁止伪造帧数/估算值的限制；这条纪律本身就是差异化，不是需要绕过的约束。
- Contact Sheet 阶段完成后，可增加“整卷索引页导出”，但只消费 UI-19 的 frame 数据/版式，不复制照片、不保存第二份合成大图。
- 第二阶段在 Camera Passport、Project Workspace 与 Cost 口径稳定后，复用同一 renderer 增加 Camera Passport Card、Project Summary Card 和 Cost Summary Card；不得为每种卡片复制一套 Canvas/字段解析实现。
- Project 卡只使用用户明确选择的项目描述、代表图和器材/胶卷摘要；Cost 卡默认不带姓名、精确地点或交易明细，只展示用户主动选择的范围与汇总。公开 URL 仍属于 CLD-10，不因增加图片导出而自动发布。

**交互**

- 优先从拍摄记录详情或器材库进入。
- 提供 2-3 个视觉明确但信息结构一致的模板：克制拍立得、暗房工作单、胶片边框。模板必须共享字段映射，不允许每个模板单独猜字段或复制业务聚合。
- 提供 `1:1 / 4:5 / 9:16` 画幅、实时预览、PNG/WebP 导出；支持时调用 Web Share API，不支持时明确回退到下载。第一阶段不实现任意自由排版编辑器。
- 用户可调整照片焦点、背景色和字段显隐；不得修改源照片、覆盖 Roll 封面或把装饰配置写回器材/胶卷实体。
- 手机预览不能要求横向滚动，导出尺寸和屏幕预览比例应保持一致。
- 生成期间显示进度与取消；失败保留用户选择，不能清空表单。重复导出相同内容不创建 Cloud object。

**架构与性能**

- 第一阶段使用受保护路由 `/share-card?source=roll|camera|filmStock&id=<uuid>`；第二阶段才可在对应聚合 service 完成后加入 `collection|costSummary`。`source` 只接受当期明确启用的枚举，`id`/时间范围必须从当前用户的 Dexie 数据解析。非法、已删除或跨用户输入显示安全空态，不根据 URL 猜造对象。
- 新建纯 `shareCardModel.ts`：输入明确的 Roll/Camera/Lens/FilmStock/PhotoAsset DTO，输出模板无关字段；`ShareCardView.tsx` 负责选择和预览，`shareCardRenderer.ts` 使用 Canvas 2D 负责稳定导出。首版不同时引入 DOM screenshot 库；只有 Canvas 无法满足已确认排版时再记录替代决策。沿用仓库现有目录约定：`frontend/src/views/ShareCard/ShareCardView.tsx`（参照 `frontend/src/views/Compare/`、`frontend/src/views/Landing/` 的 `<Feature>/<Feature>View.tsx` 结构）与 `frontend/src/services/shareCardModel.ts`、`frontend/src/services/shareCardRenderer.ts`（参照 `frontend/src/services/filmInsightsService.ts` 等既有纯 service 文件），不新建独立顶层目录。当前仓库未创建任何 share-card 相关文件或路由（已核对 `frontend/src/App.tsx` 路由表），受保护路由需在该文件的 `Route path="/gear"` 等既有条目旁一并添加。
- 图片解码和高分辨率绘制仅在用户打开生成器或点击导出后发生；大图不得随列表预加载。若实测主线程卡顿，再按 Roadmap 的 Worker/Canvas 条件任务迁移生成，不提前引入 Worker。
- 字体、Logo 和模板资源必须随应用稳定加载；导出前等待字体 ready，并对跨域图片使用可验证的 Blob/signed URL，避免 tainted canvas。
- 免费/Pro 差异只通过 entitlement 控制模板数量、最大导出分辨率或品牌标记；不得降低免费用户源照片质量或锁住其本地数据。

**验收**

- 数据映射单测覆盖缺失关联、多镜头、未登记胶卷、长文本、地点默认关闭、临时图片不持久化和中英文。
- renderer 测试覆盖三个比例、字体加载失败、图片读取失败、取消、重复导出和不产生 Cloud 写入。
- Playwright smoke 覆盖从 Roll/器材入口打开、选择模板/比例/字段、生成预览、系统分享能力检测、下载以及 `320-1280px` 无横向溢出。

<a id="ui-year-in-film-passport"></a>
### UI-21 Year in Film 与胶片护照

**目标**

- 把用户一年内真实完成的胶片拍摄整理成具有纪念感的年度回顾，而不是增加另一套通用统计 Dashboard。
- 胶片护照记录“实际使用过什么”：胶卷型号、品牌、画幅和颜色类型由关联且未删除的拍摄记录推导；库存拥有量、数字占位和未登记胶卷不生成型号印章。

**第一阶段数据与页面**

- 使用受保护路由 `/year-in-film?year=<YYYY>`；缺少或非法年份回退到当前本地年份并 canonicalize URL。聚合逻辑放在一次遍历的纯 service，页面不直接在 render 中重复查询和排序。
- 年度范围使用用户本地时区，按 Roll 的实际拍摄/完成日期纳入；日期缺失的记录单列“日期未记录”，禁止用 `addedAt` 猜成拍摄日期。
- 展示完成卷数、主要相机、最常用胶卷、135/120 分布、代表项目、去过的地点数量和可选代表照片；复用现有聚合 service 或新增一次遍历的纯函数，不在卡片中重复 filter/sort。
- 胶片护照使用稳定 catalog identity；现阶段 FilmStock 没有 `catalogId` 时只按精确关联记录展示用户自己的库存实体，不用模糊品牌/型号字符串把不同条目永久合并。
- 第一阶段不新增 achievement table。确定性 milestone（第一卷 120、第一卷反转片、完成 10/50/100 卷、完成第一个项目）实时推导；只有“已看过/不再提示”需要持久化时才设计最小用户偏好字段。

**年度故事与个人比较**

- 先定义 9:16 story sequence，再实现页面：开场年度总览 -> 主要相机 -> 常用胶卷/组合 -> 项目/地点 -> 花费 -> 与上一可比年度的变化 -> 总结。没有数据的章节直接跳过，不用装饰性数字填空。
- 比较对象只能是用户过去的自己。上一年度必须使用相同完整日期范围与同一聚合口径；当前年度尚未结束时，要么与上一年同期比较并明确标注，要么不显示增减，禁止拿全年与部分年度比较。
- 可表达完成卷数、使用胶卷种类、拍摄活跃日期、项目和可归属花费的变化；当前没有逐帧模型，因此不显示总 Frames、帧增长、按帧相机占比、cost per frame 或 1,000 frames milestone。
- “最活跃的一年”“主要相机发生变化”等结论必须由固定阈值和 service 返回的 evidence 生成；样本不足、并列或缺日期时使用中性事实，不生成摄影人格或偏好推测。
- 未来可评估匿名聚合洞察，但不属于当前范围；不得出现 Global ranking、Top photographers、Roll/Spending leaderboard。

**体验原则**

- 不使用 streak、排行榜、稀有度抽卡、倒计时或羞辱式空状态；成就是档案纪念，可关闭且不阻碍核心流程。
- 年度回顾默认私密，分享必须显式进入 UI-08 导出流程；地点、备注、花费和精确日期默认排除。
- Free 保留真实的年度基础故事与基础分享；历史比较扩展、premium templates 和 HD export 的锁定/预览只可按 [`UI-31`](#ui-pro-conversion-moments) 实施。不得把整个 Year in Film 模糊化或将基础回顾变成注册后立即出现的付费墙。
- 无足够数据时提供轻量时间线和“继续记录下一卷”，不伪造百分比、人格标签或摄影风格结论。

**验收**

- 聚合测试覆盖跨年边界、时区、active/archived、缺失日期、同型号多库存、软删除、数码占位和跨用户隔离。
- 比较测试覆盖完整年度、当前年度同比、无上一年、口径变化、并列、样本不足和当前无逐帧数据；所有结论必须能回溯到明确计数。
- UI 测试覆盖年度切换、空态、milestone 可关闭、护照去重、隐私字段默认值、分享入口及中英文长文案。
- 手工验证桌面/移动、浅色/深色和 reduced-motion；动画只能用于页面揭示/印章出现，不阻塞阅读与操作。

<a id="ui-development-timeline"></a>
### UI-22 冲扫状态时间线

**第一阶段数据合同**

- 当前 `Roll.status` 表示拍摄中的 `active` 与已完成/归档，不足以表达送洗和扫描流程。不得直接新增更多近义 status 值破坏库存 RPC、Dashboard 和现有筛选。
- 首期在 `Roll` 增加独立 `developmentStatus?: 'not_sent' | 'sent' | 'processing' | 'scans_received' | 'negatives_archived'`，并增加可选毫秒时间戳 `sentToLabAt`、`processingStartedAt`、`scansReceivedAt`、`negativesArchivedAt`、`expectedReadyAt`。历史 Roll 缺失字段等同 `not_sent`，migration 不批量猜造时间。
- 同一实现必须包含下一版 Dexie schema、Supabase additive migration、snake/camel sync 映射、schema parity、Excel import/export 和备份恢复；这些字段继续采用普通 record LWW，不复用库存 operation RPC。
- 首期只保存当前拍摄记录自身的后期阶段和日期，不增加订单、价格、评价或通知订阅。浏览器/PWA 提醒另作可选增强，不得阻塞时间线基本记录。

**交互**

- Roll 详情显示紧凑时间线和“更新冲扫状态”次级动作；Dashboard 不增加订单或服务商管理模块。
- 状态可以跳过，不强制每卷经历所有步骤；家庭自冲用户可以直接进入“扫描完成/底片归档”。回退状态必须确认是否清理后续日期，禁止静默改写历史。
- 可选提醒只在用户明确设置日期后触发；PWA/浏览器通知权限必须在用户动作后请求，拒绝后仍可使用时间线。

**验收**

- 领域测试覆盖正常推进、跳步、回退、缺失日期、home development、跨设备 LWW、删除 Roll 和导出恢复。
- UI 测试覆盖键盘/触控、状态说明、确认、提醒权限拒绝、中英文和不影响现有 complete/archive 语义。

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

<a id="ui-landing-privacy-narrative"></a>
### UI-32 Landing / Onboarding Private-first 信任叙事

**状态与范围**

- 未实现；纯文案与展示位置调整，不依赖任何其他任务，可在任意时间独立实施。不新增路由、Dexie/Supabase 字段、设置项或开关，不改变现有 Dexie-first 架构或数据流向。
- 目标：把“本地优先、数据归你所有、不用于训练”从 Roadmap 内部产品原则（`private-first personal archive`）升级为 Landing 和首次导入/激活流程中用户可见的信任承诺，作为激活转化的辅助论据，不替代现有 Gear/Archive/Film/Finance 功能卖点。
- 边界：只描述当前代码已经成立的事实（本地 Dexie 优先、Cloud sync 默认关闭且需用户显式开启、私有 Storage、不做站内 Feed/推荐/广告）；不承诺尚未实现或无法验证的行为，例如不得写“端到端加密”“绝不联网”等与实际架构不符的表述。

**内容与位置**

- Landing Hero 区在现有 `titleLine1/titleHighlight/subtitleLine1/subtitleLine2` 之外，新增一条克制的信任语句或独立小节，例如强调“先本地保存，同步与账号完全可选”“你的记录不会被用来训练模型”；具体文案需中英文分别撰写，不做机翻。
- 可选在 Landing 的功能卡片区（`featureGearTitle` 等四张卡片）之外新增一张 `Private-first` 卡片，或作为四张卡片下方的独立说明条；不得压缩、替换现有四个功能卖点的展示空间。
- Existing History Import 激活流程（[`UI-23`](#ui-history-import-onboarding)）的入口页可复用同一信任文案，向准备导入历史数据的用户强调“导入后仍先保存在本机，账号与同步都是可选项”；本任务不改变 UI-23 已定义的分步流程和验收，仅提供可引用的文案 key。
- Settings 中已有的 Cloud sync 开关说明如与本任务文案冲突，需要统一措辞，但不得改变现有开关行为、默认值或 `VITE_ENABLE_SUPABASE_SYNC` 语义。

**受影响文件（当前代码定位，2026-08-29 核对）**

- `frontend/src/views/Landing/LandingView.tsx`：Hero 区在 `hero-subtitle`（约第 82-85 行，`subtitleLine1`/`subtitleLine2`）之后可插入一条信任语句；功能卡片区 `features-grid`（约第 99-145 行，四个 `feature-card` 在第 108-141 行）之后可追加第五张 `Private-first` 卡片或独立说明条，不改变前四张卡片的顺序和内容。
- `frontend/src/i18n/translations.ts`：现有 `landing.*` 键位于中文块约第 176-195 行、英文块约第 1255-1274 行；新增键需在两个块中成对添加，不能只补一侧语言。
- 一致性参照：`account.cloudSync` / `account.cloudSyncOn` / `account.cloudSyncOff`（中文约第 151-153 行、英文约第 1230-1232 行）是当前 Settings 对 Cloud sync 状态的现有措辞，如与本任务新文案冲突需统一表述。
- Existing History Import 入口（[`UI-23`](#ui-history-import-onboarding)）当前尚未实现，仓库内无对应文件；该任务落地后再把本任务的信任文案 key 接入其入口页，不在本任务提前新建 UI-23 的组件。

**验收**

- 新增文案必须同时提供中英文 key，遵循现有 `landing.*` i18n 命名与双语审阅要求；不硬编码用户可见文本。
- 组件/响应式回归：Landing 现有 `320 / 375 / 390 / 430 / 480 / 540 / 640 / 768 / 1024 / 1280 / 1440px` E2E 在新增内容后仍无横向溢出，且不与品牌/导航区域重叠（沿用 [`UI-13`](#ui-landing-brand-navigation) 的验证基线）。
- 文案审阅：确认所有信任类表述均可由当前代码验证（本地优先、Cloud 默认关闭、private Storage），不引入无法交付的安全/隐私承诺；产品负责人复核后才可视为完成。
- 完成后回到 Roadmap 更新对应顶层 checkbox；若同时更新 README 或其他面向用户的说明，按 Roadmap「文档持续同步」任务一并处理。

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
