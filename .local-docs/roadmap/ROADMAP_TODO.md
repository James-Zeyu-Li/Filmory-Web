# Grainfolio-Web Roadmap

本文件是唯一的优先级、实施顺序和顶层完成状态来源。根目录 `TODO.md` 已移除，避免部署清单与产品 Roadmap 双线维护。

UI/UX 的页面结构、交互、响应式、无障碍、i18n 和视觉验收细节统一维护在 [`UI_UX_TODO.md`](./UI_UX_TODO.md)。本文件只保留 UI/UX 任务的顶层状态、依赖和跨领域边界，禁止在两处重复维护同一套详细要求。

Cloud/backend 的 Supabase、Auth/SMTP、Storage、RLS、migration/backfill、支付 webhook、观测和部署细节统一维护在 [`CLOUD_TODO.md`](./CLOUD_TODO.md)。本文件只保留 Cloud 任务的顶层状态与实施顺序。

## 当前原则

- 每次只处理一个模块或一个明确问题。
- 优先级顺序：数据正确性/安全 > 明显 UI bug > 当前体验改进 > 商业化闭环 > 上线部署 > 长期维护。
- 产品定位保持 **private-first personal archive for film photographers**：默认私密、用户主动分享；不建设站内 Feed、关注、点赞、评论、排行榜或 engagement-driven recommendation。
- 产品循环遵循 `Capture -> Organize -> Complete -> Remember -> Share`；现场记录坚持 **Capture first, enrich later**，高级字段默认按需展开，不把拍摄爱好变成强制填表。
- 优先让现有数据产生可感知价值，再新增字段。Camera/Roll Passport、Project、Year in Film 和分享内容必须由明确关系与真实记录确定性推导，禁止用同名字符串、缺失照片或估算值伪造历史。
- 当前没有完整逐帧记录，因此 `frame count`、`cost per frame`、按帧相机占比和千帧里程碑不得作为真实功能或营销数字；只有 Contact Sheet/帧模型建立并验证后才能启用。
- 冲扫生命周期只记录用户自己的状态、日期和备注；不建设附近冲扫店目录、商店发现、店铺评分或未授权第三方目录抓取。
- 完成感必须克制：允许资料不完整、允许手动标记完成，不使用让用户产生任务压力的全局“档案仅完成 63%”式表达。
- 所有工作区默认先给清晰的当前状态、一个可理解的下一步和已经完成的事实；保持默认简单、按需展开深度。完成应带来满足感而非评判，不以连续签到、强制补资料或升级压力替代摄影档案价值。
- 功能实现与相邻测试一并收口；涉及数据、安全、同步或高风险交互时必须完成对应自动测试与必要的手工 smoke。
- 每轮开发都顺手清理明确无用的临时代码、脚本、缓存和过期注释。
- UI/UX 任务先按 `UI_UX_TODO.md` 完成详细验收，再回到本文件更新顶层 checkbox；任务排序仍以本文件为准。
- Cloud/backend 任务先按 `CLOUD_TODO.md` 完成 migration、配置、权限和真实 smoke，再回到本文件更新顶层 checkbox；禁止在专题文档维护第二套优先级。
- 仓库内执行依据以本 Roadmap、README、现有架构边界和测试契约为准；本机 `.agents/` 若存在可作为附加规范，但不是可提交或可复现的仓库事实来源。

## 任务可执行性标记

- **Ready：** 入口、数据来源、写入边界、依赖和验收均已明确，可按 `Next Up` 顺序直接实现。
- **Decision required：** 仍需用户确认产品合同、字段或 provider；Agent 只能调研和补计划，不能自行替用户决定后编码。
- **Cloud validation：** 本地实现和自动测试已完成，但必须通过真实账号、对象或生产域 smoke 才能关闭。
- **Conditional：** 只有文档中的量化触发条件或外部授权满足后才开始；不得因任务存在于 Roadmap 就提前建设。
- 后续 Agent 开始任务前必须先核对该标记及依赖；没有标记的旧任务按其正文中最严格的前置条件处理，不跳过 `Next Up` 抢做远期功能。

## 已完成摘要

