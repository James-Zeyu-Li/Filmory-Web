# Filmory-Web Roadmap

本文件是唯一 Roadmap 与待办入口。根目录 `TODO.md` 已移除，避免部署清单与产品 Roadmap 双线维护。

## 当前原则

- 每次只处理一个模块或一个明确问题。
- 优先级顺序：数据正确性/安全 > 明显 UI bug > 当前体验改进 > 商业化闭环 > 上线部署 > 长期维护。
- 功能实现和测试编写分开推进；业务代码完成后再决定是否补测试。
- 每轮开发都顺手清理明确无用的临时代码、脚本、缓存和过期注释。
- `.agents/AGENTS.md` 与 `.agents/DEVELOPMENT_GUIDELINES.md` 仍是执行规范来源。

## 已完成摘要

- 架构与数据：React/Vite + Dexie local-first 主架构已稳定；Supabase Auth/Postgres/RLS/private Storage/signed URL/RPC/sync 作为云同步和生产目标保留，并已完成 schema parity、migration chain、P0 security live test 和 sync live test。
- 核心产品：Dashboard、拍摄卷/项目集、器材库、财务、统计、对比、标签、Excel 导入/导出已覆盖当前胶片摄影工作流；全局 Photos / Albums 已从主产品入口隐藏，照片只作为拍摄卷封面/样片底层能力保留；统计已去掉无意义总照片数，Dashboard 已改为胶片用户优先。
- 认证与安全：Dev Bypass 仅开发环境可见，生产使用 Supabase Auth；注册、登录、邮箱验证、找回密码、重设密码、回调安全、账号删除、危险操作确认和多租户隔离已收口。
- 器材与拍摄卷：相机/镜头/胶卷新增流程已统一为分步推荐 + 手动 fallback；120 可换后背、共享后背、固定后背、卷级镜头关系、后背装载冲突、刷新后封面仍显示和相关 E2E 已完成。
- 会员与试用：regular/vip 模型、免费用户 5 个进行中卷限制、Supabase 后端 trigger 硬防线、Upgrade Modal、人工申请 MVP、Landing 试用入口、试用限制、试用 Banner 和注册引导已完成。
- UI 与文档：Landing overflow、UI/CSS audit、Settings 重构、tab 偏好、器材封面移除、图片压缩参数收口、README/schema/architecture/audit 文档同步已完成。
- 国际化：已完成轻量 i18n 基础设施、语言偏好持久化、Settings 语言切换，并接入 Sidebar、Landing、Login/Auth 辅助页、Dashboard、Rolls/Collections、Gear、Insights/Stats/Finance、Compare、Excel Import、Upgrade/Trial、Feedback/Confirm 等核心文案；用户输入的器材、胶卷、照片和笔记内容不自动翻译。
- 测试补强：危险操作取消态 E2E 已覆盖取消删除相机、取消删除拍摄卷、取消账号注销最终确认，确认取消路径不会误删数据或触发登出/销毁流程。
- 当前验证状态：最近一轮 `npm run lint`、`npm run test`、`npm run build`、`npx playwright test e2e/i18n.spec.ts`、`npx playwright test e2e/auth-ui.spec.ts`、`npx playwright test e2e/settings.spec.ts e2e/danger-cancel.spec.ts` 均通过；默认 Vitest 为 `26 passed / 3 skipped`、`83 passed / 5 skipped`；构建仅有 Vite chunk size warning，lint 当前零 warning。

## Next Up

1. [ ] **PWA 更新提示**
   - 当新 Service Worker 发布时，自动检测并给用户明确的“更新到新版本”提示，避免长期停留在旧缓存。
   - 交互：Toast 自动出现，提供“立即更新 / 稍后”两个动作；不新增“自动更新还是手动更新”的用户设置项。
   - 原则：更新检测自动完成，但刷新时机交给用户，避免打断正在录入的表单或拍摄卷编辑流程。

## P1：会员能力与商业化

- 当前会员 MVP 已完成；真实支付、云端配额和 webhook 回写依赖 Supabase/Cloud 环境，统一放到 “Supabase / Cloud 接入后任务”。

## P2：体验与功能优化

