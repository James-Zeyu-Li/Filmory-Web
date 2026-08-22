# Grainfolio-Web Roadmap

本文件是唯一的优先级、实施顺序和顶层完成状态来源。根目录 `TODO.md` 已移除，避免部署清单与产品 Roadmap 双线维护。

UI/UX 的页面结构、交互、响应式、无障碍、i18n 和视觉验收细节统一维护在 [`UI_UX_TODO.md`](./UI_UX_TODO.md)。本文件只保留 UI/UX 任务的顶层状态、依赖和跨领域边界，禁止在两处重复维护同一套详细要求。

Cloud/backend 的 Supabase、Auth/SMTP、Storage、RLS、migration/backfill、支付 webhook、观测和部署细节统一维护在 [`CLOUD_TODO.md`](./CLOUD_TODO.md)。本文件只保留 Cloud 任务的顶层状态与实施顺序。

## 当前原则

- 每次只处理一个模块或一个明确问题。
- 优先级顺序：数据正确性/安全 > 明显 UI bug > 当前体验改进 > 商业化闭环 > 上线部署 > 长期维护。
- 功能实现与相邻测试一并收口；涉及数据、安全、同步或高风险交互时必须完成对应自动测试与必要的手工 smoke。
- 每轮开发都顺手清理明确无用的临时代码、脚本、缓存和过期注释。
- UI/UX 任务先按 `UI_UX_TODO.md` 完成详细验收，再回到本文件更新顶层 checkbox；任务排序仍以本文件为准。
- Cloud/backend 任务先按 `CLOUD_TODO.md` 完成 migration、配置、权限和真实 smoke，再回到本文件更新顶层 checkbox；禁止在专题文档维护第二套优先级。
- 仓库内执行依据以本 Roadmap、README、现有架构边界和测试契约为准；本机 `.agents/` 若存在可作为附加规范，但不是可提交或可复现的仓库事实来源。

## 已完成摘要

- 架构与 Cloud：React/Vite + Dexie local-first、Supabase Auth/Postgres/RLS/private Storage/signed URL/RPC/sync 已完成 migration、schema parity、P0 security、sync smoke、双账号隔离、Realtime 与库存并发验证；长期 schema/LWW 边界增强独立排期。
- 核心产品：Dashboard、拍摄记录/项目集、器材库、财务/统计/对比、标签和 Excel 导入/导出已覆盖当前胶片工作流；导入已逐行校验，Photos/Albums 已隐藏，统计已改为胶片用户优先。
- 器材与记录：相机/镜头/胶卷采用推荐 + 手动 fallback；120 后背、共享后背、固定后背、卷级镜头、装载冲突和封面刷新恢复已完成并有测试覆盖。Gear 已拆为独立 Tabs、领域表单、共享封面编辑器和 `useGearActions`，持久化仍复用原 Dexie transaction、库存 RPC 与 SyncService 路径。
- 认证、会员与试用：Dev Bypass 已隔离到开发环境；注册、验证、登录、恢复密码和账号删除的前端流程，以及 RLS/private Storage、会员限制、试用入口/限制、Upgrade Modal 和 Account Center 已完成。正式域 OAuth、密码策略和观测仍按 P1 保持未完成。
- UI 与 i18n：Landing、Settings、tab 偏好、响应式/CSS 收口、图片压缩和核心界面中英文已完成；PWA 更新提示和危险操作取消态测试已完成。架构文档仍需按最新同步、图片恢复和 Gear 拆分状态更新，不再将文档同步笼统标为完成。
- 同步与验证：Dexie transaction queue、500ms 防抖、明确提交立即同步、Realtime/fallback、队列失败恢复、Cloud DB migration 和双设备 smoke 已完成；库存 RPC 使用 operation outbox + 幂等 `operationId`，不再由 LWW 覆盖库存数。`lint`、同步相关测试与 `npm run build` 已通过；仅保留非阻塞 bundle chunk size warning。Cloud sync 仍由 `VITE_ENABLE_SUPABASE_SYNC` 控制。
- 邮件认证：Resend 发信域/发件人、真实注册与 recovery、900 秒 OTP、recovery intent、站内回跳 allowlist 已完成；正式 HTTPS、OAuth 和观测仍待完成。
- Cloud Storage：`grainfolio-assets` private、owner signed URL、跨用户拒绝、`delete_user()` 权限和 cascade 已验证；上传失败不会再把空图片 metadata 推到 Cloud，本地 blob 补上传服务与 Settings 修复入口已实现。`photo-upload-recovery` 的同用户 in-flight 去重回归已恢复通过；2026-08-22 全量 Vitest 为 `58 passed / 3 skipped` 文件、`255 passed / 5 skipped` 测试。剩余阻塞仅为真实 Cloud 跨设备与 object/metadata 验收。

