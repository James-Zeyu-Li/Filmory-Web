# Grainfolio Cloud / Backend TODO

本文件保存 Grainfolio Cloud 与后端边界工作的实施细节，包括 Supabase Auth/Postgres/RLS/Storage/Realtime/RPC、SMTP、支付 webhook、观测和生产部署。

## 文档职责

- [`ROADMAP_TODO.md`](./ROADMAP_TODO.md) 是唯一的优先级、实施顺序和顶层完成状态来源。
- 本文件只维护 Cloud/backend 任务的实现步骤、环境配置、验证矩阵和证据要求，不维护第二套顶层状态。
- [`UI_UX_TODO.md`](./UI_UX_TODO.md) 负责用户可见界面、响应式、无障碍和交互验收；本文件只记录其必须遵守的 Cloud 安全与数据契约。
- 数据实体与现行契约以 `.local-docs/architecture/reference/` 为事实规格；本文件不能用计划覆盖当前 schema 事实。
- 完成一个 Cloud/backend 任务时，先完成本文件的验收，再回到 Roadmap 更新对应 checkbox。

## 全局验收基线

- 浏览器只能持有 Supabase publishable/anon key；`service_role`、SMTP secret、webhook secret 和 provider token 不进入前端、Git 或日志。
- 所有用户业务表启用 RLS，并以 `auth.uid() = user_id` 或等价 owner 条件收口；不能用前端过滤替代 Cloud 权限。
- `grainfolio-assets` 保持 private；读取使用 signed URL，不增加 Public Read policy，也不使用 `getPublicUrl()` 绕过权限。
- schema、RPC、trigger、grant、RLS、Storage policy 与 Realtime publication 变化通过可重复 migration 管理；Dashboard 手工配置需在本文件记录验证证据。
- migration 先在本地 Supabase 或隔离项目验证，再应用到目标 Cloud；禁止直接修改 `storage.objects` 模拟对象移动或删除。
- 需要幂等的业务操作使用稳定 operation ID、唯一约束或 provider event ID；网络重试不能重复扣库存、创建记录、开通会员或处理付款。
- Cloud smoke 使用真实 Supabase Auth 账号；Dev Bypass 和 Trial 不能作为 RLS、跨设备、SMTP 或 Storage 验收证据。
- 每项验收至少记录：环境、执行时间、账号/对象使用脱敏标识、结果、失败日志位置和必要的回滚方式。

## 已完成基线

<a id="cld-baseline-sync"></a>
### CLD-B01 Offline-first Sync 与库存原子操作

- 普通实体使用 durable `record` queue + LWW；库存使用 `operation` outbox + 稳定 `operationId`。
- `adjust_film_stock` 与 `create_roll_with_inventory` 由 Cloud RPC 原子执行，普通 record upsert 不覆盖库存数。
- 普通写入以 `500ms` 合并；明确保存、创建、删除和库存调整立即异步唤醒同步。
- Realtime 正常时停止 polling；channel 异常时启用可见且在线页面的 `60s` fallback。
- 网络/超时保留原 operation 重试；永久失败进入“需要处理”，支持撤销本机变更或将拍摄记录保留为未登记库存。
- 双账号隔离、双设备同账号库存代数和、离线恢复、删除传播和 operation 重放已有自动或手工验证。

<a id="cld-baseline-security"></a>
### CLD-B02 Auth、RLS 与 Private Storage

- Supabase Auth 注册、验证、登录、recovery、重设密码和账号删除已从本地前端连接 Cloud 验证。
- `grainfolio-assets` 为 private；owner signed URL、匿名拒绝、跨用户拒绝和账号删除 cascade 已验证。
- Resend 发信域、发件人、注册/recovery 邮件、900 秒 OTP 和前端 300 秒发送冷却已完成。
- Cloud sync 仍由 `VITE_ENABLE_SUPABASE_SYNC` 显式控制；日常 local-only 开发不自动访问 Cloud。

## 当前执行顺序

以下编号只用于稳定链接。真正优先级以 Roadmap 的 `Next Up` 为准。

<a id="cld-01-photo-integrity"></a>
### CLD-01 图片完整性与历史补上传

**当前实现**

