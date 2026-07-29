# Filmory-Web Roadmap

本文件是唯一 Roadmap 与待办入口。根目录 `TODO.md` 已移除，避免部署清单与产品 Roadmap 双线维护。

## 当前原则

- 每次只处理一个模块或一个明确问题。
- 优先级顺序：数据正确性/安全 > 明显 UI bug > 当前体验改进 > 商业化闭环 > 上线部署 > 长期维护。
- 功能实现和测试编写分开推进；业务代码完成后再决定是否补测试。
- 每轮开发都顺手清理明确无用的临时代码、脚本、缓存和过期注释。
- `.agents/AGENTS.md` 与 `.agents/DEVELOPMENT_GUIDELINES.md` 仍是执行规范来源。

## 已完成压缩记录

- 前端主应用已迁移为 React/Vite + Dexie local-first 架构，并接入 PWA、ErrorBoundary、主题切换、移动端导航和核心工作区；Supabase Auth/Postgres/Storage/RLS 作为后续云同步与生产上线目标保留 schema、服务代码和测试契约。
- 核心业务已覆盖：控制中心、照片库、拍摄卷/项目集、器材库、财务流水、统计、对比工作台、标签、Excel 导入/导出。
- 近期已完成：认证 bypass 仅开发环境展示、导出文案从 JSON 改为 Excel、一次性修复脚本/模板资产/本地缓存清理、测试从旧 JSON 导出逻辑改为读取 XLSX。
- 近期已完成：认证模式拆分为仅本地开发可用的 Dev Bypass 与正式账号 `user_profiles.role=admin` 管理员标记；生产不依赖 bypass。
- 近期已完成：设置页新增全局记账货币切换；Dashboard、统计、财务、器材和拍摄卷金额显示/输入标签统一跟随货币偏好；不内置或联网获取汇率，仅提供手动汇率批量换算现有金额。
- 近期已完成：设置页收口为偏好、数据主权、账号安全三组；普通 UI 移除本地数据库重置入口；修复退出登录后仍可停留在私有页面的问题，并补 Settings E2E。
- 近期已完成：Settings 支持胶卷记录页签顺序、项目集页签显隐和工作区偏好持久化；关闭胶片模式时仅 UI 强制显示项目集，不覆盖用户隐藏偏好。
- 近期已完成：器材新增流程统一为分步推荐、选中后折叠摘要、下方表单精修；相机、镜头、胶卷保持一致的新增体验，同时保留手动输入冷门型号。
- 近期已完成：会员 MVP 已接入前端 `regular` / `vip` 模型；免费用户最多 5 个进行中胶卷记录，VIP 放行；Settings、Upgrade Modal、本地“人工开通申请中”流程、Vitest 和 Playwright 回归已覆盖。
- 近期已完成：拍摄卷快捷添加胶卷弹窗修复层级和回填；默认 135，选择 120 相机时自动预选 120，并允许手动切换 135/120。
- 近期已完成：认证前端闭环继续补强到 production-facing UI 水位；注册/登录共页、找回密码、重设密码、认证回跳、未验证邮箱重发、密码策略提示与用户态错误映射已统一收口到 Auth flow service。
- 近期已完成：本地 Supabase 真实验证闭环；`supabase db reset` 从零库重放 migration chain 通过，P0 live security tests 通过，Mailpit 收到注册确认/密码重设邮件，`RUN_SYNC_LIVE_TESTS=1` 覆盖 Dexie queue push 到 Supabase 再 pull 回 Dexie。
- 当前验证状态：最近一轮 `npm run lint`、`npm run test`、`npm run build`、`npx playwright test e2e/auth-ui.spec.ts` 均通过；其中默认 Vitest 为 `20 passed / 2 skipped`、`59 passed / 3 skipped`，auth Playwright 为 `2 passed`。本地 Supabase 已完成 `supabase db reset` migration chain 验证；`RUN_P0_LIVE_TESTS=1` live security tests 通过；新增 `RUN_SYNC_LIVE_TESTS=1` live sync test 通过；本地 Mailpit 已收到注册确认与密码重设邮件。构建仅有 Vite chunk size 警告；lint 仍有 5 个非阻塞 warning 待长期清理。

## Next Up：当前执行顺序