- [ ] **表单与微交互一致性复核**
  - 系统检查 Settings、Gear、Rolls、Finance、Insights、Compare 的输入 focus 状态、二级 icon button hover、destructive hover、窗口 resize/reflow 和弹窗内容折叠行为。
  - 只修真实不一致或影响操作判断的交互，不做大规模视觉重设计。

- [ ] **前端模块机会型抽取**
  - 当前不需要为“面向对象设计”强行重构；仅在修改相关页面时，把重复业务块顺手抽成可复用 hook/component/service。
  - 优先候选：统计 KPI 卡片、器材编辑头像/缩略图控件、拍摄卷列表卡片、导入导出反馈与校验逻辑。

- [ ] **Compare 工作台复核**
  - 现有对比功能已实现核心能力，但还需要按实际 UI 再复核代表照片、行堆叠、控制变量筛选是否完全符合最终产品预期。

- [ ] **胶卷分享卡片生成器**
  - 目标：生成可导出的复古胶片/拍立得风格分享卡片，方便发布到小红书、Instagram、朋友圈等渠道；不依赖全局照片仓库。
  - 内容：用户可临时上传一张图片，也可以只生成器材/胶卷展示卡；卡片可包含相机、镜头、胶卷品牌/型号、ISO、光圈、快门、焦段、拍摄日期、地点、评分和简短备注；缺失字段应自动隐藏。
  - 交互：优先从拍摄卷详情或器材库入口打开；提供 2 到 3 个模板、预览、导出 PNG/JPEG 和复制/下载动作。
  - 测试要求：补导出数据映射单测，至少一条 Playwright smoke 覆盖打开生成器、选择模板、生成预览和下载按钮可用。

- [ ] **i18n 长尾机会型清理**
  - 核心界面双语化已完成并移入已完成摘要。
  - 剩余只保留机会型复核：隐藏/legacy Photos 子页面、Tags 管理、少量非主路径 service fallback。
  - 范围边界：用户输入的数据、品牌型号、EXIF 参数和历史记录内容不自动翻译；reference catalog 名称保持原始名称。
  - 后续：日期、数字、货币显示继续通过 `Intl` 或统一 formatter 按当前语言/货币偏好输出；不要把货币换算和语言切换绑定。

## Supabase / Cloud 接入后任务

以下任务需要真实 Supabase API、Cloud 项目、生产环境变量、邮件服务或支付 webhook。它们不作为本地-only 阶段阻塞项。

- [ ] **登录后关键资料自动恢复（profile bootstrap）**
  - 目标：用户登录成功后，先自动恢复最关键的账号资料，再后台跑完整 sync；用户不需要理解“手动恢复”或“同步策略”。
  - 恢复优先级：先恢复 `displayName`、`tier` 和基础 `user_profile`，再继续恢复器材、胶卷库存、拍摄卷、项目集等完整业务数据。
  - 产品反馈：只向用户暴露“正在恢复云端资料...” / “已同步” / “离线，稍后继续”这类状态，不提供开发者导向的同步模式选择。
  - 边界：`email` 继续作为认证身份来源；`userId` 继续作为内部 UUID 主键；`displayName` 允许重复，不升级为唯一 `username` 登录体系。
  - 验证要求：覆盖“清空本地 / 更换浏览器后重新登录”场景，确认关键资料会先回来，再由后台完整 sync 继续补齐。

- [ ] **Supabase 生产项目**
  - 创建线上 Supabase 项目，配置 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，执行迁移与 RPC 部署。

- [ ] **真实 App 开启 Supabase Sync smoke**
  - 临时开启 `VITE_ENABLE_SUPABASE_SYNC=true`，用真实 Supabase Auth 账号而不是 Dev Bypass，在浏览器 UI 中创建相机、胶卷库存、拍摄卷和可选 120 后背/镜头关系。
  - 验证 Supabase Studio 中表写入、`user_id`、刷新后数据一致、sync status badge、登出/登录用户切换后的 RLS 与本地 UI 隔离。
  - 这是本地 Docker Supabase + 前端 UI 的产品级 smoke；通过后再考虑 Cloud 环境变量和生产部署。

- [ ] **真实邮件服务**
  - 在 Supabase Auth 中配置 Resend、SendGrid、Amazon SES、Postmark 等自定义 SMTP，并更新注册验证、密码重置模板。
  - 本地开发用 Supabase CLI Mailpit 验证邮件内容和跳转链接；生产上线前必须用真实域名发信做端到端验证。