## Next Up

按此顺序实施；下方各任务保留实现细节和验收标准。

1. **P1 图片完整性 Cloud 收口：** 代码与本地测试已完成；补真实 Cloud 跨设备显示、失败重试和 object/metadata 对照验证。
2. **P1 公开环境安全：** 正式域 Auth/邮件验收、密码策略与恢复链路、最小错误观测。
3. **P1.5 导航可靠性：** 按阶段完成项目集详情 URL，再完成四类器材编辑 Modal URL；拍摄记录 Drawer 阶段已完成，不重复开发。
4. **P2 产品体验：** 继续 Dashboard/报告/花费职责、胶卷洞察和趋势范围，再进入分享卡片；Auth、Compare、Insights 降噪已完成，不再列入 Next Up。
5. **P3 商业化：** 先确定图片配额策略，再接自动支付 webhook。
6. **P4 发布与条件任务：** Cloudflare 部署、Worker、bundle、命名迁移、机会型模块抽取与长尾 i18n；只在前置条件满足时开始。

## P0/P1：Cloud 可靠性与公开环境安全

以下 checkbox 是唯一顶层状态；实施、配置、SQL 与验收细节见 [`CLOUD_TODO.md`](./CLOUD_TODO.md)。需要真实 Supabase、生产域、邮件或支付 provider 的项目不作为 local-only 开发阻塞项。