1. [x] **本地多租户隔离全链路闭环**
   - 现状：部分页面或服务仍可能绕过 `useData`，直接读 Dexie 全表或使用全局同步水位。
   - 已完成：照片库、财务流水、器材/拍摄卷重名判断、项目集解绑、Excel 导入/导出、seed 初始化、同步队列与同步水位已按当前 `userId` 收口；补 fake-indexeddb 回归测试覆盖 Excel 导入跨租户同名器材/胶卷隔离。

2. [x] **Lint / React Compiler / Fast Refresh 规则收口**
   - 已完成：拆分 Context provider 与 hook/core，修复 React Compiler setState-in-effect / purity / static-components / preserve-memoization 等 error，让 `npm run lint` 恢复通过。
   - 剩余：仍有未使用变量、hook deps 等 warning，不阻塞 lint 退出码，后续可随相关文件维护时顺手清理。

3. [x] **UI E2E smoke 基线补充**
   - 已完成：补充 Playwright smoke helper 与当前 UI 流程测试，覆盖 Dev Login、核心导航、器材新增与重复确认、拍摄卷创建、Excel 模板下载与批量导入。
   - 已完成补充：VIP gating 的 Playwright 回归已恢复，覆盖 regular 用户第 6 卷拦截和 VIP 第 6 卷放行。

4. [x] **全局危险操作确认规范**
   - 结论：拍摄卷、器材库、项目集、相册、标签、财务流水的大部分删除入口已经接入 `ConfirmContext`；现有拍摄卷和器材库数据 format 不需要改变。
   - 已完成：Settings 账号注销改为 `DELETE` 输入校验 + `ConfirmContext` 高危确认 + 统一反馈；重置数据库成功/失败反馈已移除 `alert`。
   - 已完成：旧 JSON/Zip 覆盖恢复接口 `BackupService.importDatabaseFromZip` 已删除，避免误认为 Excel 批量导入。
   - 已完成：非危险确认类 `alert` 已替换为全局反馈，包括 Excel 导入结果、导出失败、财务金额校验、设置封面成功、器材头像失败、拍摄卷详情保存成功。
   - 已覆盖：拍摄卷删除/完成/移出项目集、器材删除、财务记录删除、相册删除/移除照片、项目集删除、标签删除均已接入 `ConfirmContext`，后续只复核文案。
   - 不纳入本轮：同步队列内部清理、测试 `clear()`、拍摄卷封面替换时清理旧 cover photo。
   - 测试：本轮至少验证 `lint` / `unit` / `build`，并按现有 E2E smoke 覆盖关键导航和导入链路；更细的取消态 E2E 可在后续单独补强。

5. [x] **Landing 登录前页面横向溢出修复**
   - 已完成：Landing 根容器、fixed nav、hero/features/footer 均按 `width/max-width/min-width` 收口，避免 flex item、fixed padding 和装饰层制造横向溢出。
   - 已测试：新增 Playwright viewport overflow 断言，覆盖桌面、平板、390px 与 320px 移动端。

6. [x] **Dexie/Supabase schema parity 准备**
   - 已完成：新增 `collections` 云端表，补 `rolls.camera_ids`、`rolls.collection_id`、`rolls.lens_ids`、`lenses.mount_key`，并将 `SyncService.tableMap` 接入 collections、camera systems、film backs 等新表。
   - 已完成：`public.user_profiles` 创建 migration 已补在 `20260619210000_create_user_profiles.sql`，位于任何 `ALTER TABLE public.user_profiles` 之前，含 RLS、trigger 和 grants。
   - 已测试：补模块测试覆盖 collections、cameraIds、collectionId、filmBackId、lensIds、lens mountKey 的 snake_case 推送映射。

7. [x] **统计页指标精简**
   - 已完成：移除顶部“总照片数/平均每卷照片”核心 KPI，只保留总卷数、总拍摄集数、机器数字、库存卷、拍过的卷。
   - 已完成：月度趋势、器材 ROI 和高分卷展示不再把保存照片数当作真实快门数；照片数量仅以“精选样片/样片”作为辅助语义出现。

8. [x] **器材编辑表单缩略图移除**
   - 范围：相机、镜头、胶卷库存、其他器材的编辑/修改弹窗或表单。
   - 已完成：四类器材编辑弹窗均新增封面预览、更换封面与移除封面；移除后本地 `avatarUrl` 写为 `null`，并显式进入 syncQueue，确保云端 `avatar_url` 也被清空。
   - 已测试：补 `gear-avatar` 模块测试覆盖相机、镜头、胶卷库存、其他器材封面移除，确认其它字段不变，并验证 Supabase upsert payload 带 `avatar_url: null`。