- [ ] **前端托管**
  - 部署到 Cloudflare Pages / Vercel / Netlify，配置构建命令 `npm run build`、输出目录 `dist` 和生产环境变量。

- [ ] **Auth Redirect URL**
  - 在线上 Supabase Dashboard 设置 Site URL、Redirect URLs、OAuth 回调域名、邮箱验证 redirect 与密码重设 redirect。

- [ ] **Auth / 前端错误观测与追踪**
  - 目标：补最小可用的 auth / 关键前端错误 observability，避免生产环境只靠用户截图描述“注册失败/登录失败/回跳失败”而无法定位。
  - Auth 关键事件：注册失败、登录失败、验证码/验证邮件重发失败、密码重设失败、auth callback 失败；需要统一记录 `event name`、时间、当前 route、masked email、error message/code、可选 `trace_id`。
  - 前端关键错误：`ErrorBoundary` 捕获的未处理渲染错误、App 初始化失败、Sync/Storage 的明确失败态；至少保留统一上报入口，不再只散落 `console.error`。
  - 安全要求：禁止记录明文密码、access token、refresh token、完整 magic link / recovery URL、未脱敏邮箱；日志默认只保留脱敏身份信息与错误上下文。
  - 环境策略：本地开发允许先落到结构化 `console`；生产接 Sentry / PostHog / 自建 telemetry 三选一即可，但接口层要预留 provider 替换位。
  - Trace 指南：补一份 auth/manual debug checklist，明确前端 Console、Network、Supabase Auth 日志、Mailpit/SMTP、Redirect URL 配置的排查顺序。

- [ ] **Storage / RLS 生产复核**
  - 生产 Supabase 执行 migration 后，用真实账号复核跨用户盗链失败、同用户 signed URL 成功、账号删除 cascade 和会员 active roll trigger。

- [ ] **云端图片/存储配额策略**
  - 本地 Dexie-only 阶段不拦截照片上传；开启 Supabase Storage 后再按账号 tier 计算高分辨率上传、云同步和存储配额。
  - 需要决定 regular/vip 的 `photoStorageQuotaMb`、超额提示和是否允许只保留本地缩略图。

- [ ] **Supabase legacy schema / backfill 决策（接 API 前处理）**
  - 当前不作为本地-only 阶段待办；这是连接 Supabase API、迁移旧数据或准备生产库前的 schema 清理决策。
  - Supabase `rolls.camera_id` 与 `rolls.camera_ids` 双列共存是历史兼容状态；接 API 前决定是否增加 migration 移除旧 `camera_id`，或明确只作为 legacy backfill 字段保留。
  - 历史已有 120 固定后背相机如果缺少 `cameraSystemId` / `filmBackId`，接 Supabase 或做数据迁移前再补 backfill；新建数据已走统一模型。
  - 可选：增加 `Camera.mountKey` / `Lens.mountKey` 兼容性提示和筛选，但不强制阻止选择，避免误伤转接环和跨系统使用。

- [ ] **商业化自动支付闭环**
  - 目标：把当前“申请 VIP / 人工开通”MVP 升级为自动付款开通，优先评估 Stripe Checkout；备选 Creem 或 LemonSqueezy。
  - 产品流：Upgrade Modal 点击升级后创建 hosted checkout session；付款成功后回到应用的成功页，失败或取消回到会员说明页。
  - 后端流：通过受签名校验的 webhook 接收支付成功事件，按 checkout metadata 中的 `user_id` 幂等更新 `public.user_profiles.tier = 'vip'`，并记录付款 provider、事件 id 和更新时间。
  - 安全要求：Webhook secret 不进入前端；必须校验签名、事件幂等、防止客户端直接声明 VIP；本地开发需要提供 webhook 模拟或 CLI 测试路径。
  - 测试要求：补 webhook handler unit/integration 测试，覆盖成功开通、重复事件幂等、无效签名拒绝、找不到用户不误开通；补前端 upgrade flow smoke。

## P4：长期维护

- [ ] **Bundle 拆分**
  - 当前构建通过但存在大 chunk 警告；后续按路由或重依赖拆分。

- [ ] **文档持续同步**
  - 新功能完成后继续按 `.agents/AGENTS.md` 要求同步 README、schema、Detailed-Specs 和本 Roadmap，避免再次形成历史口径。