- 架构与 Cloud：React/Vite + Dexie local-first、Supabase Auth/Postgres/RLS/private Storage/signed URL/RPC/sync 已完成 migration、schema parity、P0 security、sync smoke、双账号隔离、Realtime 与库存并发验证；长期 schema/LWW 边界增强独立排期。
- 核心产品：Dashboard、拍摄记录/项目集、器材库、财务/统计/对比和 Excel 导入/导出已覆盖当前胶片工作流；导入已逐行校验，Photos/Albums 已隐藏，统计已改为胶片用户优先。`TagsManagement` 仍是未装配的 legacy 代码，不计入当前产品能力。
- 器材与记录：相机/镜头/胶卷采用推荐 + 手动 fallback；120 后背、共享后背、固定后背、卷级镜头、装载冲突和封面刷新恢复已完成并有测试覆盖。Gear 已拆为独立 Tabs、领域表单、共享封面编辑器和 `useGearActions`，持久化仍复用原 Dexie transaction、库存 RPC 与 SyncService 路径。
- 认证、会员与试用：Dev Bypass 已隔离到开发环境；注册、验证、登录、恢复密码和账号删除的前端流程，以及 RLS/private Storage、试用入口/限制、Upgrade Modal 和 Account Center 已完成。会员基础限制（active-roll 上限等）已在前端实现，但服务端权益写入安全 Gate（防止客户端自行改写 `tier`/`role`）尚未关闭，是支付接入前的共同前置条件，详见 [`CLD-07`](./CLOUD_TODO.md#cld-07-payment)。正式域 OAuth、密码策略和观测仍按 P1 保持未完成。
- UI 与 i18n：Landing、Settings、tab 偏好、响应式/CSS 收口、图片压缩和核心界面中英文已完成；本轮 Settings 密度与 Landing 品牌导航的窄屏细化已分别由 UI-12/UI-13 完成。PWA 更新提示和危险操作取消态测试已完成。架构文档仍需按最新同步、图片恢复和 Gear 拆分状态更新，不再将文档同步笼统标为完成。
- 同步与验证：Dexie transaction queue、500ms 防抖、明确提交立即同步、Realtime/fallback、队列失败恢复、Cloud DB migration 和双设备 smoke 已完成；库存 RPC 使用 operation outbox + 幂等 `operationId`，不再由 LWW 覆盖库存数。`lint`、同步相关测试与 `npm run build` 已通过；仅保留非阻塞 bundle chunk size warning。Cloud sync 仍由 `VITE_ENABLE_SUPABASE_SYNC` 控制。
- 邮件认证：Resend 发信域/发件人、真实注册与 recovery、900 秒 OTP、recovery intent、站内回跳 allowlist 已完成；正式 HTTPS、OAuth 和观测仍待完成。
- Cloud Storage：`grainfolio-assets` private、owner signed URL、跨用户拒绝、`delete_user()` 权限和 cascade 已验证；上传失败不会再把空图片 metadata 推到 Cloud。本地 blob 补上传、稳定对象路径、封面/关系原子提交、旧对象持久化清理与 Settings 修复入口已实现。剩余阻塞仅为真实 Cloud 双设备与 object/metadata 验收。
- 器材/胶卷履历：相机与胶卷卡片默认打开只读拍摄履历（总记录/进行中/已完成/涉及项目/未归入项目），编辑降为明确次级操作；聚合逻辑落在纯函数 `gearHistoryService`、共享 `rollCollectionGrouping`，并扩展现有 `filmInsightsService` 复用 Film Insights Drawer，不新增 Cloud schema。2026-08-29 全量基线为 `68 passed / 3 skipped` 文件、`304 passed / 5 skipped` 测试，lint/build 通过；真实浏览器手工验证了创建相机/胶卷/拍摄记录、履历统计、项目分组与未归入项目、点击记录复用现有 Roll Drawer（`/rolls?tab=all&openRoll=<id>`）等桌面端全链路，并修复了一个连带发现的窄屏工具栏/空状态留白回归。键盘 Enter/Space 激活由组件测试覆盖，未能在本地浏览器自动化中逐项人工复核（工具对合成键盘事件的限制）。
- 业务详情 URL 与浏览器导航语义收口（P1.5）：拍摄记录 Drawer、项目集详情、器材编辑 Modal（相机/镜头/胶卷/其他器材）三阶段全部完成，`tab`/`openRoll`/`collectionId`/`edit` 均以 URL 为唯一真源，History push/replace 规则在三个阶段间保持同构。Gear 的 `subTab` 已改为每次 render 直接从 URL 派生（不再是仅挂载时读取一次的 `useState`），并补齐了非法/隐藏 tab 的 canonicalize（含清理不再匹配的 `edit`）。详细测试清单与已知的既有 flaky 用例说明见下方 P1.5 阶段 3 完成情况；`npx tsc -b`、`npm run lint`、`npm run build` 通过。

## Next Up

按此顺序实施；下方各任务保留实现细节和验收标准。

1. **P1 图片完整性 Cloud 收口：** 代码与本地测试已完成；补真实 Cloud 跨设备显示、失败重试和 object/metadata 对照验证。
2. **P1 公开环境安全：** 正式域 Auth/邮件验收、密码策略与恢复链路、最小错误观测。
3. **P1 Activation + Hero Archive：** 按单功能循环依次完成历史导入激活、Camera Passport、Roll Passport、Quick Capture、Photography Inbox 和 Year in Film 视觉原型；分别见 [`UI-23`](./UI_UX_TODO.md#ui-history-import-onboarding) 至 [`UI-27`](./UI_UX_TODO.md#ui-photography-inbox) 及 [`UI-30`](./UI_UX_TODO.md#ui-year-in-film-prototype)，不得一次打包重写。
4. **P2 Archive Depth：** 继续 Dashboard/报告/花费职责和胶卷洞察；P1.5 项目集导航后升级 Project Workspace，再实现 Contact Sheet、Archive Completeness、Film Guide/个人经验、分享卡片、Year in Film 和冲扫状态时间线。Auth、Compare、Insights 降噪已完成，不再列入 Next Up。
5. **P3 商业化：** 先确认“核心本地功能永久免费、Pro 承担持续 Cloud 成本”的 entitlement 合同、图片配额与 `MON-01` 转化时机，再接自动支付 webhook；公开分享链接晚于本地导出卡片。
6. **P4 发布与条件任务：** Cloudflare 部署、Worker、bundle、命名迁移、机会型模块抽取与长尾 i18n；只在前置条件满足时开始。

P1 器材与胶卷拍摄履历（原 Next Up 第 1 项）已完成，详见下方 P1 小节与已完成摘要，不再占用 Next Up 排位。
P1.5 业务详情 URL 与浏览器导航语义收口（原 Next Up 第 3 项）三个阶段已全部完成，详见下方 P1.5 小节，不再占用 Next Up 排位。

## P1：器材履历与产品激活

- [x] **从相机/胶卷追溯拍摄记录与项目集（已完成，2026-08-29）**
  - 产品目标：器材库不只保存拥有的设备和库存，还能回答“这台相机拍过什么”和“这款胶卷参与过哪些拍摄”。相机与胶卷详情必须同时覆盖具体拍摄记录（Roll/Shooting record）和由这些记录归纳出的项目集（Collection/Project）；没有 `collectionId` 的记录统一进入“未归入项目”，不得被遗漏。
  - 当前数据已经足够，本任务不新增 Dexie store、Supabase table 或关系表：
    - 相机履历使用 `roll.cameraIds?.includes(camera.id)`，保留一卷多机身和换机历史；`currentCameraId` 只代表当前/最终机身，禁止单独用它推导完整历史。
    - 胶卷履历使用 `roll.filmStockId === filmStock.id`；`digital-placeholder` 和未登记库存不算某条胶卷库存记录。禁止用品牌/名称模糊匹配，避免把同名但不同批次、价格或库存来源合并。
    - 项目集由命中的 Roll 的 `collectionId` 去重并关联当前用户的 Collection；项目内至少有一条命中 Roll 才显示。已删除、其他用户或当前用户不可见的数据不得参与统计。
  - 相机入口：相机卡片的默认详情语义逐步从“直接编辑”调整为“查看相机详情/拍摄履历”，编辑保留为明确次级操作。详情展示相机资料、总使用记录数、进行中/已完成数、涉及项目数、最近使用时间、项目集列表和未归入项目记录；点击项目或记录继续复用现有 Collection/Roll 详情能力。
  - 胶卷入口：胶卷卡片提供明确的“拍摄履历/查看使用”入口，库存 `+/-`、编辑和封面操作保持独立。详情不另造一套统计页面，而是复用并扩展现有 `Film Insights` 聚合与 Drawer，增加项目集分组、未归入项目、进行中和已完成记录。
  - 信息层级：默认先回答“拍过多少、最近拍什么、在哪些项目中使用”，库存数量、购入价格和技术资料作为次级上下文。空状态应明确显示“还没有使用这台相机/这条胶卷库存创建拍摄记录”，并提供创建拍摄记录入口；不得显示商店式库存预警。
  - 架构边界：
    - 抽取或扩展纯聚合 service，以一次遍历 Roll 的方式生成相机/胶卷履历和 Collection 分组；不要在每张卡片 render 中重复 `filter/find/sort`。
    - 复用现有 `FilmInsightsView`、Roll Drawer、Collection 详情、`useGearActions` 和 Dexie live data；不得把保存、库存 delta/RPC、图片上传或同步逻辑搬回展示组件。
    - 本阶段不解决“同型号多条 FilmStock 合并”。未来若需要跨批次查看所有 Kodak Gold 200，应引入稳定 `catalogId` 或规范化型号身份，禁止依靠大小写或字符串相似度猜测。
    - 此任务可在 `VITE_ENABLE_SUPABASE_SYNC=false` 下实现和验收；不得因为新增只读履历入口而触碰 RLS、Storage 或 Cloud migration。
  - 导航边界：本任务先完成可用的详情与跳转，不顺手重写全部 Gear 路由。涉及详情 URL、刷新恢复和浏览器 Back 时必须遵守下方 P1.5 的 URL 单一真源与 History 规则；如果复用尚未 URL 化的 Collection/Gear Modal，不得在本任务创建另一套冲突参数。
  - 自动测试：
    - service 单测覆盖一卷多相机、换机历史、同相机多项目、同胶卷多项目、未归入项目、进行中/已完成、数字占位、未登记库存、软删除、跨用户隔离与同名 FilmStock 不合并。
    - UI 测试覆盖相机和胶卷入口、统计数字、项目分组、空状态、打开指定 Roll/Collection、编辑与库存按钮不被卡片点击吞掉、键盘操作和中英文长文案。
    - 回归必须保证 Film Insights 现有排序/Drawer、Gear 新建编辑、库存原子 delta、120 后背、Roll 相机转移和封面处理不变。
    - 完成 focused tests 后运行全量 Vitest、`npm run lint`、`npm run build`，并在桌面与移动宽度手工验证；详细视觉与交互验收见 [`UI-18`](./UI_UX_TODO.md#ui-gear-shoot-history)。
  - **完成情况（2026-08-29）：** 相机/胶卷卡片默认打开只读履历 Drawer，编辑降为次级操作；胶卷履历扩展现有 `FilmInsightsView` Drawer，未新建第二套报告页。真实浏览器手工验证桌面端全链路（创建相机/胶卷/拍摄记录 -> 履历统计 -> 项目分组/未归入项目 -> 点记录复用既有 Roll Drawer 深链接）；窄屏（320-768px）经修复后无横向溢出、无异常留白。全量 `68 passed / 3 skipped` 文件、`304 passed / 5 skipped` 测试，`lint`/`build` 通过。键盘 Enter/Space 由组件测试覆盖，未在真实浏览器逐项复核（自动化工具对合成键盘事件的已知限制，不影响原生 `<button>` 语义保证）；项目详情跳转目前仍只到 Collections 列表页，精确定位需 P1.5 阶段 2。

- [ ] **试用数据迁移被跳过时的用户提示（Ready）**
  - 现状（已核对代码）：`migrateTrialDataToUser()`（`frontend/src/services/trialDataMigration.ts`）在试用用户注册/登录到一个已有数据的账号时会返回 `target-has-data` 并跳过合并，本地试用记录不会归并进新账号；调用方 `AuthContext.tsx:143-145` 目前只写 `console.info`，界面上没有任何提示。用户可能误以为试用期间记录的数据丢失。
  - 只需给这一条已存在的返回值补一个用户可见的反馈（复用现有 Toast/Feedback 机制），说明"检测到该账号已有数据，本次试用记录未自动合并"，不需要新增数据迁移逻辑或改变当前"目标账号已有数据则不合并"的既定行为。
  - 不在本任务扩大范围去设计"手动选择合并/覆盖"的交互；如果后续需要，另开任务并先确认数据合同。

- [ ] **Existing History Import：把现有 Excel 导入升级为新用户激活流程（Ready after P1.5）**
  - 复用现有类型化 Excel parser、行级校验和 Dexie transaction，增加官方模板、字段映射、预览、重复处理选择、导入报告和确定性的导入后摘要；不接 Notion/Google Sheets API，不用 AI 猜列，不允许跨用户导入。
  - 第一阶段只保证提交前预览和 transaction 失败整体回滚；若要支持导入成功后的“一键撤销”，必须先确认 import batch 数据合同，不能用名称或时间范围猜测并删除用户已有资料。
  - 导入后的即时回报既是数据报告，也是首次档案价值呈现：只用真实可计算数据生成克制的“Instant Archive”摘要，例如导入记录数、明确日期范围、实际使用最多的相机/胶卷及其次数；数据不足时降级为事实性回报。不得显示尚无数据基础的 frames、虚构 Passport 指标或摄影人格。完整入口、状态和测试见 [`UI-23`](./UI_UX_TODO.md#ui-history-import-onboarding)。

- [ ] **Camera Passport Hero Experience（Ready after UI-18 + P1.5 Gear URL）**
  - 将相机履历升级为长期档案对象，展示一起使用时间、实际参与的拍摄记录/项目、常用胶卷/镜头/后背、地点、时间线与可解释花费；编辑相机保持明确次级动作。
  - 第一阶段完全由现有当前用户数据推导，不新增 Cloud schema，不显示无法可靠计算的 frame count；分享卡片晚于 UI-08，本阶段保持私密。聚合定义、缺失数据、响应式和测试见 [`UI-24`](./UI_UX_TODO.md#ui-camera-passport)。

- [ ] **Roll Passport / Roll History（Ready after P1.5 Roll URL）**
  - 把现有拍摄记录 Drawer 从编辑表单提升为可回顾的单卷档案：相机/换机、镜头、后背、胶卷、时间地点、项目、费用、封面、冲扫状态和笔记按时间与语义组织。
  - 详情仍以 `/rolls?tab=all&openRoll=<id>` 为唯一真源；编辑、完成和归档是明确操作，不在 Passport render 中写 Cloud。Contact Sheet 与完整分享输出作为后续增强，详见 [`UI-25`](./UI_UX_TODO.md#ui-roll-passport)。

- [ ] **Quick Capture：Start / Finish Roll 的低摩擦移动流程（Ready after Roll Passport）**
  - 默认只要求完成一次拍摄所需的最少字段；镜头、EI、项目、地点、费用、后背和备注按物理约束及用户选择渐进展开。保存必须继续走现有 Dexie transaction、库存 operation outbox 和即时异步 sync，不建立第二套写入路径。
  - 本阶段不实现逐帧日志；`Add Frame` 只在 Contact Sheet/帧模型明确后再启用。完整点击预算、默认值、离线与测试合同见 [`UI-26`](./UI_UX_TODO.md#ui-quick-capture)。

- [ ] **Photography Inbox：让 Dashboard 给出清晰的下一步（Ready after state contract）**
  - 从真实状态推导拍摄中、待冲洗、待扫描、待归档和资料待补充的分组；每条提示必须可直接进入对应 Roll Passport 或编辑入口，并允许用户忽略可选资料。
  - 在 UI-22 生命周期字段实现前，只显示当前 schema 能可靠回答的分组；不得从 `active/archived` 猜造“已送洗/已扫描”。完整派生规则、空状态和测试见 [`UI-27`](./UI_UX_TODO.md#ui-photography-inbox)。

- [ ] **Year in Film Visual Prototype（Ready after Camera Passport；非生产功能）**
  - 使用 mock data 和当前可用字段先确定 9:16 story sequence、指标口径、视觉语言、动效与分享裁切安全区；目的在于反向确认未来真正需要的数据，不在本阶段增加 route、数据库、Cloud 写入或付费限制。
  - 原型必须同时展示数据充足、稀疏和无逐帧数据三种状态；禁止用假 frame 指标掩盖 schema 缺口。通过用户反馈确认故事顺序后，才进入现有 UI-21 的 production implementation；详见 [`UI-30`](./UI_UX_TODO.md#ui-year-in-film-prototype)。
  - **Decision required（执行时机）：** 本原型只需 mock data 即可运行，对 Camera Passport 没有硬技术依赖；排在其后主要是为了复用已确定的档案视觉语言，不是数据或路由依赖。若判断 PMF 信号比视觉一致性更紧急，可由用户决定把本任务提前到与 P1.5/Camera Passport 并行甚至更早启动，直接服务下方 Closed Beta Gate 的早期验证目标。Agent 不得自行改变 Next Up 顺序；一旦用户决定提前，需同步更新本条与 [`UI-30`](./UI_UX_TODO.md#ui-year-in-film-prototype) 的实际执行顺序说明。

- [ ] **Closed Beta / PMF 验证 Gate（Decision required；在核心原型可用后）**
  - 目标用户锁定 `gear-oriented × archive-oriented film photographers`，优先邀请多机身、中画幅、长期记录或已有 Excel/Notes/Notion 历史的摄影师，不以泛摄影用户或广告流量代替产品验证。
  - 用 Existing History Import、Camera Passport、Quick Capture、Contact Sheet/Year prototype 与 Cost Summary 分别测试 activation、habit、archive、distribution 和 secondary differentiation；记录用户是否自然询问历史导入、分享、中画幅后背、成本与长期保存，而不是只收集“看起来不错”。
  - 获客内容优先展示档案产物，不宣传数据库和同步技术；渠道可从 Reddit、Instagram、小红书的小规模人工 outreach 开始。不得自动抓取社区、批量私信或在没有同意时上传用户内容。
  - 关闭 Gate 前定义并记录：邀请数、成功导入率、首个 Passport 生成率、7/30 日回访、每周新增记录、分享意愿、Cloud/Pro 意愿和最常见阻塞。指标只用于产品判断，不在产品内建立公开排行榜。

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
  - Deferred metadata 防护、历史 blob 补上传、稳定 object key、封面与 `coverPhotoId` 原子提交、旧封面清理重试、Settings 入口及组件失败测试均已通过本地回归；真实 Cloud 完整验收见 [`CLD-01`](./CLOUD_TODO.md#cld-01-photo-integrity)。

- [ ] **Cloud Storage 图片完整性最终验证**
  - 完成跨设备 signed URL、object/metadata 对照、失败重试和重复对象保护；Cloud 步骤见 [`CLD-01`](./CLOUD_TODO.md#cld-01-photo-integrity)，界面验收见 [`UI-02`](./UI_UX_TODO.md#ui-cloud-photo-recovery)。此项关闭后，才可开始为封面图新增可同步的焦点位置元数据；不得并行实施 [`UI-11`](./UI_UX_TODO.md#ui-cover-focal-point)。

- [ ] **Free / Pro entitlement 产品合同（P3，支付前；Decision required）**
  - 目标方案是永久免费保留核心 local-first 记录能力，Pro 解锁持续产生服务成本的 Cloud Sync、跨设备恢复、较高图片配额、整卷扫描、批量能力和高级报告；试用结束只能降回免费层，不能锁住或删除用户本地资料。
  - 需要先审计当前 Trial 的“一类一条”限制、现有会员上限和 Upgrade Modal，再决定迁移方式、14 天可选 Pro 试用、取消订阅 grace/export 行为及各 entitlement 的服务端权威来源；详细 Cloud 合同见 [`CLD-07`](./CLOUD_TODO.md#cld-07-payment)。

- [ ] **MON-01 Pro Conversion Moments（P3；Ready after Free / Pro contract）**
  - 产品目标：只在用户已经体验到个人档案价值、并主动请求一项有持续成本或高级产出的能力时解释 Pro；不在注册、空 Dashboard、第一次创建资料或普通本地记录流程中弹泛化 Upgrade。
  - 固定转化入口为 Cloud Sync / Cloud Backup、Cloud Storage、Year in Film 的高级历史比较与 HD/高级导出、Public Project 分享，以及克制的 Archive Protection 提示。Free 必须先可见真实基础产出；Pro 是清楚标出的扩展，不得用模糊遮罩或恐惧文案诱导付款。
  - 页面与状态、preview/locked 行为、文案、关闭冷却、无障碍和测试见 [`UI-31`](./UI_UX_TODO.md#ui-pro-conversion-moments)；可信 entitlement、Checkout、服务端拒绝与 webhook 边界见 [`CLD-07`](./CLOUD_TODO.md#cld-07-payment)。任何一个入口实现不得绕过另一处合同。

- [ ] **云端图片/存储配额策略（P3；Decision required）**
  - 在 Free / Pro entitlement 合同确认后，明确 regular/vip 配额、可信 Cloud 判定、超额行为与对象清理策略；详见 [`CLD-06`](./CLOUD_TODO.md#cld-06-storage-quota)。

- [ ] **Supabase legacy schema / backfill 决策（公开部署或数据迁移前）**
  - 公开部署或破坏性迁移前决定 camera legacy 列、120 历史 backfill、profile revision 与命名兼容策略；详见 [`CLD-05`](./CLOUD_TODO.md#cld-05-schema-backfill)。

- [ ] **商业化自动支付闭环（P3）**
  - 从人工申请升级到 hosted checkout + 签名 webhook + 幂等 VIP 回写；provider、安全与测试矩阵见 [`CLD-07`](./CLOUD_TODO.md#cld-07-payment)。

## P1.5：导航可靠性与页面状态

- [x] **业务详情 URL 与浏览器导航语义收口**
  - 优先级与时机：P1.5，位于 P1 Cloud 图片/公开环境安全验收之后、P2 产品体验之前。严格按 `拍摄记录 Drawer -> 项目集详情 -> 器材编辑 Modal` 三个独立阶段实施；每个阶段单独修改、测试和验收，不一次重构全部页面。
  - 当前事实：
    - 拍摄记录 Drawer 阶段已完成：`?tab=all&openRoll=<id>` 由 `RollsView` 派生详情，刷新可以恢复，列表打开使用 history entry，浏览器后退可以关闭 Drawer；相关 focused tests 和 Dashboard E2E 已更新。
    - 项目集详情阶段已完成：`?tab=collections&collectionId=<id>` 由 `RollsView` 派生详情，刷新可以恢复，列表打开使用 history entry，浏览器后退可以关闭详情并保留 PageTabs 可见；相关 focused tests 和新增 E2E 已覆盖。
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
  - 阶段 2：项目集详情（已完成，2026-08-29）
    1. `activeCollectionId` 已改为从 `collectionId` query 派生（`RollsView.tsx`），并保持 `tab=collections`；列表点击使用 `push`（`openCollectionDetail`），返回箭头、浏览器后退（`closeCollectionDetail`）和刷新遵循统一 History 规则，与阶段 1 的 `openRollDrawer`/`closeRollDrawer` 完全同构。
    2. 项目集详情打开时 PageTabs 与工具栏保持挂载（不再是与 library-view 互斥的顶层分支，而是 `collections` tab 面板内部的二选一渲染）；返回动作只关闭详情，不把用户送出 `/rolls`。
    3. Canonicalize 合并进阶段 1 已有的单一 effect（未开第二个竞争 effect）：`collectionId` 缺 `tab` 时补齐是同步分支；`collectionId` 是否属于当前用户/项目集功能是否开启是异步分支，通过一次性 `db.collections.get()` 校验，避免 `useCollections()` 首次渲染返回空数组时把有效 ID 误判为无效。删除 Collection 与清空关联 `Roll.collectionId` 已改为同一个 `db.transaction`。
    4. Gear 侧的 `CameraHistoryDrawer`/`FilmUsageDetailDrawer`「进入完整项目」已改为携带 `collectionId` 精确跳转到该项目详情，不再只能进入 Collections 列表页（此前 UI-18 手动测试发现的已知限制，本阶段解决）。
    5. 修复代码审查发现的两处遗漏：详情内切换到「全部拍摄记录/独立记录」或在搜索框输入触发的 tab 自动切换，此前只改 `libraryView` 不清 URL 的 `collectionId`，刷新会把用户拉回已离开的项目详情——现由统一的 `handleLibraryViewChange` 在离开 `collections` tab 时一并清理。设置关闭 Collections 时的 canonicalize 清理此前硬编码回退到 `tab=collections`（该 tab 已不可见）——现按 `isCollectionsTabVisible` 回退到第一个实际可见的 tab。
    6. 验证：`RollsView.tabs.test.tsx` 新增 5 个 focused test（开卡片/URL同步/PageTabs可见/Back关闭、非法及跨用户 collectionId 深链接清理、切 tab/搜索离开时清理 collectionId、设置关闭 Collections 时回退到可见 tab），新增 `e2e/collection-deep-link.spec.ts`（Chromium 真实浏览器，覆盖开卡片、刷新恢复、Back 关闭、非法深链接清理）。全量 Vitest `309 passed / 5 skipped`，`npm run lint`、`npm run build` 均通过。移动端行为通过既有 `.has-active-collection` CSS 类切换规则静态复核（本阶段未改动该规则，仅改变其挂载位置的 state 来源），未逐项人工复核真实移动设备。
    7. 顺带修复一处连带发现的问题：Collections 网格卡片封面（`.roll-card-cover`）此前 `z-index` 高于卡片自身的无障碍「打开」按钮，导致精确点击/自动化按可访问名称点击会被封面拦截（鼠标用户不受影响，因为外层卡片的 onClick 仍会通过事件冒泡触发）；已加 `.collection-card .roll-card-cover { z-index: 0; }` 精确修正，不影响拍摄记录卡片封面本身需要更高层级以容纳上传/预览按钮的既有逻辑。同时给 `playwright.config.ts` 固定了 `locale: 'zh-CN'`，此前套件的中/英文断言完全依赖宿主机默认语言，不是确定性的。
    8. 修复 `e2e/dashboard.spec.ts` 两处与本阶段无关的既有测试缺陷：「库存胶卷分组」按格式/彩黑分列的断言对应的 UI 元素已随 Insights 降噪一并移除（当前只剩单一聚合数字），种子数据本身未变（135 共 11 卷、彩色 8/黑白 3 计算依旧成立），断言已改为核对聚合后的「11 卷」；「keeps rolls tab and list layout after refresh」在从未点击「项目集」tab 的情况下就直接找「新建项目集」按钮（该按钮只在 `libraryView==='collections'` 时才会渲染成这个文案），且用 `role=button` 误选本应是 `role=tab` 的「全部拍摄记录」——均已修正。`npx playwright test e2e/dashboard.spec.ts` 4/4 通过。
  - 阶段 3：器材编辑 Modal（已完成，2026-08-29）
    1. `tab` 决定实体表，`edit` 决定当前记录；只从对应当前用户数据集中解析实体，禁止在四张表间用同一个 ID 盲查或猜类型。
    2. 相机、镜头、胶卷、其他器材卡片打开编辑时写入 canonical URL；刷新恢复相同编辑 Modal，后退关闭并返回原 tab。新建入口继续兼容现有 query，除非另开任务统一创建 URL，不在本阶段顺手改名。
    3. 继续复用已拆分的领域表单、`useGearActions`、库存 delta operation 和 `GearAvatarEditor`；不得把保存逻辑搬回 `GearView`，也不得为路由改造重写 120 系统/后背模型。
    4. 本阶段不实现表单草稿持久化。刷新时只恢复“正在编辑哪条记录”及该记录最后已保存的数据；未提交输入是否需要离开确认，必须另行产品确认，不能宣称自动恢复。
    5. **完成情况：** `GearView.tsx` 的 `subTab` 由 `useState` 改为每次 render 直接从 `tab` query 派生（不再是"仅挂载时读取一次"），`edit` 按当前 `tab` 派生 `editingCameraId/editingLensId/editingFilmId/editingEquipmentId`，对已按 `userId` 过滤的 `useCameras()`/`useLenses()`/`useFilmStocks()`/`useOtherEquipments()` 数组 `find`，天然满足"非法 tab/跨用户/已删除记录不打开 Modal"。新增共享 `openGearEditModal`/`closeGearEditModal`，History 语义与阶段 1/2 的 `openRollDrawer`/`closeRollDrawer` 同构。canonicalize effect 区分"tab 缺失"（补 tab、保留 `edit`）与"tab 非法或被 `enableFilmMode` 隐藏"（改 tab 且清空 `edit`，避免 ID 被跨实体误解析）两种情况；切 tab 一律 `replace` 写入 URL 并清空 `edit`，不再要求"仅当有编辑中的 Modal 才写 URL"。
    6. **发现并修复的实现期 bug：** 四个 Modal 原本用独立计数器驱动 `key` 强制重挂载表单；点击"编辑"时该计数器与 `navigate()` 触发的 URL 更新不在同一次 render 落地，导致新挂载的表单在 `editingCamera` 还是 `null` 的那一帧完成挂载，其内部 `useState(editingCamera?.id)` 被永久锁死为"新建"模式。修复为 `key` 直接绑定 `editingXxx.id`，保证 key 变化与数据同一次 render 到达。
    7. **验证：** `frontend/src/views/Gear/__tests__/GearView.urls.test.tsx`（15 个 focused test）分别对相机/镜头/胶卷/其他器材各自验证深链接打开；错 tab、不存在 ID、跨用户 ID 不打开 Modal；列表点击 push 更新 URL 且在**卸载后**以该 URL 重新挂载（模拟真实刷新）能恢复同一 Modal；无来源标记的深链接点取消会 replace 到 canonical URL；**从列表 push 打开后点取消**会正确 `navigate(-1)` 回到该 tab 自己的 URL 且不残留 `edit`；切 tab 在有/无编辑 Modal 时都会清空 `edit` 并 `replace` 新 tab；`tab` 缺失（保留 `edit`）、`tab` 合法但被 `enableFilmMode` 隐藏（清空 `edit`）、`tab` 是完全非法字符串（同样清空 `edit`）三种 canonicalize 分支分别有独立用例。`frontend/e2e/gear-edit-deep-link.spec.ts`（4 个 Chromium 真实浏览器用例）覆盖四类实体各自的列表打开、URL 更新、取消后 URL 回到该 tab 的 canonical 地址，相机额外覆盖刷新恢复与真实浏览器 Back。这是第二轮外部 review 后补齐的版本——第一版的单测标题声称"覆盖四类实体深链接"但只测了相机、"刷新恢复"测试未卸载首次挂载的实例、没有测"列表 push 打开后取消"这条路径的 URL 结果、E2E 缺胶卷代表路径且没有非法 tab 字符串用例，均已在这版修正。
    8. **测试稳定性说明：** `npx tsc -b`、`npm run lint`、`npm run build` 均通过；`GearView.urls.test.tsx` 单独运行、`gear-edit-deep-link.spec.ts` 单独运行均多次 100% 通过。全量 `npm run test` 反复运行时，本任务新增的用例本身没有失败记录，但整个仓库的全量跑法存在一个已知的、与本任务无关的偶发失败——`RollsView.tabs.test.tsx`「falls back to the first visible tab, not tab=collections, when Collections is disabled while viewing a project detail」在并行跑测试时偶尔报 `act()` 警告并超时，单独运行 100% 通过；这是 P1.5 阶段 2 遗留的既有 flaky 用例，不是本次改动引入的回归。因此"全量 Vitest 多少条通过"不作为可反复复现的确定性事实写死，以"新增用例在隔离运行下稳定通过"为准。发现并另开任务修复了一处与本任务无关的既有测试缺陷（`e2e/gear-builder.spec.ts` 用 `role=button` 误查已经改成 `role=tab` 的胶卷标签页按钮，以及两处过期的表单文案断言）。
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

- [x] **Settings 设置项密度与窄屏布局收口**
  - 已按控件类型拆分手机布局，并改为依据 Settings 分组的实际容器宽度响应；Language 在容器宽于 `360px` 时保持同排，极窄屏才换行，Film workflow toggle 固定保留完整 `40px` 宽度。Settings focused test、`320 / 375 / 390 / 430 / 540 / 568 / 600 / 620 / 768 / 1024px` E2E、lint 和 build 已验证；完整根因与回归契约见 [`UI-12`](./UI_UX_TODO.md#ui-settings-responsive-density)。

- [x] **Landing 品牌 Logo 与导航响应式防重叠**
  - 已建立 `<=768px` 的导航优先级、`<=560px` 的 wordmark 降级和 solid Logo surface，保留语言/登录/注册语义；`320 / 375 / 390 / 430 / 480 / 540 / 640 / 768 / 1024 / 1280 / 1440px` Landing E2E 已验证无横向溢出及品牌/操作区重叠，详细契约见 [`UI-13`](./UI_UX_TODO.md#ui-landing-brand-navigation)。

- [ ] **Landing / Onboarding Private-first 信任叙事文案（P2；无依赖，可随时实施）**
  - 把“本地优先、数据归你所有”从内部架构原则升级为对外可见的信任承诺；只新增/调整双语文案与展示位置，不改变现有 Dexie-first 架构、不新增设置项或开关。详细文案内容、位置边界与验收见 [`UI-32`](./UI_UX_TODO.md#ui-landing-privacy-narrative)。

- [x] **公开认证页主题与品牌层级收口**
  - 无已保存主题时，公开 Auth 默认使用与 Landing 连续的深色外观且不写入用户偏好；已有 Light/Dark/System 继续优先。认证页已收敛为单一 wordmark，移除 compact mark、渐变灯箱与光晕。Auth 组件测试 `27 passed`、Auth E2E `7 passed`、lint 和 build 已通过；详细契约见 [`UI-14`](./UI_UX_TODO.md#ui-auth-theme-branding)。

- [x] **桌面 Sidebar 密度与折叠控制对齐**
  - 展开 Sidebar 已由 `260px` 收敛为 `240px`，品牌、主导航、账号/设置与折叠控制使用统一水平节奏；保留 `72px` 折叠栏并显式固定移动 Drawer 为 `280px`。折叠控制的可见文字和可访问名称会随状态同步更新；Sidebar 单元测试 `2 passed`、响应式 E2E `3 passed`、lint 和 build 已通过。详细契约见 [`UI-15`](./UI_UX_TODO.md#ui-sidebar-density-alignment)。

- [x] **Settings 拍摄记录布局行视觉对齐**
  - `Shooting record layout` 已改为图标与“标题 + 当前顺序”信息块居中对齐，移除独立 `62px` summary 缩进；窄容器只让 44px disclosure 按钮进入全宽下一行，图标与标题始终保持横排。折叠、排序和持久化逻辑未改变；组件测试 `7 passed`、10 个响应宽度 E2E、lint 和 build 已通过。详细契约见 [`UI-16`](./UI_UX_TODO.md#ui-settings-disclosure-alignment)。

- [x] **拍摄记录封面清晰度与竖图显示源收口**
  - 拍摄记录卡片现仅在封面进入视口附近时解析高质量源，本地 1920px Blob 优先于 Cloud signed URL，400px thumbnail 只承担渐进占位与失败回退。卡片改为 lazy/async 语义图片并保持 `cover`，详情与完整预览使用同一高质量源且完整预览保持 `contain`；Blob URL 会在取消或卸载时清理。完整单元测试 `271 passed / 5 skipped`、2:3 竖图刷新 E2E、lint 和 build 已通过；焦点位置仍由后续 UI-11 处理。详细契约见 [`UI-17`](./UI_UX_TODO.md#ui-roll-cover-rendition)。

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

- [ ] **项目集摘要卡片与详情工作台（P1.5 项目集导航后）**
  - 产品目标：Collection 不再只是“大封面 + 拍摄记录列表”，而应快速回答项目拍了多久、包含多少记录、使用了哪些主要相机/胶卷、去了哪些地点以及最近拍了什么。列表卡片提供可扫描摘要，进入后形成轻量 Project Workspace；不扩张为任务管理、协作或复杂项目管理系统。
  - 第一阶段不新增 Dexie/Supabase 字段：日期范围由关联 Roll 最早 `startDate` 与最晚 `endDate` 推导，缺失时回退 `collection.date`；进行中/完成数来自 `status`；相机、镜头、胶卷和地点从当前用户、未删除的关联 Roll 精确去重；最近拍摄以明确拍摄日期计算，不用缺失或不可靠的更新时间猜测。
  - 列表卡片：Grid/List 共享相同信息语义，只改变排列。封面或最多四张 Roll 封面拼贴缩为辅助区域；主层级为项目名、描述摘要、日期范围、总记录/进行中/完成数量，并展示按参与记录数排序的主要相机、胶卷和地点，超出使用 `+N`，禁止把全部长名称塞入卡片。
  - 详情工作台：顶部使用紧凑项目头部，不以大 Hero 图占满首屏；展示名称、描述/拍摄意图、日期范围和编辑入口。摘要区展示拍摄记录、进行中/完成、相机、胶卷与地点；其后展示主要器材/胶卷 chips，以及按状态和日期组织的拍摄记录。现有添加记录、创建记录、移出项目、编辑和删除能力必须保留。
  - 导航依赖：必须先完成 P1.5 阶段 2，让 `/rolls?tab=collections&collectionId=<id>` 成为项目详情唯一真源并具备刷新/Back 语义；本任务只升级呈现和聚合，不再维护第二套 `activeCollectionId` 状态或另造详情路由。
  - 架构边界：抽取纯 `collectionWorkspaceService` 或等价聚合函数，一次遍历关联 Roll 生成摘要和分组，组件不在每次 render 中重复 `filter/find/sort`。继续复用 Collection、Roll、Camera、Lens、FilmStock、PhotoAsset、Roll Drawer 和现有封面 URL 链路；不触碰库存 RPC、同步协议、Storage、120 后背或相机转移模型。
  - 后续边界：Contact Sheet 完成后，Project Workspace 可以只汇总每条记录的一张代表帧或进入对应卷的底片索引页，不直接加载项目中全部原图。项目状态、章节、目标、标签、协作成员和自定义封面策略需要新增字段时必须另行确认，不包含在第一阶段。
  - UI、响应式、无障碍、聚合规则和测试契约见 [`UI-20`](./UI_UX_TODO.md#ui-collection-workspace)。完成 service/组件测试、关键 URL E2E、相关回归、lint/build 和桌面/移动手工 smoke 后才能标记完成。

- [ ] **拍摄记录底片索引页（Contact Sheet）**
  - 产品边界：在每条拍摄记录内部排列用户上传的成品扫描照片，模拟传统底片袋/灯箱上的胶片条、齿孔、帧号和上下边印；照片保持用户上传的颜色、比例和内容，不做负片反转、调色、自动裁切或扫描转换，也不恢复全局 Photos/Albums。
  - 视觉身份：进入底片索引时形成局部“暗房检查台”，使用黑色/深炭工作台、档案标签、透明底片袋和底部柔和灯箱透光建立 `archival label / museum catalog / negative sleeve / light table` 语言；这是 Contact Sheet 的功能性局部背景，不改变全站主题，不给原图加滤镜，也不使用泛化的渐变或循环光效。
  - 胶片关联：默认从该拍摄记录精确关联的 `filmStockId` 读取品牌、型号和画幅，选择对应边印预设；不得用名称相似度把不同 FilmStock 合并。没有关联胶卷、未登记库存或找不到预设时使用清晰的 Generic 135/120 外观，并允许用户后续手动选择或编辑边印。
  - 初始预设先复用现有 `COMMON_FILM_STOCKS` 可搜索目录，并为 Kodak、Fujifilm、Ilford、CineStill、Lomography、ORWO、Foma、Rollei、Shanghai、Lucky 建立品牌级 fallback；优先补 Portra、Gold、ColorPlus、Ultramax、Ektar、Tri-X、T-Max、Fujicolor、Superia、Pro 400H、Acros、Provia、Velvia、HP5 Plus、FP4 Plus、Delta、50D/400D/800T 等常用型号覆盖。预设是视觉模拟，不宣称复刻特定批次、DX 码或历史实物；精确/特殊版本由用户后续手动补充。
  - 实施顺序严格分为四个单功能阶段：
    1. 只读索引页与预设解析：复用 Roll 下现有 `PhotoAsset`、`orderIndex`、`coverPhotoId` 和缩略图读取链路，完成 135/120 响应式版式、品牌/型号预设搜索与 Generic fallback；不新增上传服务或 Cloud provider。
    2. 卷内多图导入与排序：一次选择多张成品扫描图，本地压缩/缩略图后立即进入当前 Roll；支持拖动排序、帧号和选为封面，继续走现有 deferred upload/photo recovery，不把整页扁平化为一张图片。
    3. 非破坏显示设置：允许为当前 Roll 覆盖预设、编辑自定义边印文字和选择克制的底片袋/灯箱外观；显示设置与用户图片分离，不能修改源文件。若需要跨设备保存，再以可选 Roll 设置和最小 PhotoAsset 帧字段设计 Dexie/Supabase parity migration，不提前创建独立照片库或复杂模板系统。
    4. Cloud 与容量：当前 Supabase private Storage 路径先保持可用；只有整卷原图成为真实需求且完成容量/成本验证后，才评估 `Supabase Auth/Postgres + private R2 media`。浏览器不得持有 R2 secret，Cloud 边界、配额和对象清理按 [`CLD-06`](./CLOUD_TODO.md#cld-06-storage-quota) 单独验收。
  - 架构约束：边印预设作为独立、类型化的展示 catalog，不把装饰字段塞进 `FilmStock` 库存实体；匹配优先使用稳定 preset identity，现阶段没有 `catalogId` 时只能做可撤销的 UI 建议，禁止把规范化字符串当作永久关系。Contact Sheet 由独立 frame 缩略图实时排版，原图只在用户打开单帧时按需读取。
  - UI、响应式、无障碍、性能、测试和品牌边印契约详见 [`UI-19`](./UI_UX_TODO.md#ui-roll-contact-sheet)。四个阶段分别完成 focused tests、相关回归、lint/build 和手工 smoke；不得只完成静态视觉后就将整项标记完成。

- [ ] **外部来源图片导入：本地设备 / 手机拍照 / Google Drive / OneDrive（Decision required；Ready after UI-19 阶段 2）**
  - 本地文件选择与手机现场拍照已随标准文件选择控件天然具备，不需要额外开发；真正的新工作是接入 Google Drive（Google Picker API）和 OneDrive（OneDrive File Picker SDK）作为可选图片来源，需要用户先决定是否值得引入对应 OAuth 第三方依赖与运维成本。
  - 网盘选择器只用于一次性挑选文件，选中后立即复用现有 UI-19/PhotoAsset 压缩、Dexie transaction 和 Cloud upload 路径；不做双向同步、不二次保存网盘 fileId、不把网盘变成第二个存储后端。完整产品边界、安全边界（OAuth client 配置、no secret in browser）、交互和测试见 [`UI-33`](./UI_UX_TODO.md#ui-external-photo-sources)。

- [ ] **Archive Completeness：逐卷/逐项目的轻量归档完成感（Ready after UI-22 + UI-19 MVP）**
  - 只根据明确存在的拍摄、冲扫、费用、扫描和精选信息生成可解释 checklist；缺少可选资料不阻止归档，用户可以“保持现状并完成”。
  - 不做全账号完成率、不做连续签到或惩罚性提醒；默认文案使用“还可补充 / 接近归档”而不是“你的档案不完整”。第一阶段保持本地确定性派生，不新增 Cloud 字段；完整定义与测试见 [`UI-28`](./UI_UX_TODO.md#ui-archive-completeness)。

- [ ] **Film Library + Shooting Guide + Personal Knowledge（Ready after film insights role cleanup）**
  - 将现有常见胶卷 Catalog 与 Film Insights 升级为轻量知识层：`Character / Exposure Notes / Best For / Watch For` 使用审慎、非绝对化的编辑建议，并明确不是曝光或显影保证。
  - 用户自己的 EI、显影方式、评分、笔记和代表卷必须与编辑建议分开；第一阶段先展示现有数据能够推导的使用历史，新增 `exposureIndex`、个人经验持久化或稳定 catalog identity 前必须完成数据合同，不用品牌/型号字符串建立永久关系。
  - 不把知识页做成百科、店铺导购或冲扫店目录；内容来源、可编辑边界、空状态和测试见 [`UI-29`](./UI_UX_TODO.md#ui-film-guide-knowledge)，潜在 schema gate 见 [`CLD-11`](./CLOUD_TODO.md#cld-11-archive-product-gates)。

- [x] **Insights 图表信息降噪**
  - 低价值卡片、聚合、双语文案和零引用 CSS 已移除；详细基线见 [Insights 降噪](./UI_UX_TODO.md#ui-baseline-insights-cleanup)。

- [ ] **Insights 月度趋势时间范围切换**
  - 两个趋势图共用范围和聚合粒度；详细要求见 [`UI-06`](./UI_UX_TODO.md#ui-insights-range)。

- [x] **Compare 工作台复核**
  - 已保持两张本地照片 A/B 对照边界，并完成原生键盘文件入口、双语错误反馈、共享空态、主题 token、死 CSS 清理及 `320-1024px` 响应式验证；实现与验收见 [`UI-07`](./UI_UX_TODO.md#ui-compare-workspace)。

- [ ] **胶卷分享卡片生成器（P2；Ready after UI-19）**
  - 第一阶段只做本地 Canvas 2D 导出，不建设公开 Feed：支持单张照片卡、器材/胶卷信息卡和后续 Contact Sheet 整页导出，形成“完成一卷 -> 生成成果 -> 分享到外部平台”的传播闭环。交互、隐私、模板、字段和导出验收见 [`UI-08`](./UI_UX_TODO.md#ui-share-card)。

- [ ] **Year in Film 与胶片护照（P2；Ready after UI-08）**
  - 用现有拍摄记录、相机、胶卷、画幅、地点和完成时间生成年度回顾与可分享海报；胶片护照按实际使用过的品牌/型号/画幅生成印章，不把“拥有库存”误算为“拍摄过”。
  - 增加“与过去的自己比较”，优先级为 `current self -> past self -> personal milestones`；同比必须使用完整可比时间范围和明确口径，数据不足时不强行生成增长结论。
  - 里程碑保持私密、可关闭且由真实数据确定性推导，例如第 100 条归档记录、尝试 10 款胶卷或与某台相机共同使用 5 年；当前没有逐帧数据，因此不提供千帧里程碑或按帧相机占比。
  - 不做连续签到、公开排行榜、随机奖励、他人比较或为了解锁而鼓励无意义录入。基础 Year in Film 应可分享，Pro 只扩展历史同比、高级版式和高分辨率导出，避免锁死主要传播入口；实施与视觉合同见 [`UI-21`](./UI_UX_TODO.md#ui-year-in-film-passport)。

- [ ] **冲扫状态时间线（P2；Ready，需 additive schema migration）**
  - 为拍摄记录补充“已拍完、已送洗、冲洗中、扫描完成、底片归档”等真实后期阶段、日期和可选提醒；它与现有 `active/archived` 拍摄状态不是同一概念，禁止直接复用或猜改 `Roll.status`。
  - 首期字段、历史默认值、明确不包含的 lab/订单/通知范围及 Dexie/Supabase parity 已在 UI-22 固定；实现时必须连同 migration、sync mapping、Excel/备份和领域测试一起交付。详细合同见 [`UI-22`](./UI_UX_TODO.md#ui-development-timeline)。

- [ ] **可撤销的公开项目分享页（P3，导出卡片与正式部署后）**
  - 使用 opaque share token 输出用户明确选择的只读项目字段和媒体，不给核心业务表增加匿名 SELECT，也不暴露 UUID、Storage key、私人备注或编辑能力。token、媒体读取、限流、撤销和安全测试见 [`CLD-10`](./CLOUD_TODO.md#cld-10-public-sharing)。

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