9. [x] **生产认证链路本地收口**
   - 目标：生产环境无 bypass，验证邮件、密码找回、OAuth 回调和跳转都具备前端与本地 Supabase 验证基础。
   - 已完成前端闭环 1：登录页已补未验证邮箱提示与重发验证邮件、找回密码入口；新增 `/auth/callback`、`/auth/check-email`、`/auth/verified`、`/auth/forgot-password`、`/auth/reset-password` 公共认证页面；注册、OAuth、密码重设 redirect 已统一收口到前端 Auth flow service。
   - 已完成前端闭环 2：注册与重设密码已统一要求至少 8 位，且包含大写字母、小写字母和数字；登录/注册补确认密码、密码显隐切换、密码规则提示和更贴近摄影师用户的错误文案；callback 对不安全 `next` 路径回退到 `/login`，避免 open redirect；已登录用户访问 `/login` 会回到 `/dashboard`，未登录访问私有页会被路由守卫送回登录页。
   - 已完成测试补充：新增 auth frontend unit tests 与 public auth UI Playwright E2E，覆盖注册跳转、弱密码拦截、未验证邮箱提示、无效登录文案、找回密码入口、无 recovery session 的重设密码兜底、callback 错误落点，以及 callback unsafe next fallback。
   - 已完成本地 live 验证：本地 Supabase + Mailpit 可收到注册确认邮件和密码重设邮件；邮件链接回到 `/auth/callback`，并带 `next=/auth/verified` 或 `next=/auth/reset-password`。
   - 后续转 P3：生产 SMTP、线上域名 redirect、OAuth provider 配置和 session 边界仍需上线前复核。

10. [x] **UI/CSS 设计系统收口：120 后背建模前置清理**
   - 结论：这批问题不是 P0 安全/数据问题，但会影响后续 120 后背 UI 在控制中心、拍摄卷和器材库中的一致性；建议先完成基础样式收口，再开始 120 数据模型与交互实现。
   - 已完成：统一 Photos header、补 `.secondary` / `.btn-sm`、拆分 Rolls 视图切换与 tabs 样式、修复 Dashboard hover/快捷入口颜色语义、Gear hover accent、Insights inline tab 样式、重复 body 与 modal h3 标题规则。
   - 已测试：`npm run lint` / `npm run build` / `npm run test` / `npm run e2e` 均通过；仍仅有既有 lint warnings 与 Vite chunk size warning。

11. [x] **接入 Supabase API 前置清理**
   - 当前策略：本地开发阶段以 Dexie/IndexedDB 为事实源，不要求 Supabase API 在线；Supabase 相关问题不阻塞继续打磨本地产品体验。
   - 已完成：`user_profiles` 建表 migration、RLS、trigger、grants 与 schema 文档已补齐。
   - 已完成：`frontend/.env.local` 改为本地 URL + 本地 JWT 占位 key，并默认 `VITE_ENABLE_SUPABASE_SYNC=false`，避免本地阶段误连 Cloud key。
   - 已完成：`SyncService` 增加默认关闭的 App 生命周期接入；只有 `VITE_ENABLE_SUPABASE_SYNC=true` 且 URL/key 格式匹配时，登录后才会执行一次 sync 并订阅 Realtime。
   - 已完成：写入后的节流 push、窗口恢复/网络恢复重试、退出登录前停止订阅、状态 badge 与对应模块测试已补齐。
   - 已完成 live 验证：本地 Supabase 启动后已执行 `supabase db reset`，确认 migration chain 从零库可落地；`RUN_SYNC_LIVE_TESTS=1` 覆盖 Dexie `syncQueue -> Supabase -> pull 回 Dexie`。
   - 已完成：真实 local API 基线通过；真正切到 Cloud/API 前，只剩环境切换与产品级 smoke，不再是 schema/sync 基础阻塞。