- [x] **Offline-first Sync Hardening（库存 P0 已收口）**
  - 普通 record queue、库存 operation outbox/幂等 RPC、Realtime/fallback、失败恢复与双设备验证已完成；保留的条件增强见 [`CLD-B01`](./CLOUD_TODO.md#cld-baseline-sync) 与 [`CLD-09`](./CLOUD_TODO.md#cld-09-deferred-cloud)。

- [ ] **生产域 Auth / 邮件最终验收**
  - Resend、自定义发件域、注册/recovery 与本地回跳已完成；剩余正式 HTTPS、精确 Redirect URLs、移动邮件 App、provider 日志与 OAuth 验收见 [`CLD-02`](./CLOUD_TODO.md#cld-02-production-auth-email)。

- [ ] **Auth 密码策略与恢复链路加固**
  - 优先完成服务端密码策略、Leaked Password Protection、邮件限流、改密通知与防枚举 recovery 验收；当前明确不实现密码历史策略。详见 [`CLD-03`](./CLOUD_TODO.md#cld-03-password-recovery-policy)。

- [ ] **Auth / 前端错误观测与追踪**
  - 建立不记录密码/token/完整敏感 URL 的统一 telemetry 边界，覆盖 Auth、Sync、Storage、ErrorBoundary 和人工排查路径；详见 [`CLD-04`](./CLOUD_TODO.md#cld-04-observability)。

- [x] **Cloud Storage 图片完整性实现**
  - Deferred metadata 防护、历史 blob 补上传服务、Settings 入口及同用户 in-flight repair 去重已实现并通过本地回归；真实 Cloud 完整验收见 [`CLD-01`](./CLOUD_TODO.md#cld-01-photo-integrity)。

- [ ] **Cloud Storage 图片完整性最终验证**
  - 完成跨设备 signed URL、object/metadata 对照、失败重试和重复对象保护；Cloud 步骤见 [`CLD-01`](./CLOUD_TODO.md#cld-01-photo-integrity)，界面验收见 [`UI-02`](./UI_UX_TODO.md#ui-cloud-photo-recovery)。此项关闭后，才可开始为封面图新增可同步的焦点位置元数据；不得并行实施 [`UI-11`](./UI_UX_TODO.md#ui-cover-focal-point)。

- [ ] **云端图片/存储配额策略（P3）**
  - 明确 regular/vip 配额、可信 Cloud 判定、超额行为与对象清理策略；详见 [`CLD-06`](./CLOUD_TODO.md#cld-06-storage-quota)。

- [ ] **Supabase legacy schema / backfill 决策（公开部署或数据迁移前）**
  - 公开部署或破坏性迁移前决定 camera legacy 列、120 历史 backfill、profile revision 与命名兼容策略；详见 [`CLD-05`](./CLOUD_TODO.md#cld-05-schema-backfill)。

- [ ] **商业化自动支付闭环（P3）**
  - 从人工申请升级到 hosted checkout + 签名 webhook + 幂等 VIP 回写；provider、安全与测试矩阵见 [`CLD-07`](./CLOUD_TODO.md#cld-07-payment)。

## P1.5：导航可靠性与页面状态

- [ ] **业务详情 URL 与浏览器导航语义收口**
  - 优先级与时机：P1.5，位于 P1 Cloud 图片/公开环境安全验收之后、P2 产品体验之前。严格按 `拍摄记录 Drawer -> 项目集详情 -> 器材编辑 Modal` 三个独立阶段实施；每个阶段单独修改、测试和验收，不一次重构全部页面。
  - 当前事实：
    - 拍摄记录 Drawer 阶段已完成：`?tab=all&openRoll=<id>` 由 `RollsView` 派生详情，刷新可以恢复，列表打开使用 history entry，浏览器后退可以关闭 Drawer；相关 focused tests 和 Dashboard E2E 已更新。
    - 项目集详情只由 `activeCollectionId` 本地 state 控制；URL、刷新和浏览器后退均不能恢复详情，进入详情后当前 PageTabs 还会被隐藏。
    - 器材编辑只由 `editingCameraId / editingLensId / editingFilmId / editingEquipmentId` 与 Modal state 控制；刷新会关闭未保存表单，但不会丢失此前已经保存到 Dexie 的数据，因此当前主要是导航与编辑体验缺口，不作为数据丢失 P0 描述。
  - 目标 URL 契约：
    - 拍摄记录：`/rolls?tab=all&openRoll=<rollId>`；`tab` 只接受现有 `all | collections | loose`。
    - 项目集：`/rolls?tab=collections&collectionId=<collectionId>`。
    - 器材编辑：`/gear?tab=cameras&edit=<cameraId>`、`/gear?tab=lenses&edit=<lensId>`、`/gear?tab=filmStocks&edit=<filmStockId>`、`/gear?tab=otherEquipments&edit=<equipmentId>`；`tab` 必须复用现有 `SubTab`，不另造近义参数。
    - 旧入口兼容：Dashboard 及已有 `openRoll`、`newCamera`、`newFilm` 调用不能突然失效。允许在首次读取时用 `replace` 补齐 canonical `tab`，但不得再把有效详情参数立即清空。
  - 路由状态原则：
    - URL 是当前 tab 与当前详情对象的唯一真源。组件直接从 `useSearchParams()` / `location.search` 派生 `openRollId`、`collectionId`、`editId` 和详情开关；不要同时维护第二份 selected-id/open state，再用双向 `useEffect` 同步。
    - `localStorage` 只在 URL 缺少 `tab` 时提供用户偏好的 fallback；确定有效 tab 后用一次 `replace` canonicalize URL。URL 已明确指定时不得被旧偏好覆盖；隐藏或非法 tab 必须回退到当前设置允许的 tab。
    - 更新 query 时保留仍然有效的无关参数，使用小型类型化 helper 统一增删参数；不要在多个事件处理器里手写不同版本的字符串 URL。
    - URL 中的 ID 永远是不可信输入，不能由 ID 拼出伪记录，也不能跳过用户边界。详情只能来自当前登录用户的 Dexie 查询或已经按 `userId` 过滤的 live data；记录不存在、已删除或属于其他用户时不得渲染其内容。
  - History 规则：
    - 从当前列表点击打开 Drawer / Modal：创建新的 history entry（`push`），让浏览器后退可以关闭详情并回到原列表/tab。
    - Tab 切换：使用 `replace`，避免用户在多个 tab 间点击后需要连续后退。
    - 浏览器后退导致 URL 详情参数消失：组件只响应 URL 变化并关闭详情，不得再调用 `navigate`，避免与 `popstate` 形成重复导航。
    - 点 X、遮罩或 Esc 主动关闭：不能无条件使用 `replace`。如果详情是从当前列表通过本应用 `push` 打开的，优先回到该 entry 的上一条；如果是刷新、书签、外部链接或 Dashboard 直达而没有可靠的列表来源标记，则 `replace` 为保留当前 tab 的 canonical 列表 URL。实现时使用明确的 `location.state` 来源标记或等价的类型化导航 helper，不依赖 `history.length` 猜测。
    - Dashboard 的“继续记录”应直接进入 `/rolls?tab=all&openRoll=<id>`。用户按浏览器后退应回到 Dashboard；用户点 Drawer 的 X 应落到 `/rolls?tab=all`，不能产生循环历史。
  - 阶段 1：拍摄记录 Drawer（已完成）
    - 已移除打开 `openRoll` 后立即清空 query 的旧逻辑，详情选择和 Drawer 开关改为 URL 派生。
    - Dashboard 深链接、刷新恢复、列表打开、Back、X/Esc/遮罩关闭、删除/归档后的 URL 清理均已覆盖；未找到记录时不会伪造内容。
    - 本阶段没有改变 Roll 保存 transaction、库存 RPC、封面上传、相机转移、SyncService、会员限制或 120 后背逻辑。
    - 后续只需在阶段 2/3 实施时复用同一 URL/history 规则，不要把整项任务重新标记为未完成。
  - 阶段 2：项目集详情
    1. 将 `activeCollectionId` 改为 `collectionId` query 派生，并保持 `tab=collections`；列表点击使用 `push`，返回箭头、浏览器后退和刷新遵循统一 History 规则。
    2. 项目集详情打开时继续显示 PageTabs 与必要的页面上下文；返回动作只关闭详情，不把用户送出 `/rolls`。
    3. 当设置关闭项目集/独立记录、项目集被删除或 URL ID 不属于当前用户时，清理无效 `collectionId` 并回退到允许的 canonical tab；不得影响项目集删除后清空关联 `Roll.collectionId` 的既有 transaction。
  - 阶段 3：器材编辑 Modal（最后做）
    1. `tab` 决定实体表，`edit` 决定当前记录；只从对应当前用户数据集中解析实体，禁止在四张表间用同一个 ID 盲查或猜类型。
    2. 相机、镜头、胶卷、其他器材卡片打开编辑时写入 canonical URL；刷新恢复相同编辑 Modal，后退关闭并返回原 tab。新建入口继续兼容现有 query，除非另开任务统一创建 URL，不在本阶段顺手改名。
    3. 继续复用已拆分的领域表单、`useGearActions`、库存 delta operation 和 `GearAvatarEditor`；不得把保存逻辑搬回 `GearView`，也不得为路由改造重写 120 系统/后背模型。
    4. 本阶段不实现表单草稿持久化。刷新时只恢复“正在编辑哪条记录”及该记录最后已保存的数据；未提交输入是否需要离开确认，必须另行产品确认，不能宣称自动恢复。
  - 自动测试要求：
    - 组件/集成测试：URL 初始化能打开正确详情；列表点击更新 URL；Tab 使用 `replace`；X/Esc/遮罩和浏览器 Back 行为符合来源规则；非法 tab、缺失 ID、已删除记录和其他用户 ID 不渲染详情。
    - 拍摄记录重点覆盖：Dashboard 深链接补齐 `tab=all` 后仍打开指定 Drawer；刷新保持 Drawer；Back 关闭 Drawer；删除/归档后 URL 不残留；本地尚未同步到记录时不崩溃、不伪造内容，并能在 Dexie live data 到达后自动显示。
    - 项目集重点覆盖：刷新恢复项目集；Back 返回项目集列表；详情中 PageTabs 仍可见；设置隐藏项目集后旧 URL 能 canonicalize 到允许页面。
    - 器材重点覆盖四种实体 tab；同 ID 出现在错误 tab、跨用户 ID 和已删除记录均不得打开 Modal；保存后现有 Dexie transaction 与 sync 唤醒断言保持通过。
    - E2E 只覆盖关键用户旅程：列表打开 -> URL 可复制 -> 刷新恢复 -> 浏览器后退关闭；Dashboard -> 指定拍摄记录；项目集详情；每类器材至少一条代表路径。使用 role/可访问名称选择器，不依赖 CSS 结构或固定 timeout。
  - 每阶段验收：对应 focused tests、相关现有回归、`npm run lint`、`npm run build` 全部通过，再做桌面和移动端手工 smoke。完成一个阶段只在本条内标记该阶段，不得在另外两个阶段未实现时把整项打勾；实现和验收后再同步更新架构 docs。

## P2：产品体验（在 P0/P1/P1.5 后执行）

详细 UI/UX 范围和通用验收基线见 [`UI_UX_TODO.md`](./UI_UX_TODO.md)。以下 checkbox 是唯一顶层状态来源。

- [x] **移动端同步状态、照片筛选与 tablet 工具栏收口**
  - 已完成 `<=1024px` 工作区、Sync Badge/safe-area、筛选与工具栏响应式；详细基线见 [移动端工作区与工具栏](./UI_UX_TODO.md#ui-baseline-mobile-workspace)。

- [ ] **固定底部 context action 与同步 Badge 真实组合闭环**
  - 当前没有真实 context action，保持条件触发；详细要求见 [`UI-01`](./UI_UX_TODO.md#ui-fixed-bottom-layers)。

- [x] **移动端页头文案、宽度与主操作一致性收口**
  - `ResponsiveHeaderSubtitle`、双语移动文案、触控区和过渡已完成；详细基线见 [页头与 PageTabs](./UI_UX_TODO.md#ui-baseline-headers-tabs)。

- [x] **共享 PageTabs 视觉分组与响应式宽度收口**
  - 共享 Tabs、ARIA 键盘语义和 `320-1024px` 响应式已完成；详细基线见 [页头与 PageTabs](./UI_UX_TODO.md#ui-baseline-headers-tabs)。

- [x] **跨页面长文案、页头操作与工具栏窄屏收口**
  - 已完成移动页头两行说明、主操作保护、Gear/Shooting Log 的 `<=360px` 整行降级，以及共享 Tabs、搜索与排序工具栏的固定宽度清理。`320 / 375 / 390 / 430 / 768 / 1024 / 1280px` 中英文 E2E 均确认无横向溢出；当前代码事实和验收见 [`UI-10`](./UI_UX_TODO.md#ui-responsive-copy-actions)。

- [ ] **封面图非破坏焦点调整（P2，图片 Cloud 完整性后）**
  - 保留当前等比 WebP 压缩与卡片 `cover` 展示；为拍摄记录和器材封面保存可同步的焦点位置，不永久裁切图片、不引入原图相册或新照片库。完整产品、数据、无障碍与验收边界见 [`UI-11`](./UI_UX_TODO.md#ui-cover-focal-point)。

- [x] **胶卷报告工作台第一阶段**
  - Insights 胶卷 tab、聚合、排序、Drawer 和旧 URL 跳转已完成；完成拍摄优先的产品口径仍由下方独立任务跟踪。

- [x] **Auth 页面架构收口：独立路由 + 居中认证卡片**
  - 时机：正式域部署前完成 `/auth/login`、`/auth/signup`、`/auth/forgot-password`、`/auth/reset-password`，并兼容旧 `/login` 入口；视觉与无障碍要求见 [`UI-03`](./UI_UX_TODO.md#ui-auth-layout)。
  - 安全边界：保留 Supabase recovery session、同 userId 的 15 分钟 intent、900 秒 Email OTP、严格 redirect allowlist 和精确 HTTPS callback；不能为了页面拆分削弱现有 guard。
  - 已完成前端验证：旧 URL、Landing/trial CTA、共享认证卡片、字段错误聚焦/ARIA、条件 OAuth 按钮、键盘顺序、明暗主题，以及 `320-768px` 与手机横屏无横向溢出；真实 OAuth、邮箱验证、密码重置、user mismatch、过期/重复 recovery 和恶意 `next` 的 routing/security tests 仍属于 Cloud/生产认证验收。

- [ ] **控制中心、拍摄报告与花费的职责收口**
  - 当前结构拆分和账本支出来源已完成；剩余月度摘要决策、范围标签、去重及跨页面一致性，详细体验见 [`UI-04`](./UI_UX_TODO.md#ui-dashboard-insights-finance)。

- [ ] **胶卷库存与洞察职责合并（完成拍摄优先）**
  - 导航合并已完成；剩余使用优先 KPI/列表/排序、彩黑指标去重和移动验收，详细体验见 [`UI-05`](./UI_UX_TODO.md#ui-film-insights)。
  - 数据边界：`archived` 计入完成、`active` 单列；缺失/删除关联和数码占位不猜测类型。实现前用 `Map<filmStockId, Roll[]>` 一次分组，保持 Dexie/SyncService 路径不变。

- [x] **Insights 图表信息降噪**
  - 低价值卡片、聚合、双语文案和零引用 CSS 已移除；详细基线见 [Insights 降噪](./UI_UX_TODO.md#ui-baseline-insights-cleanup)。

- [ ] **Insights 月度趋势时间范围切换**
  - 两个趋势图共用范围和聚合粒度；详细要求见 [`UI-06`](./UI_UX_TODO.md#ui-insights-range)。

- [x] **Compare 工作台复核**
  - 已保持两张本地照片 A/B 对照边界，并完成原生键盘文件入口、双语错误反馈、共享空态、主题 token、死 CSS 清理及 `320-1024px` 响应式验证；实现与验收见 [`UI-07`](./UI_UX_TODO.md#ui-compare-workspace)。

- [ ] **胶卷分享卡片生成器**
  - 交互、模板、字段和导出验收见 [`UI-08`](./UI_UX_TODO.md#ui-share-card)；不依赖全局照片仓库。

- [ ] **i18n 长尾机会型清理**
  - 核心路径已双语化；剩余边界、响应式验收，以及不应强依赖 Dev Bypass/旧 Dashboard Batch import 的 i18n E2E 更新见 [`UI-09`](./UI_UX_TODO.md#ui-i18n-tail)。

- [ ] **Roll -> Shoot 命名收口（Cloud sync 稳定后再做）**
  - 当前 `Roll` 已经是拍摄工作的聚合根，不只是单纯“一卷胶卷”：它关联相机、镜头、胶卷、120 后背、时间、地点、笔记、封面/样片、费用和项目集。
  - 推荐领域名：代码层逐步从 `Roll` 迁移到 `Shoot`；中文 UI 使用“拍摄记录”，避免“拍摄任务/工作”过于商业派单。
  - 不建议现在直接全量 rename；它会影响 Dexie store、Supabase `rolls` table、sync 映射、E2E、文档和历史数据。Cloud Auth/Sync 稳定后再做 migration 或兼容层。
  - 推荐步骤：先只调整用户可见文案，把“胶卷记录”逐步改为“拍摄记录”；随后增加兼容 alias；最后评估是否把数据库表从 `rolls` 迁移为 `shoots`，或保留表名只改领域接口。

- [x] **拍摄记录单机身与高级换机例外**
  - 新记录有唯一 `currentCameraId`；镜头继续允许多选。`cameraIds` 保留为旧资料、导出与同步兼容集合，不再定义为当前装载状态。
  - 仅进行中的拍摄记录可从高级选项执行“更换拍摄机身”；需要确认胶卷已安全转移，可记录日期与备注。每次换机追加 `cameraTransfers`，并更新当前机身。
  - 带 120 后背的记录只能转移到相同相机系统；无后背记录仅显示同类型、同格式机身，物理转移仍由摄影师确认。
  - 统计中的相机指标使用换机事件计算参与记录数；控制中心的使用中机身只显示每条 active 记录的当前机身。
  - 已新增 Dexie v25 与 Supabase migration；历史多机身数组默认将第一台收敛为当前机身，不伪造过往换机时间。
  - 边界：胶片库存仍叫 `FilmStock`；`filmStockId` 作为 `Shoot` 的可选胶片字段保留，兼容数码和胶片工作流。

## P4：发布与条件触发任务

- [ ] **登录后关键资料自动恢复（profile bootstrap，Deferred）**
  - 当前 Cloud smoke 未复现资料恢复异常，不作为当前开发任务；触发条件和 Cloud 边界见 [`CLD-09`](./CLOUD_TODO.md#cld-09-deferred-cloud)。

- [ ] **前端模块机会型抽取（Deferred）**
  - 已完成 Gear 阶段：四个器材列表 Tab、Camera/Lens/Film/Other 表单、共享 `GearAvatarEditor` 与 `useGearActions` 已从根 `GearView` 抽出；表单不直接拥有 Supabase 或新的持久化路径。
  - 已验证 Gear actions 与表单：覆盖 135、固定/可换后背 120、复用系统、镜头、胶卷库存 delta、其他器材、取消、失败和同步唤醒。
  - 后续只做机会型收口：格式化当前被压成单行的 Tab JSX；继续缩小仍较大的 Camera/Lens/Film 表单；修改对应页面时再抽取重复 KPI、拍摄卷卡片或导入反馈逻辑。
  - 不为 OOP 强行重构，也不为了行数拆出没有业务边界的薄组件。
  - 每次抽取必须保留现有 Dexie / SyncService 单一数据路径，并补相邻测试；不单独抢占数据可靠性工作。

- [ ] **上线部署后置：Cloudflare Pages / 域名 / Redirect URL**
  - UI/Auth 与公开环境安全收口后再配置 Pages、域名、HTTPS、生产 env、精确 Redirect URLs 和发布 smoke；托管、安全边界及验收矩阵见 [`CLD-08`](./CLOUD_TODO.md#cld-08-deployment)。

- [ ] **图片压缩 Worker 化（条件触发，不作为当前优先项）**
  - 判断：当前没有全局照片库和批量照片管理入口，主路径只在拍摄卷封面、云端照片缩略图和器材头像中使用 Canvas/WebP 压缩；单张处理可接受，不需要现在强行引入 Worker。
  - 触发条件：如果后续恢复多图导入、批量封面/样片上传、分享卡片批量生成，或实测 15MB-30MB 扫描图在移动端造成明显输入/滚动卡顿，再开始实现。
  - 技术边界：Worker 不替代 Canvas；目标是把图片解码、缩放和 WebP 编码从主线程移到 Worker 内执行。优先使用 `createImageBitmap` + `OffscreenCanvas`，同时保留现有主线程 Canvas fallback。
  - 范围：先抽统一 `imageProcessingService`，复用现有输出格式、最长边和 quality 常量；覆盖 `compressImageToWebP`、`compressImageToBase64`、`generateThumbnail` 三条路径。
  - 验证要求：补 worker/fallback 单测或集成测试，确认输出仍为 WebP、长宽比例保持、失败态可回传；E2E smoke 确认处理期间表单和上传进度不会进入不可用状态。

- [ ] **图片 URL 与长列表按需加载（Deferred）**
  - 当前基础：`usePhotoUrlMap` 已实现缩略图优先、signed URL / 本地 blob fallback、Blob URL 清理和异步失效保护；当前不需要重写 Storage 上传路径。
  - 当前缺口：`photos` 数组引用或 `preferFull` 变化会重新解析整个 URL map；Rolls 与 Collections 会传入全部 `PhotoAsset`，打开 lightbox 时也可能为整组图片请求完整 signed URL。
  - 优先收口：调用方只传当前封面或可见图片；lightbox 只为当前选中图片请求完整 URL；普通 `<img>` 使用 `loading="lazy"` 与 `decoding="async"`。CSS background 封面不能假装获得原生 lazy loading，需要按实际列表结构选择 `<img>`、`content-visibility` 或可见区策略。
  - 缓存边界：若性能测量仍显示重复签名或解析开销，再按 `userId + photo.id + storageKey + thumbnailUrl` 做差异更新；signed URL 缓存必须记录过期时间并在用户/会话切换时清理，Blob URL 必须保持可验证的 revoke 生命周期，禁止直接增加无界全局 `Map`。
  - 条件触发：当前 Photos/Albums 已隐藏，不为未启用的全局照片库提前引入虚拟列表或复杂 `IntersectionObserver`；仅在长拍摄记录列表、恢复多图入口或 profiling 证明存在明显重算/解码成本时升级。
  - 验证要求：补 Hook 测试，覆盖未变化图片不重复解析、单张大图不会触发全列表签名、移除图片会释放 Blob URL、signed URL 过期与账号切换不会复用旧缓存；用 Network/Performance 面板复核请求数与长列表滚动。

- [ ] **Bundle 拆分**
  - 当前状态：production build 通过但存在大 chunk 警告；`xlsx` 虽被拆为 `vendor-excel`，仍由 Settings 静态导入的 `BackupService` 进入首屏 module graph，并被 PWA precache。`ExcelImportModal` 当前没有生产调用方，先确认恢复入口还是删除孤立代码。
  - Excel 边界：保留“用户选择文件后才解析”的现有行为；导出、导入与模板下载在真实用户动作发生时再动态 `import()` 对应 service，让 `xlsx` 不再随首屏下载。不要只调整 `manualChunks` 后误判为 lazy load。
  - 路由拆分：使用 `React.lazy` / 动态 import 按路由加载 Dashboard、Gear、Rolls、Insights、Compare、Settings/Auth 等非首屏页面；加载 fallback 复用现有页面过渡与主题，不引入新的持久化或数据路径。
  - PWA 边界：同步调整 Workbox precache 策略；否则动态 chunk 即使不再 modulepreload，仍会在 Service Worker 安装时提前下载。离线核心页面与按需重依赖需要分别定义 precache/runtime cache 策略。
  - 验证要求：build 产物中首页不再 modulepreload `vendor-excel`，初次访问 Network 不下载 `xlsx`；首次触发导入/导出后功能正常且只加载一次；PWA 离线升级流程不回归，并记录首屏 transfer size 与关键 chunk 变化。

- [ ] **文档持续同步**
  - 新功能完成后同步 README、schema、`.local-docs` 事实规格和本 Roadmap；UI/UX 细节同步到 `UI_UX_TODO.md`，Cloud/backend 细节同步到 `CLOUD_TODO.md`，顶层状态只在本 Roadmap 更新。先更新权威事实，再更新导览与审查文档，避免再次形成历史口径。