- Cloud 上传失败时，`saveDeferredPhotoUpload()` 抑制不完整 metadata 入队，并把本地 blob 保留为可恢复资料。
- `photoUploadRecoveryService` 扫描当前用户 `storageKey` 为空但 blob 存在的图片，上传成功后回填 `storageKey`、`thumbnailUrl` 和 `previewUrl`。
- Settings 仅在存在待补上传图片时展示入口；同一用户的并发修复复用同一 in-flight repair，目标是不重复上传。
- 本地阻塞已清除：in-flight repair 去重用例已恢复通过；2026-08-22 全量 Vitest 为 `58 passed / 3 skipped` 文件、`255 passed / 5 skipped` 测试。当前只剩下方真实 Cloud 跨设备与对象一致性验收。

**Cloud 验收**

1. 使用真实账号在浏览器 A 离线上传测试封面，确认本地封面保留且 Settings 出现待补上传入口。
2. 恢复网络并执行补上传，等待同步状态确认；核对 `photo_assets.storage_key` 与 `storage.objects.name` 一致。
3. 浏览器 B 使用同一账号打开对应拍摄记录，确认无需 A 的 IndexedDB blob 即可通过 signed URL 显示。
4. 清理 B 的站点资料并重新登录，再次确认封面可恢复。
5. 重复触发修复或模拟响应丢失，确认没有第二个 Storage object 或重复 `photo_assets` 行。
6. 再模拟一次 Storage 暂时不可用，确认失败仍保留本地 blob，恢复网络后可重试成功。

**SQL 复核**

```sql
select id, user_id, roll_id, storage_key, updated_at
from public.photo_assets
where roll_id = '<test-roll-id>'
order by updated_at desc;

select id, bucket_id, name, owner, created_at
from storage.objects
where bucket_id = 'grainfolio-assets'
  and name = '<storage-key>';
```

**跨文档边界**