12. [ ] **真实 App 开启 Supabase Sync smoke**
   - 目标：临时开启 `VITE_ENABLE_SUPABASE_SYNC=true`，用真实 Supabase Auth 账号而不是 Dev Bypass，在浏览器 UI 中创建相机、胶卷库存、拍摄卷和可选 120 后背/镜头关系。
   - 需要验证：Supabase Studio 中对应表写入正确、`user_id` 正确、登出/登录用户切换后 RLS 与本地 UI 都不泄露其他用户数据。
   - 需要验证：刷新页面后数据仍一致；sync status badge 能正确显示本地/同步中/已同步/错误态。
   - 边界：这是本地 Docker Supabase + 前端 UI 的产品级 smoke；通过后再考虑 Cloud 环境变量和生产部署。

## P0：安全与数据正确性

- [x] **Storage 私有桶与 Signed URL**
  - 已完成：`filmory-assets` 迁移为 Private Bucket，Storage RLS 改为 owner-only，前端上传和展示改用 Signed URL，不再生成 Public URL。
  - 已测试：补 P0 module tests，覆盖 private bucket migration、public read policy 移除、signed URL 生成与 `storageKey` 优先展示。
  - 已补充：新增可显式开启的 live integration tests，覆盖同用户 signed URL、匿名/跨用户直接读取失败、bucket `public=false`。
  - 已修复：补 authenticated/service_role 对 RLS 保护业务表的表级权限 grants，避免只有 RLS policy 但 PostgREST 角色无表权限。
  - 后续：生产 Supabase 执行 migration 后，需用真实账号复核跨用户盗链失败与同用户 signed URL 成功。

- [x] **账号删除 UI**
  - 已完成：Settings 已提供正式入口，使用 `DELETE` 输入 + `ConfirmContext` 强确认 + 失败反馈。
  - 已完成：`delete_user()` RPC 已存在并限制为 authenticated 执行；本地 Supabase migration 已验证。
  - 已测试：补 P0 module tests，覆盖 `SECURITY DEFINER`、删除 auth.users、revoke PUBLIC/anon、grant authenticated。
  - 已补充：新增可显式开启的 live integration tests，覆盖 authenticated 可调用、anon 失败、删除 auth 用户后用户数据 cascade 清理。

- [x] **Supabase / Dexie schema parity**
  - 已完成：补 migration、`SyncService` table map 和字段映射测试，避免跨设备同步时项目集或卷关联丢失。

- [x] **Supabase API 接入前置验证**
  - 当前不阻塞本地-only 开发；接入 Supabase API 或准备生产部署前必须完成。
  - 决策：现在不急着连接 Supabase API。先把本地 Dexie 产品流、schema parity、迁移链和同步开关设计稳定；等 Docker 本地 Supabase 可重复 reset 通过后，再切到 API/Cloud 接入。
  - 已完成：`.env.local` 不再混用本地 URL 与 Cloud publishable key，默认关闭 Supabase auto sync。
  - 已完成：`SyncService` 已以显式 env flag 接入 App 生命周期，避免本地阶段自动 push/pull；开启后登录会触发一次 sync，并建立 Realtime 订阅。
  - 已完成：Realtime 订阅已按业务表逐表注册，并带 `user_id=eq.<currentUserId>` filter，避免其他用户变更触发当前用户全量同步。
  - 已完成：写入后的节流 push、窗口恢复/网络恢复重试、退出登录停止订阅和状态展示已补齐并测试。
  - 已完成：本地 Supabase 已执行 `supabase db reset`，migration 链全新库落地通过；P0 live security tests 通过；新增 sync live test 覆盖本地 queued camera push 到 Supabase，再从远端更新 pull 回 Dexie。
  - 后续：生产/Cloud 接入前确认是否移除旧 `rolls.camera_id`，或明确只作为 legacy backfill 字段保留；再切换正式环境变量和真实账号做跨设备 smoke。

## P1：会员能力与产品闭环

- [x] **会员配额闭环收口**
  - 已完成：前端 `UserProfile.tier`、`regular` / `vip`、免费用户 5 个进行中胶卷记录限制、VIP 第 6 卷放行、Upgrade Modal、Settings 会员状态、本地“人工开通申请中”流程和回归测试。
  - 产品决策：不限制相机、镜头、胶卷库存、其他器材和历史归档卷数量；这些是基础记录资产，限制会降低胶片摄影用户的核心可用性。
  - 已完成：抽出统一会员能力配置 `membershipPolicy`，集中定义 `activeRollLimit`、`cloudSyncEnabled`、`photoStorageQuotaMb`、`highResUploadEnabled`，Rolls、Settings 和 Upgrade Modal 共用同一来源。
  - 已完成：Settings / Upgrade Modal 文案同步为同一份能力配置，不再手写多份权益表。
  - 后续：照片上传或云端图片存储配额策略；本地 Dexie-only 阶段不拦截，开启 Supabase Storage 后再按账号 tier 计算。
  - 后续：手动开通 MVP 的运维回写流程，明确管理员如何把 `user_profiles.tier` 改为 `vip`；如果商业化，再接 Stripe/赞助平台 webhook。
  - 可选增长：VIP 只读公开分享链接；不阻塞当前本地产品闭环。

- [x] **会员限制的后端硬防线**
  - 已完成：新增 Supabase trigger `enforce_membership_active_roll_limit_on_rolls`，阻止 `regular` 用户越权创建第 6 个 active roll。
  - 范围：只保护 active roll limit；器材库、胶卷库存、项目集和 archived roll 不做硬限制。
  - 已测试：补 `RUN_MEMBERSHIP_LIVE_TESTS=1` live integration test，覆盖 regular 第 6 个 active roll 写入失败、archived roll 不计入、VIP 放行。

- [ ] **PWA 更新提示**
  - 目标：当新 Service Worker 发布时，给用户明确的“更新到新版本”提示，避免长期停留在旧缓存。

## P2：体验与功能优化

- [x] **UI/CSS audit 修复清单**
  - 已完成：PhotosView header、`.secondary`、`.btn-sm`、Rolls view toggle/tab 样式隔离、Dashboard hover、Gear accent hover、Photos/Rolls 桌面 sticky toolbar、Insights tab class、Dashboard 快捷入口颜色语义、重复 `body {}`、modal h2/h3 标题规则。
  - 已测试：`lint` / `build` / `unit` / `e2e` 全部通过。

- [ ] **拍摄卷工作流优化**
  - 已完成：Dashboard 改为胶片用户优先，展示进行中卷、库存、使用中机器/镜头/后背；库存按 135/120 与彩色/黑白分组展示，进行中卷展示实际装片组合 `相机 + 后背 + 胶卷`；移除库存预警、最近完成、总片数和总花费；“继续记录”直达 `rolls?openRoll=<id>` 并打开对应 drawer。
  - 已完成：拍摄卷页签顺序、项目集显隐、当前 tab 和卡片/list 视图可持久化；项目集、全部记录、散卷的 list 模式统一为两列；登出只清理当前 tab，不清理用户显式布局偏好。
  - 已完成：120 中画幅后背模型、共享后背、固定后背自动建模、active 装载冲突检查、卷级 `lensIds` 和 Dashboard/卡片/详情展示；已覆盖 `film-back-workflow` unit、`film-backs` E2E、Dashboard E2E 和 schema parity。
  - 已完成：新建卷快捷添加胶卷置顶并回填；画幅默认 135，选择 120 相机时自动预选 120，仍可手动切换。
  - 剩余：补“刷新后封面仍显示”的 E2E 断言；封面读取代码路径已支持 `coverPhotoId -> photoUrlMap -> thumbnailUrl/blob/signed URL fallback`。
  - 剩余：历史已有 120 固定后背相机若缺少 `cameraSystemId` / `filmBackId`，接 Supabase 或做数据迁移前再补 backfill；新建数据已走统一模型。
  - 可选：增加 `Camera.mountKey` / `Lens.mountKey` 兼容性提示和筛选，但不强制阻止选择，避免误伤转接环和跨系统使用。

- [x] **器材添加流程简化**
  - 已完成：相机、镜头、胶卷新增流程统一为分步推荐、选中后摘要折叠、下方表单精修；相机按类型/画幅/品牌/型号阶梯筛选，镜头按类型/卡口/品牌/型号筛选，胶卷按画幅/品牌/型号筛选。
  - 已完成：所有新增流程都保留手动 fallback，允许记录冷门机型、改装机、转接镜头和资料库缺失型号；120 后背/片盒明确归属相机系统，不放入“其他器材”。
  - 已完成：相机、镜头、胶卷预设迁到 `frontend/src/catalog/gear/`，只作为静态离线 reference catalog，不写入用户资产表，不迁入 Supabase；已补 catalog validation test。
  - 已验证：相关 unit/build/lint 通过，并用 `gear-builder` / `film-backs` / smoke E2E 覆盖主要流程。后续只有当 catalog 需要非工程人员维护时，再考虑拆成 JSON/CSV 或独立 seed 工具。