- 文件选择、错误反馈、Settings 状态和 `44px` 触控目标按 [`UI-02`](./UI_UX_TODO.md#ui-cloud-photo-recovery) 验收。
- Cloud 验收完成前，Roadmap 的“图片完整性最终验证”保持未完成。

<a id="cld-02-production-auth-email"></a>
### CLD-02 生产域 Auth 与邮件最终验收

- 在正式 HTTPS hostname 配置 Supabase Site URL 与精确 Redirect URLs；生产 URL 不使用 wildcard 替代明确 callback。
- 验证注册确认、recovery、已过期链接、已使用链接、重复点击和移动端邮件 App 回跳。
- 复核 Resend/SMTP 发件身份、provider 日志、退信与投诉处理；邮件内容不能泄露 token 或完整 recovery URL 到日志。
- 只有真实启用的 OAuth provider 才显示在前端；每个 provider 单独验证 callback、取消、账号冲突和错误恢复。
- 前端独立 Auth 路由与认证卡片按 [`UI-03`](./UI_UX_TODO.md#ui-auth-layout) 实施；不得削弱 recovery session、intent TTL 或 redirect allowlist。

<a id="cld-03-password-recovery-policy"></a>
### CLD-03 密码策略与恢复链路

- 在 Supabase Dashboard 确认服务端密码策略为唯一权威，再同步前端即时提示；支持至少 64 字符，不静默截断，并允许密码管理器粘贴。
- 评估并开启 Leaked Password Protection；当前阶段不实现密码历史表或“一年内不得重复”策略。
- 复核注册、验证和 recovery 邮件 Rate Limit，使前端 cooldown 与 provider 限制一致。
- 接入或确认密码修改成功通知邮件；邮件不应包含密码、session 或可直接复用的敏感凭据。
- 忘记密码对外统一反馈，不回显输入邮箱，也不暗示账号一定存在；真实 Cloud 测试需观察响应内容和明显时间差。
- 验证 recovery 链接在 900 秒服务端期限和前端 15 分钟 intent 边界内绑定正确账号、单次使用、过期失效。
- 已登录用户是否要求当前密码、其他设备退出和 Single Session 保持后续产品决策，不作为当前同步正确性的替代方案。

<a id="cld-04-observability"></a>
### CLD-04 Auth、Sync、Storage 与前端错误观测

- 建立可替换 telemetry 边界，本地可输出结构化 console，生产在 Sentry、PostHog 或自建 provider 中选择一个。
- Auth 记录注册、登录、重发、recovery、callback 失败；Sync/Storage 记录永久失败、恢复结果和必要的 trace ID。
- `ErrorBoundary`、App 初始化和明确 Cloud 失败进入统一上报入口，不继续只散落 `console.error`。
- 禁止记录密码、access/refresh token、service role、完整 magic/recovery URL 和未脱敏邮箱。
- 补人工排查顺序：前端反馈 -> Console/Network -> Supabase Auth/Database/Storage 日志 -> Resend/SMTP -> Redirect 配置。

<a id="cld-05-schema-backfill"></a>
### CLD-05 Legacy schema 与 backfill 决策

- 决定 `rolls.camera_id` 与 `rolls.camera_ids` 的长期合同：删除旧列前必须完成历史 backfill、代码引用审计和回滚方案；否则明确标为 legacy-only。
- 历史 120 固定后背相机缺少 `cameraSystemId` / `filmBackId` 时，以可重复 migration 或受控脚本补齐；禁止猜造不存在的历史关系。
- `Camera.mountKey` / `Lens.mountKey` 如后续用于兼容提示，只做软提示，不因转接环或跨系统使用强制拒绝。
- `UserProfile.updatedAt` server revision、旧 Dexie schema 升级矩阵、长期离线普通字段 LWW 冲突和 tombstone 清理作为后续同步增强。
- 任何 `Roll -> Shoot` 数据库改名必须单独设计兼容 migration；当前不因 UI 文案改名直接重命名 Cloud table。

<a id="cld-06-storage-quota"></a>
### CLD-06 Cloud 图片与存储配额

- local-only 模式不限制本机封面；只有开启 Cloud Storage 后才计算跨设备图片配额。
- 明确 regular/vip 的 `photoStorageQuotaMb`、高分辨率上传规则、超额反馈和是否允许只保留本地缩略图。
- 配额判定必须在可信 Cloud 边界执行，前端只展示结果；不能靠客户端累计值作为安全限制。
- 明确账号删除、替换封面、孤立对象和失败上传的 Storage 清理策略，避免配额被不可见对象永久占用。

<a id="cld-07-payment"></a>
### CLD-07 商业化支付与 VIP 自动开通

- 优先评估 Stripe Checkout；Creem 或 LemonSqueezy 作为备选，不同时实现多个 provider。
- 前端只请求 hosted checkout session；价格、权益和开通结果以可信后端/provider 为准。
- webhook 必须校验签名，使用 provider event ID 幂等处理，并根据受控 metadata 关联 Supabase user。
- webhook secret 不进入 Vite 环境变量；付款成功后幂等更新 `user_profiles.tier = 'vip'` 并记录 provider、event ID 和更新时间。
- 测试覆盖有效付款、重复事件、乱序事件、无效签名、未知用户、退款/取消和前端成功/取消返回。

<a id="cld-08-deployment"></a>
### CLD-08 Cloudflare Pages、域名与发布

- 推荐 Cloudflare Pages 托管 Vite `dist`；构建命令 `npm run build`，生产环境变量只配置 publishable browser values。
- `grainfolio.com` 可作为公开 Landing，`app.grainfolio.com` 可作为登录后应用；短期可指向同一 Pages 项目，但 Auth Redirect URLs 必须逐项登记。
- Cloudflare 提供 DNS、HTTPS/TLS、CDN、SPA fallback、基础 DDoS/WAF/Bot/Rate Limit；它不替代 Supabase Auth、RLS、Storage policy、数据库约束或会员权限。
- 浏览器直连 `*.supabase.co` 的请求不会经过站点 Cloudflare WAF；只有明确需要时才评估 Worker proxy 或 Supabase custom domain。
- 发布前验证 production env、PWA 更新、Auth callback、private Storage、RLS、多账号隔离、跨设备同步和回滚路径。

<a id="cld-09-deferred-cloud"></a>
### CLD-09 条件触发的 Cloud 增强

- Profile bootstrap：只有真实新设备出现资料恢复慢、profile 晚于业务数据或错误“已同步”时再实施。
- 多设备会话控制：只有共享设备、企业账号或明确安全需求出现时，再增加“退出其他设备”或评估 Single Session。
- Cloud 故障注入：可选模拟“RPC 已提交但响应丢失”，确认同一 operation ID 重放不重复执行。
- 正式 telemetry、长期离线冲突 UI 和 Storage 自动恢复队列按真实生产数据与故障率触发，不提前扩建复杂系统。

## 完成与回写规则

1. 在本文件完成实现步骤、配置和验证证据。
2. 更新 `.local-docs` 中受影响的 API Contract、Database Schema、Web Architecture 或运维清单。
3. 回到 `ROADMAP_TODO.md` 更新唯一顶层 checkbox 和 `Next Up` 顺序。
4. UI 有变化时同步 `UI_UX_TODO.md`；纯 Dashboard/Cloud 配置不制造虚假的前端完成项。
5. 不在本文件复制 Roadmap 的完整产品列表，也不在 Roadmap 重新复制本文件的 SQL、Dashboard 和 smoke 细节。