- [ ] **Sync/Dexie 中等风险清理**
  - 已完成：Dexie `tagConfigs` 已从 `&name` 全局唯一索引迁到 `&[userId+name]` 复合唯一，并补多用户同名标签测试。
  - 已完成：`SyncService.setupRealtimeSubscription()` 已按业务表增加 `filter: user_id=eq.${userId}`，避免其他用户或无关表变化触发全量同步。
  - 已完成：`SyncService` pull 增加本地-only 字段黑名单，与 push 的 `blob` 过滤保持对称。
  - 已完成：`useCollections` 未登录行为已和其他 `useData` hooks 对齐，`!user` 时直接返回 `[]`，不再查询隐式 `offline` 用户；补 hook 回归测试。
  - 后续：Supabase `rolls.camera_id` 与 `rolls.camera_ids` 双列共存是历史兼容状态；接 API 前决定是否增加 migration 移除旧 `camera_id`，或明确只作为 legacy backfill 字段保留，避免新逻辑继续写旧列。
  - 已完成：`filmory.sh` 的 `supabase stop` 改为显式反馈，Supabase 未运行时提示可忽略，避免误判后端状态。

- [ ] **危险操作取消态 E2E 补强**
  - 目标：在现有 `ConfirmContext` 已接入的基础上，补充取消删除、取消账号注销、取消重置等黑盒测试，确认取消路径不会产生数据变更。

- [ ] **表单与微交互一致性复核**
  - 来源：已合并到 `docs/audit_result/jul-07-update.md` 的 UI/UX audit 剩余项。
  - 目标：系统检查 Settings、Gear、Rolls、Photos、Finance 的输入 focus 状态、二级 icon button hover、destructive hover、窗口 resize/reflow 和弹窗内容折叠行为。
  - 原则：只修真实不一致或影响操作判断的交互，不做大规模视觉重设计。

- [ ] **前端模块机会型抽取**
  - 结论：当前不需要为“面向对象设计”强行重构；仅在修改相关页面时，把重复业务块顺手抽成可复用 hook/component/service。
  - 优先候选：统计 KPI 卡片、器材编辑头像/缩略图控件、拍摄卷列表卡片、导入导出反馈与校验逻辑。

- [ ] **Compare 工作台复核**
  - 现有对比功能已实现核心能力，但还需要按实际 UI 再复核代表照片、行堆叠、控制变量筛选是否完全符合最终产品预期。

- [ ] **i18n 国际化**
  - 配置 `i18next` / `react-i18next`，抽离中文硬编码，补 `zh.json` / `en.json`，统一日期和货币格式。

## P3：部署上线事项

- [ ] **Supabase 生产项目**
  - 创建线上 Supabase 项目，配置 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，执行迁移与 RPC 部署。

- [ ] **真实邮件服务**
  - 在 Supabase Auth 中配置 Resend、SendGrid、Amazon SES、Postmark 等自定义 SMTP，并更新注册验证、密码重置模板。
  - 本地开发用 Supabase CLI Mailpit 验证邮件内容和跳转链接；生产上线前必须用真实域名发信做端到端验证。

- [ ] **前端托管**
  - 部署到 Cloudflare Pages / Vercel / Netlify，配置构建命令 `npm run build`、输出目录 `dist` 和生产环境变量。

- [ ] **Auth Redirect URL**
  - 在线上 Supabase Dashboard 设置 Site URL、Redirect URLs、OAuth 回调域名、邮箱验证 redirect 与密码重设 redirect。

## P4：长期维护

- [x] **Lint warning 清理**
  - 已完成：清理剩余 5 个 warning，包括按钮组件 `size` props、Finance 未使用累计值，以及 Rolls/Collections hook deps 问题；`npm run lint` 现在零 warning。

- [ ] **Bundle 拆分**
  - 当前构建通过但存在大 chunk 警告；后续按路由或重依赖拆分。

- [x] **README 与详细规格同步**
  - 已完成：README、`docs/supabase_schema.sql`、`docs/DATABASE_SCHEMA.md` 与 `docs/Detailed-Specs` 已压缩到当前 Vite + Supabase + Dexie + private Storage/Signed URL 架构事实。
  - 后续：新功能完成后继续按 `.agents/AGENTS.md` 要求同步相关 docs，避免再次形成历史口径。
